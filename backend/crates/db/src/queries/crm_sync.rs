//! CRM outbound sync queue, DLQ, and conflict-log queries.
//!
//! The queue uses `SELECT ... FOR UPDATE SKIP LOCKED` to claim batches
//! without blocking concurrent workers. Retries use exponential backoff
//! capped at 5 minutes; jobs that exhaust `max_retries` are atomically
//! moved to `crm_sync_dlq`.
//!
//! All worker-side queries enable `app.bypass_rls = 'true'` inside the
//! transaction so the picker can scan across tenants. Tenant-scoped
//! callers (admin UI, enqueue API) instead set `app.tenant_id`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum CrmSyncError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Job not found: {0}")]
    JobNotFound(Uuid),
    #[error("Disallowed field in payload: {0}")]
    DisallowedField(String),
    #[error("Invalid entity type: {0}")]
    InvalidEntityType(String),
}

/// Fields allowed in the outbound payload.fields map (per Eng Arch1 directional model).
/// Worker rejects any other field updates with a 422-equivalent error.
pub const ALLOWED_OUTBOUND_FIELDS: &[&str] = &["email", "phone"];

/// One claimed sync job, returned by the picker.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CrmSyncJob {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub twenty_workspace_id: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub operation: String,
    pub payload: serde_json::Value,
    pub idempotency_key: String,
    pub status: String,
    pub retry_count: i32,
    pub max_retries: i32,
    pub last_error: Option<String>,
    pub queued_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub next_attempt_at: DateTime<Utc>,
}

/// Result of an enqueue attempt. `Inserted` for a brand-new key,
/// `Existing` when the idempotency key was already present (no-op).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnqueueOutcome {
    Inserted,
    Existing,
}

/// One outbound enqueue request. `payload` shape:
/// `{"fields": {"email": "x@y.com"}, "twenty_id": "...", "local_updated_at": "..."}`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnqueueRequest {
    pub tenant_id: Uuid,
    pub twenty_workspace_id: String,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub operation: String,
    pub payload: serde_json::Value,
    pub idempotency_key: String,
    pub max_retries: Option<i32>,
}

// ── helpers ──────────────────────────────────────────────────────────────────

/// Validate that the payload's `fields` map only contains allowed keys.
/// Returns the first disallowed field found, or Ok(()) if all are permitted.
pub fn validate_payload_fields(payload: &serde_json::Value) -> Result<(), CrmSyncError> {
    let Some(fields) = payload.get("fields").and_then(|v| v.as_object()) else {
        return Ok(()); // delete-only payloads have no fields map
    };
    for key in fields.keys() {
        if !ALLOWED_OUTBOUND_FIELDS.contains(&key.as_str()) {
            return Err(CrmSyncError::DisallowedField(key.clone()));
        }
    }
    Ok(())
}

fn validate_entity_type(et: &str) -> Result<(), CrmSyncError> {
    match et {
        "contact" | "company" | "deal" => Ok(()),
        _ => Err(CrmSyncError::InvalidEntityType(et.to_string())),
    }
}

/// Compute the next attempt time using exponential backoff:
/// `2^retry_count` seconds, clamped to 5 minutes.
pub fn backoff_seconds(retry_count: i32) -> i64 {
    let exp = retry_count.clamp(0, 30);
    let secs = 1_i64.checked_shl(exp as u32).unwrap_or(i64::MAX);
    secs.min(300) // 5 min cap
}

/// Set the worker bypass-RLS flag for the current transaction.
/// Must be called as the first statement of every worker transaction.
async fn set_worker_bypass(tx: &mut Transaction<'_, Postgres>) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT set_config('app.bypass_rls', 'true', true)")
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Set the tenant context for the current transaction (used by enqueue API + admin queries).
async fn set_tenant_ctx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── enqueue (tenant-scoped) ──────────────────────────────────────────────────

/// Enqueue a sync job. Idempotent on `idempotency_key`:
/// - new key  → INSERT, returns (job_id, Inserted)
/// - existing → returns (existing_job_id, Existing) without modification
pub async fn enqueue_job(
    pool: &PgPool,
    req: &EnqueueRequest,
) -> Result<(Uuid, EnqueueOutcome), CrmSyncError> {
    validate_entity_type(&req.entity_type)?;
    validate_payload_fields(&req.payload)?;
    if req.operation != "upsert" && req.operation != "delete" {
        return Err(CrmSyncError::InvalidEntityType(req.operation.clone()));
    }

    let mut tx = pool.begin().await?;
    set_tenant_ctx(&mut tx, req.tenant_id).await?;

    let max_retries = req.max_retries.unwrap_or(5);

    // INSERT ... ON CONFLICT DO NOTHING returns 0 rows on conflict.
    // We then SELECT the existing row's id so callers always get one.
    let inserted: Option<(Uuid,)> = sqlx::query_as(
        r"
        INSERT INTO crm_sync_jobs
            (tenant_id, twenty_workspace_id, entity_type, entity_id, operation,
             payload, idempotency_key, max_retries)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id
        ",
    )
    .bind(req.tenant_id)
    .bind(&req.twenty_workspace_id)
    .bind(&req.entity_type)
    .bind(req.entity_id)
    .bind(&req.operation)
    .bind(&req.payload)
    .bind(&req.idempotency_key)
    .bind(max_retries)
    .fetch_optional(&mut *tx)
    .await?;

    let result = if let Some((id,)) = inserted {
        (id, EnqueueOutcome::Inserted)
    } else {
        let (id,): (Uuid,) =
            sqlx::query_as(r"SELECT id FROM crm_sync_jobs WHERE idempotency_key = $1")
                .bind(&req.idempotency_key)
                .fetch_one(&mut *tx)
                .await?;
        (id, EnqueueOutcome::Existing)
    };

    tx.commit().await?;
    Ok(result)
}

// ── worker: claim + complete + retry ─────────────────────────────────────────

/// Claim up to `batch_size` due jobs. Uses `FOR UPDATE SKIP LOCKED` so multiple
/// workers can run without contention.
///
/// IMPORTANT: the returned jobs are marked `claimed` in the same tx and the
/// caller must complete them (success/retry/dlq) — failure to do so leaves
/// them stuck until the lease expires (handled by `requeue_stale`).
pub async fn claim_jobs(pool: &PgPool, batch_size: i64) -> Result<Vec<CrmSyncJob>, CrmSyncError> {
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    let jobs: Vec<CrmSyncJob> = sqlx::query_as(
        r"
        WITH due AS (
            SELECT id FROM crm_sync_jobs
            WHERE status IN ('pending', 'failed')
              AND next_attempt_at <= now()
            ORDER BY next_attempt_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
        )
        UPDATE crm_sync_jobs j
        SET status = 'claimed',
            started_at = now()
        FROM due
        WHERE j.id = due.id
        RETURNING j.id, j.tenant_id, j.twenty_workspace_id, j.entity_type, j.entity_id,
                  j.operation, j.payload, j.idempotency_key, j.status, j.retry_count,
                  j.max_retries, j.last_error, j.queued_at, j.started_at, j.finished_at,
                  j.next_attempt_at
        ",
    )
    .bind(batch_size)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(jobs)
}

/// Mark a job successful. Sets `finished_at`, status='succeeded'.
pub async fn complete_success(pool: &PgPool, job_id: Uuid) -> Result<(), CrmSyncError> {
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    let res = sqlx::query(
        r"
        UPDATE crm_sync_jobs
        SET status = 'succeeded',
            finished_at = now(),
            last_error = NULL
        WHERE id = $1
        ",
    )
    .bind(job_id)
    .execute(&mut *tx)
    .await?;

    if res.rows_affected() == 0 {
        return Err(CrmSyncError::JobNotFound(job_id));
    }
    tx.commit().await?;
    Ok(())
}

/// Mark a job dropped because Twenty's mirror was newer (Phase 6c).
/// Distinct from `succeeded` so admins can audit volume of dropped writes.
pub async fn complete_dropped_conflict(pool: &PgPool, job_id: Uuid) -> Result<(), CrmSyncError> {
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    sqlx::query(
        r"
        UPDATE crm_sync_jobs
        SET status = 'dropped_conflict',
            finished_at = now(),
            last_error = 'twenty_newer_than_local'
        WHERE id = $1
        ",
    )
    .bind(job_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Outcome of a retry decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetryOutcome {
    /// Will be re-attempted at `next_attempt_at`.
    Retry,
    /// Exceeded max_retries; moved to DLQ.
    MovedToDlq,
}

/// Record a retryable failure. Bumps `retry_count`, advances `next_attempt_at`
/// by exponential backoff. If we just hit `max_retries`, atomically moves the
/// row to `crm_sync_dlq` and returns `MovedToDlq`.
pub async fn record_failure(
    pool: &PgPool,
    job_id: Uuid,
    error_msg: &str,
) -> Result<RetryOutcome, CrmSyncError> {
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    // Read current retry_count + max_retries inside the tx.
    let row =
        sqlx::query(r"SELECT retry_count, max_retries FROM crm_sync_jobs WHERE id = $1 FOR UPDATE")
            .bind(job_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(CrmSyncError::JobNotFound(job_id))?;

    let retry_count: i32 = row.try_get("retry_count")?;
    let max_retries: i32 = row.try_get("max_retries")?;
    let new_count = retry_count + 1;

    if new_count >= max_retries {
        move_to_dlq_in_tx(&mut tx, job_id, "max_retries_exceeded", error_msg).await?;
        tx.commit().await?;
        return Ok(RetryOutcome::MovedToDlq);
    }

    let backoff = backoff_seconds(new_count);
    sqlx::query(
        r"
        UPDATE crm_sync_jobs
        SET status = 'failed',
            retry_count = $2,
            last_error = $3,
            next_attempt_at = now() + ($4 || ' seconds')::interval,
            started_at = NULL
        WHERE id = $1
        ",
    )
    .bind(job_id)
    .bind(new_count)
    .bind(error_msg)
    .bind(backoff.to_string())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(RetryOutcome::Retry)
}

/// Force-move a job to DLQ regardless of retry count (e.g. allowlist violation,
/// non-retryable 4xx from Twenty).
pub async fn force_move_to_dlq(
    pool: &PgPool,
    job_id: Uuid,
    reason: &str,
    error_msg: &str,
) -> Result<(), CrmSyncError> {
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;
    move_to_dlq_in_tx(&mut tx, job_id, reason, error_msg).await?;
    tx.commit().await?;
    Ok(())
}

async fn move_to_dlq_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    job_id: Uuid,
    reason: &str,
    error_msg: &str,
) -> Result<(), CrmSyncError> {
    // Snapshot the job into the DLQ table, then mark the original as 'dlq'.
    sqlx::query(
        r"
        INSERT INTO crm_sync_dlq
            (original_job_id, tenant_id, twenty_workspace_id, entity_type, entity_id,
             operation, payload, idempotency_key, retry_count, last_error,
             dlq_reason, queued_at)
        SELECT id, tenant_id, twenty_workspace_id, entity_type, entity_id,
               operation, payload, idempotency_key, retry_count, $2,
               $3, queued_at
        FROM crm_sync_jobs
        WHERE id = $1
        ",
    )
    .bind(job_id)
    .bind(error_msg)
    .bind(reason)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        r"
        UPDATE crm_sync_jobs
        SET status = 'dlq', last_error = $2, finished_at = now()
        WHERE id = $1
        ",
    )
    .bind(job_id)
    .bind(error_msg)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

/// Re-queue jobs that were claimed but never completed (worker crashed).
/// Called periodically by a janitor task. `stale_after_secs` defaults to 600.
pub async fn requeue_stale(pool: &PgPool, stale_after_secs: i64) -> Result<u64, CrmSyncError> {
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    let res = sqlx::query(
        r"
        UPDATE crm_sync_jobs
        SET status = 'pending',
            started_at = NULL,
            next_attempt_at = now()
        WHERE status = 'claimed'
          AND started_at < now() - ($1 || ' seconds')::interval
        ",
    )
    .bind(stale_after_secs.to_string())
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(res.rows_affected())
}

// ── conflict log + mirror lookup (Phase 6c) ──────────────────────────────────

/// Twenty's `twenty_updated_at` for an entity in the mirror cache. Used by
/// the conflict resolver to compare against the outbound `local_updated_at`.
/// Returns Ok(None) if the entity has no mirror row (no prior Twenty sync).
pub async fn get_mirror_updated_at(
    pool: &PgPool,
    entity_type: &str,
    twenty_workspace_id: &str,
    twenty_id: Uuid,
) -> Result<Option<DateTime<Utc>>, CrmSyncError> {
    let table = match entity_type {
        "contact" => "crm_contact_mirror",
        "company" => "crm_company_mirror",
        "deal" => "crm_deal_mirror",
        other => return Err(CrmSyncError::InvalidEntityType(other.to_string())),
    };

    // Bypass RLS so the worker can read across tenants.
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    // Static-table dispatch via match arm; never interpolates user input.
    let sql = format!(
        "SELECT twenty_updated_at FROM {table} WHERE twenty_workspace_id = $1 AND twenty_id = $2"
    );
    let row: Option<(DateTime<Utc>,)> = sqlx::query_as(&sql)
        .bind(twenty_workspace_id)
        .bind(twenty_id)
        .fetch_optional(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(row.map(|(t,)| t))
}

/// Insert one row per dropped field into `crm_conflict_log`.
#[derive(Debug, Clone)]
pub struct ConflictLogEntry<'a> {
    pub tenant_id: Uuid,
    pub twenty_workspace_id: &'a str,
    pub entity_type: &'a str,
    pub entity_id: Uuid,
    pub field_name: &'a str,
    pub taskbolt_value: Option<&'a serde_json::Value>,
    pub twenty_value: Option<&'a serde_json::Value>,
    pub resolution: &'a str,
    pub taskbolt_updated_at: Option<DateTime<Utc>>,
    pub twenty_updated_at: Option<DateTime<Utc>>,
    pub source_job_id: Option<Uuid>,
}

pub async fn log_conflict(
    pool: &PgPool,
    entry: ConflictLogEntry<'_>,
) -> Result<Uuid, CrmSyncError> {
    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    let (id,): (Uuid,) = sqlx::query_as(
        r"
        INSERT INTO crm_conflict_log
            (tenant_id, twenty_workspace_id, entity_type, entity_id, field_name,
             taskbolt_value, twenty_value, resolution,
             taskbolt_updated_at, twenty_updated_at, source_job_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        ",
    )
    .bind(entry.tenant_id)
    .bind(entry.twenty_workspace_id)
    .bind(entry.entity_type)
    .bind(entry.entity_id)
    .bind(entry.field_name)
    .bind(entry.taskbolt_value)
    .bind(entry.twenty_value)
    .bind(entry.resolution)
    .bind(entry.taskbolt_updated_at)
    .bind(entry.twenty_updated_at)
    .bind(entry.source_job_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(id)
}

/// Update the mirror's `twenty_updated_at` after a successful outbound push.
/// Called immediately after Twenty acks the upsert, before the next conflict
/// check sees a stale value. Returns the number of rows updated.
pub async fn touch_mirror_after_push(
    pool: &PgPool,
    entity_type: &str,
    twenty_workspace_id: &str,
    twenty_id: Uuid,
    new_twenty_updated_at: DateTime<Utc>,
) -> Result<u64, CrmSyncError> {
    let table = match entity_type {
        "contact" => "crm_contact_mirror",
        "company" => "crm_company_mirror",
        "deal" => "crm_deal_mirror",
        other => return Err(CrmSyncError::InvalidEntityType(other.to_string())),
    };

    let mut tx = pool.begin().await?;
    set_worker_bypass(&mut tx).await?;

    let sql = format!(
        "UPDATE {table} SET twenty_updated_at = $1 \
         WHERE twenty_workspace_id = $2 AND twenty_id = $3 \
           AND twenty_updated_at < $1"
    );
    let res = sqlx::query(&sql)
        .bind(new_twenty_updated_at)
        .bind(twenty_workspace_id)
        .bind(twenty_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(res.rows_affected())
}

// ── tests (logic only; DB-touching tests live in api/tests/twenty_sync_outbound) ──

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn backoff_grows_then_caps() {
        assert_eq!(backoff_seconds(0), 1);
        assert_eq!(backoff_seconds(1), 2);
        assert_eq!(backoff_seconds(4), 16);
        // 2^9 = 512 → capped to 300
        assert_eq!(backoff_seconds(9), 300);
        // Negative input → clamped to 0
        assert_eq!(backoff_seconds(-1), 1);
        // Huge input doesn't panic
        assert_eq!(backoff_seconds(i32::MAX), 300);
    }

    #[test]
    fn allowlist_accepts_email_and_phone() {
        let payload = json!({"fields": {"email": "x@y.com", "phone": "+15555550100"}});
        validate_payload_fields(&payload).expect("email + phone allowed");
    }

    #[test]
    fn allowlist_rejects_other_fields() {
        let payload = json!({"fields": {"name": "Mallory"}});
        let err = validate_payload_fields(&payload).expect_err("name not allowed");
        match err {
            CrmSyncError::DisallowedField(f) => assert_eq!(f, "name"),
            other => panic!("expected DisallowedField, got {other:?}"),
        }
    }

    #[test]
    fn allowlist_skips_when_no_fields_map() {
        // Delete operations have no `fields` map; should pass.
        let payload = json!({"twenty_id": "abc"});
        validate_payload_fields(&payload).expect("delete payload OK");
    }

    #[test]
    fn entity_type_validator() {
        validate_entity_type("contact").unwrap();
        validate_entity_type("company").unwrap();
        validate_entity_type("deal").unwrap();
        assert!(matches!(
            validate_entity_type("widget"),
            Err(CrmSyncError::InvalidEntityType(_))
        ));
    }
}
