//! Outbound CRM sync worker (Phase 6b).
//!
//! Loop: claim a batch via `SELECT FOR UPDATE SKIP LOCKED`, process each job
//! through `twenty::sync::push_job`, then mark success/retry/dlq based on
//! outcome. Bounded concurrency at the loop level (one DB tx per tick).
//!
//! Shutdown: returns when `shutdown_rx.changed()` resolves to true (set by
//! the SIGTERM handler in api/main.rs).
//!
//! Janitor: every 10 ticks, requeue jobs stuck in 'claimed' for >10 min
//! (recovers from worker crashes mid-job — the chaos test case).

use std::time::Duration;

use sqlx::PgPool;
use tokio::sync::watch;

use taskbolt_db::queries::crm_sync::{
    claim_jobs, complete_dropped_conflict, complete_success, force_move_to_dlq, record_failure,
    requeue_stale, RetryOutcome,
};

use crate::twenty::client::TwentyClient;
use crate::twenty::sync::{push_job, OutboundError, PushOutcome};

/// Default batch size per tick.
pub const DEFAULT_BATCH_SIZE: i64 = 10;
/// Default poll interval when the queue is empty.
pub const DEFAULT_IDLE_POLL_MS: u64 = 1_000;
/// Janitor interval — requeue jobs stuck in 'claimed' for >this many seconds.
pub const STALE_CLAIM_SECS: i64 = 600;

/// Run the sync worker until `shutdown_rx` flips to `true`.
///
/// `client` is the TwentyClient (one per process; per-tenant API keys are
/// resolved via the workspace_id in the job payload — initial cut: single
/// global key from `TWENTY_API_KEY`).
pub async fn run_twenty_sync_worker(
    pool: PgPool,
    client: TwentyClient,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    tracing::info!("Twenty sync worker started");
    let mut tick = 0u64;
    let idle_sleep = Duration::from_millis(DEFAULT_IDLE_POLL_MS);

    loop {
        // Cooperative shutdown check.
        if *shutdown_rx.borrow() {
            tracing::info!("Twenty sync worker: shutdown signal received");
            break;
        }

        tick = tick.wrapping_add(1);

        // Periodic janitor: every 10 ticks, requeue stale claims.
        if tick.is_multiple_of(10) {
            match requeue_stale(&pool, STALE_CLAIM_SECS).await {
                Ok(0) => {}
                Ok(n) => tracing::warn!(requeued = n, "Janitor: requeued stale claimed jobs"),
                Err(e) => tracing::error!(error = %e, "Janitor: requeue_stale failed"),
            }
        }

        let jobs = match claim_jobs(&pool, DEFAULT_BATCH_SIZE).await {
            Ok(j) => j,
            Err(e) => {
                tracing::error!(error = %e, "Twenty sync: claim_jobs failed");
                tokio::select! {
                    () = tokio::time::sleep(idle_sleep) => {}
                    _ = shutdown_rx.changed() => break,
                }
                continue;
            }
        };

        if jobs.is_empty() {
            // Idle — back off briefly. Honour shutdown during the wait.
            tokio::select! {
                () = tokio::time::sleep(idle_sleep) => {}
                _ = shutdown_rx.changed() => break,
            }
            continue;
        }

        for job in jobs {
            // Re-check shutdown between jobs.
            if *shutdown_rx.borrow() {
                tracing::info!(
                    job_id = %job.id,
                    "Shutdown received mid-batch; remaining jobs deferred"
                );
                break;
            }
            handle_one_job(&pool, &client, job).await;
        }
    }

    tracing::info!("Twenty sync worker stopped");
}

async fn handle_one_job(
    pool: &PgPool,
    client: &TwentyClient,
    job: taskbolt_db::queries::crm_sync::CrmSyncJob,
) {
    let job_id = job.id;
    let span = tracing::info_span!(
        "twenty_sync_job",
        job_id = %job_id,
        tenant_id = %job.tenant_id,
        entity_type = %job.entity_type,
        entity_id = %job.entity_id,
        operation = %job.operation,
        idempotency_key = %job.idempotency_key,
        retry_count = job.retry_count
    );
    let _enter = span.enter();

    match push_job(pool, client, &job).await {
        Ok(PushOutcome::Pushed) => {
            if let Err(e) = complete_success(pool, job_id).await {
                tracing::error!(error = %e, "Failed to mark job succeeded");
            }
        }
        Ok(PushOutcome::DroppedByConflict { resolution }) => {
            tracing::info!(
                resolution = resolution.as_str(),
                "Outbound dropped by conflict resolver (Twenty newer)"
            );
            if let Err(e) = complete_dropped_conflict(pool, job_id).await {
                tracing::error!(error = %e, "Failed to mark job dropped_conflict");
            }
        }
        Err(e) => {
            let msg = format!("{e}");
            if !e.is_retryable() {
                // Non-retryable: skip backoff, go straight to DLQ.
                let reason = match &e {
                    OutboundError::MissingPayloadField(_) => "invalid_payload",
                    OutboundError::DeleteWithoutTwentyId => "missing_twenty_id",
                    OutboundError::Twenty(_) => "non_retryable_4xx",
                    OutboundError::Db(_) => "db_permanent",
                };
                tracing::warn!(error = %e, reason, "Job non-retryable; moving to DLQ");
                if let Err(dlq_err) = force_move_to_dlq(pool, job_id, reason, &msg).await {
                    tracing::error!(error = %dlq_err, "force_move_to_dlq failed");
                }
                return;
            }

            // Retryable: bump retry_count, advance next_attempt_at.
            match record_failure(pool, job_id, &msg).await {
                Ok(RetryOutcome::Retry) => {
                    tracing::info!(error = %e, "Job will retry with backoff");
                }
                Ok(RetryOutcome::MovedToDlq) => {
                    tracing::warn!(error = %e, "Job exhausted retries; moved to DLQ");
                }
                Err(rec_err) => {
                    tracing::error!(error = %rec_err, "record_failure failed");
                }
            }
        }
    }
}
