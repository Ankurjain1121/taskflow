//! Integration tests for Phase 6b outbound CRM sync + Phase 6c conflict resolution.
//!
//! Run with: `cargo test --workspace -- --test-threads=1 twenty_sync`
//!
//! Coverage:
//! - allowlist: only `email` / `phone` accepted; other fields → DisallowedField
//! - idempotency: same idempotency_key → same job_id (Existing)
//! - DLQ: record_failure repeated until max_retries → MovedToDlq
//! - conflict resolution: local-newer Push, twenty-newer Skip, equal-second Skip(Tie)
//! - chaos: claimed-but-unfinished jobs are recovered by `requeue_stale`
//!
//! These tests touch the DB but never make HTTP calls — the worker's HTTP
//! surface is exercised at the `push_job` boundary using only the conflict
//! decision path (Skip cases) plus the lifecycle DB calls.

use chrono::{Duration as ChronoDuration, TimeZone, Utc};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use taskbolt_db::queries::crm_sync::{
    self, claim_jobs, complete_dropped_conflict, complete_success, enqueue_job, force_move_to_dlq,
    log_conflict, record_failure, requeue_stale, validate_payload_fields, ConflictLogEntry,
    CrmSyncError, EnqueueOutcome, EnqueueRequest, RetryOutcome,
};
use taskbolt_services::twenty::sync::{decide_conflict, ConflictDecision, ConflictResolution};

// ── shared helpers ───────────────────────────────────────────────────────────

async fn pool() -> PgPool {
    let _ = dotenvy::from_path("../../.env");
    let _ = dotenvy::dotenv();
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL required for integration tests");
    PgPool::connect(&url).await.expect("connect to test DB")
}

/// Create a throwaway tenant + workspace_link row so FK constraints + the
/// enqueue path can resolve the workspace mapping. Returns (tenant_id, workspace_id).
async fn make_tenant(pool: &PgPool) -> (Uuid, String) {
    let tenant_id = Uuid::new_v4();
    let suffix = tenant_id.to_string().replace('-', "");
    sqlx::query(
        "INSERT INTO tenants (id, name, slug, plan, created_at, updated_at)
         VALUES ($1, $2, $3, 'free', now(), now())",
    )
    .bind(tenant_id)
    .bind(format!("test-{suffix}"))
    .bind(format!("test-{}", &suffix[..16]))
    .execute(pool)
    .await
    .expect("insert tenant");

    let workspace_id = format!("twenty-ws-{}", &suffix[..12]);
    sqlx::query(
        "INSERT INTO crm_workspace_links (tenant_id, twenty_workspace_id, hmac_secret)
         VALUES ($1, $2, $3)",
    )
    .bind(tenant_id)
    .bind(&workspace_id)
    .bind("test-hmac-secret")
    .execute(pool)
    .await
    .expect("insert workspace link");

    (tenant_id, workspace_id)
}

fn enqueue_req(
    tenant_id: Uuid,
    workspace_id: &str,
    operation: &str,
    payload: serde_json::Value,
    idem: &str,
) -> EnqueueRequest {
    EnqueueRequest {
        tenant_id,
        twenty_workspace_id: workspace_id.to_string(),
        entity_type: "contact".to_string(),
        entity_id: Uuid::new_v4(),
        operation: operation.to_string(),
        payload,
        idempotency_key: idem.to_string(),
        max_retries: Some(3),
    }
}

// ── allowlist ────────────────────────────────────────────────────────────────

#[test]
fn twenty_sync_allowlist_accepts_email_phone() {
    validate_payload_fields(&json!({"fields": {"email": "x@y.com"}})).unwrap();
    validate_payload_fields(&json!({"fields": {"phone": "+15555550100"}})).unwrap();
    validate_payload_fields(&json!({"fields": {"email": "x@y.com", "phone": "+1"}})).unwrap();
}

#[test]
fn twenty_sync_allowlist_rejects_name_company_etc() {
    let cases = ["name", "company_name", "stage", "amount_cents", "owner"];
    for field in cases {
        let payload = json!({ "fields": { field: "x" } });
        let err =
            validate_payload_fields(&payload).expect_err(&format!("{field} should be rejected"));
        match err {
            CrmSyncError::DisallowedField(f) => assert_eq!(f, field),
            other => panic!("expected DisallowedField({field}) got {other:?}"),
        }
    }
}

#[tokio::test]
async fn twenty_sync_enqueue_rejects_disallowed_field() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let req = enqueue_req(
        tenant_id,
        &ws_id,
        "upsert",
        json!({
            "fields": {"name": "Mallory"},
            "local_updated_at": Utc::now().to_rfc3339(),
        }),
        "idem-allowlist-1",
    );
    let err = enqueue_job(&pool, &req).await.expect_err("disallowed");
    assert!(matches!(err, CrmSyncError::DisallowedField(_)));
}

// ── idempotency under retry ──────────────────────────────────────────────────

#[tokio::test]
async fn twenty_sync_idempotent_enqueue_returns_same_job_id() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let payload = json!({
        "fields": {"email": "alice@example.com"},
        "local_updated_at": Utc::now().to_rfc3339(),
    });
    let key = format!("idem-test-{}", Uuid::new_v4());
    let req = enqueue_req(tenant_id, &ws_id, "upsert", payload.clone(), &key);

    let (id1, outcome1) = enqueue_job(&pool, &req).await.unwrap();
    assert_eq!(outcome1, EnqueueOutcome::Inserted);

    // Second enqueue with the SAME idempotency_key → no insert, returns same id.
    let req2 = enqueue_req(tenant_id, &ws_id, "upsert", payload.clone(), &key);
    let (id2, outcome2) = enqueue_job(&pool, &req2).await.unwrap();
    assert_eq!(id1, id2, "idempotency_key collision should return same id");
    assert_eq!(outcome2, EnqueueOutcome::Existing);

    // Third enqueue with a DIFFERENT key → fresh row.
    let key2 = format!("idem-test-{}", Uuid::new_v4());
    let req3 = enqueue_req(tenant_id, &ws_id, "upsert", payload, &key2);
    let (id3, outcome3) = enqueue_job(&pool, &req3).await.unwrap();
    assert_ne!(id1, id3);
    assert_eq!(outcome3, EnqueueOutcome::Inserted);
}

// ── DLQ at max_retries ───────────────────────────────────────────────────────

#[tokio::test]
async fn twenty_sync_dlq_at_max_retries() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let key = format!("idem-dlq-{}", Uuid::new_v4());
    let req = EnqueueRequest {
        tenant_id,
        twenty_workspace_id: ws_id,
        entity_type: "contact".to_string(),
        entity_id: Uuid::new_v4(),
        operation: "upsert".to_string(),
        payload: json!({
            "fields": {"email": "bob@example.com"},
            "local_updated_at": Utc::now().to_rfc3339(),
        }),
        idempotency_key: key.clone(),
        max_retries: Some(3), // 3 failures → DLQ on the 3rd
    };
    let (job_id, _) = enqueue_job(&pool, &req).await.unwrap();

    // Simulate 2 retryable failures — both should return Retry, not MovedToDlq.
    for n in 1..=2 {
        let outcome = record_failure(&pool, job_id, &format!("simulated 5xx #{n}"))
            .await
            .unwrap();
        assert_eq!(outcome, RetryOutcome::Retry, "attempt {n} should retry");
    }

    // 3rd failure pushes retry_count to 3 == max_retries → DLQ.
    let outcome = record_failure(&pool, job_id, "simulated 5xx #3 (final)")
        .await
        .unwrap();
    assert_eq!(outcome, RetryOutcome::MovedToDlq);

    // Verify the DLQ row exists with the right reason.
    let row: Option<(String, String, i32)> = sqlx::query_as(
        "SELECT dlq_reason, last_error, retry_count FROM crm_sync_dlq
         WHERE original_job_id = $1",
    )
    .bind(job_id)
    .fetch_optional(&pool)
    .await
    .unwrap();
    let (reason, last_err, retries) = row.expect("DLQ row should exist");
    assert_eq!(reason, "max_retries_exceeded");
    assert!(last_err.contains("#3 (final)"));
    assert_eq!(retries, 3);

    // Original job is marked 'dlq'.
    let (status,): (String,) = sqlx::query_as("SELECT status FROM crm_sync_jobs WHERE id = $1")
        .bind(job_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "dlq");
}

// ── conflict resolution: 3 cases ─────────────────────────────────────────────

#[test]
fn twenty_sync_conflict_local_newer_pushes() {
    let local = Utc.timestamp_opt(2_000_000, 0).unwrap();
    let twenty = Utc.timestamp_opt(1_000_000, 0).unwrap();
    assert_eq!(decide_conflict(local, Some(twenty)), ConflictDecision::Push);
}

#[test]
fn twenty_sync_conflict_twenty_newer_skips() {
    let local = Utc.timestamp_opt(1_000_000, 0).unwrap();
    let twenty = Utc.timestamp_opt(2_000_000, 0).unwrap();
    assert_eq!(
        decide_conflict(local, Some(twenty)),
        ConflictDecision::Skip {
            resolution: ConflictResolution::TwentyWinsTimestamp
        }
    );
}

#[test]
fn twenty_sync_conflict_equal_second_twenty_wins_tie() {
    let t = Utc.timestamp_opt(1_500_000, 0).unwrap();
    assert_eq!(
        decide_conflict(t, Some(t)),
        ConflictDecision::Skip {
            resolution: ConflictResolution::TwentyWinsTie
        }
    );
}

#[tokio::test]
async fn twenty_sync_conflict_log_writes_per_field_row() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let entity_id = Uuid::new_v4();
    let payload = json!({"email": "before@example.com"});

    let id = log_conflict(
        &pool,
        ConflictLogEntry {
            tenant_id,
            twenty_workspace_id: &ws_id,
            entity_type: "contact",
            entity_id,
            field_name: "email",
            taskbolt_value: Some(&payload),
            twenty_value: None,
            resolution: "twenty_wins_timestamp",
            taskbolt_updated_at: Some(Utc::now() - ChronoDuration::seconds(60)),
            twenty_updated_at: Some(Utc::now()),
            source_job_id: None,
        },
    )
    .await
    .unwrap();

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM crm_conflict_log WHERE id = $1 AND resolution = 'twenty_wins_timestamp'",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count.0, 1);
}

// ── chaos: claimed jobs survive worker crash ─────────────────────────────────

#[tokio::test]
async fn twenty_sync_stale_claims_are_requeued() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let key = format!("idem-stale-{}", Uuid::new_v4());
    let req = EnqueueRequest {
        tenant_id,
        twenty_workspace_id: ws_id,
        entity_type: "contact".to_string(),
        entity_id: Uuid::new_v4(),
        operation: "upsert".to_string(),
        payload: json!({
            "fields": {"email": "chaos@example.com"},
            "local_updated_at": Utc::now().to_rfc3339(),
        }),
        idempotency_key: key,
        max_retries: Some(5),
    };
    let (job_id, _) = enqueue_job(&pool, &req).await.unwrap();

    // Simulate a worker crash mid-job: claim the row, never complete.
    let claimed = claim_jobs(&pool, 10).await.unwrap();
    assert!(claimed.iter().any(|j| j.id == job_id));

    // Backdate the claim so it qualifies as stale (>10 min old).
    sqlx::query(
        "UPDATE crm_sync_jobs SET started_at = now() - interval '20 minutes' WHERE id = $1",
    )
    .bind(job_id)
    .execute(&pool)
    .await
    .unwrap();

    let n = requeue_stale(&pool, 600).await.unwrap();
    assert!(n >= 1, "stale claim should be requeued");

    // Status must be back to 'pending' so the next claim picks it up.
    let (status,): (String,) = sqlx::query_as("SELECT status FROM crm_sync_jobs WHERE id = $1")
        .bind(job_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "pending");

    // Re-claim works.
    let claimed2 = claim_jobs(&pool, 10).await.unwrap();
    assert!(
        claimed2.iter().any(|j| j.id == job_id),
        "requeued job should be re-claimed"
    );
}

// ── lifecycle smoke: success + dropped-by-conflict transitions ───────────────

#[tokio::test]
async fn twenty_sync_lifecycle_success_marks_finished() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let key = format!("idem-success-{}", Uuid::new_v4());
    let req = EnqueueRequest {
        tenant_id,
        twenty_workspace_id: ws_id,
        entity_type: "contact".to_string(),
        entity_id: Uuid::new_v4(),
        operation: "upsert".to_string(),
        payload: json!({
            "fields": {"email": "ok@example.com"},
            "local_updated_at": Utc::now().to_rfc3339(),
        }),
        idempotency_key: key,
        max_retries: Some(5),
    };
    let (job_id, _) = enqueue_job(&pool, &req).await.unwrap();
    let _ = claim_jobs(&pool, 10).await.unwrap();

    complete_success(&pool, job_id).await.unwrap();
    let (status, finished): (String, Option<chrono::DateTime<Utc>>) =
        sqlx::query_as("SELECT status, finished_at FROM crm_sync_jobs WHERE id = $1")
            .bind(job_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status, "succeeded");
    assert!(finished.is_some());
}

#[tokio::test]
async fn twenty_sync_lifecycle_dropped_conflict_distinct_status() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let key = format!("idem-conflict-{}", Uuid::new_v4());
    let req = EnqueueRequest {
        tenant_id,
        twenty_workspace_id: ws_id,
        entity_type: "contact".to_string(),
        entity_id: Uuid::new_v4(),
        operation: "upsert".to_string(),
        payload: json!({
            "fields": {"email": "stale@example.com"},
            "local_updated_at": Utc::now().to_rfc3339(),
        }),
        idempotency_key: key,
        max_retries: Some(5),
    };
    let (job_id, _) = enqueue_job(&pool, &req).await.unwrap();
    complete_dropped_conflict(&pool, job_id).await.unwrap();
    let (status,): (String,) = sqlx::query_as("SELECT status FROM crm_sync_jobs WHERE id = $1")
        .bind(job_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "dropped_conflict");
}

#[tokio::test]
async fn twenty_sync_force_dlq_invalid_payload() {
    let pool = pool().await;
    let (tenant_id, ws_id) = make_tenant(&pool).await;
    let key = format!("idem-force-dlq-{}", Uuid::new_v4());
    let req = EnqueueRequest {
        tenant_id,
        twenty_workspace_id: ws_id,
        entity_type: "deal".to_string(),
        entity_id: Uuid::new_v4(),
        operation: "delete".to_string(),
        payload: json!({}), // missing twenty_id → permanent error
        idempotency_key: key,
        max_retries: Some(5),
    };
    let (job_id, _) = enqueue_job(&pool, &req).await.unwrap();

    force_move_to_dlq(&pool, job_id, "missing_twenty_id", "delete needs twenty_id")
        .await
        .unwrap();

    let row: (String, String) = sqlx::query_as(
        "SELECT dlq_reason, last_error FROM crm_sync_dlq WHERE original_job_id = $1",
    )
    .bind(job_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row.0, "missing_twenty_id");
    assert!(row.1.contains("twenty_id"));
}

// Sanity: backoff matches the 2^n pattern up to the 5-minute cap.
#[test]
fn twenty_sync_backoff_curve() {
    use crm_sync::backoff_seconds;
    let pairs = [
        (0, 1),
        (1, 2),
        (2, 4),
        (3, 8),
        (4, 16),
        (8, 256),
        (9, 300),
        (20, 300),
    ];
    for (n, expected) in pairs {
        assert_eq!(backoff_seconds(n), expected, "backoff_seconds({n})");
    }
}
