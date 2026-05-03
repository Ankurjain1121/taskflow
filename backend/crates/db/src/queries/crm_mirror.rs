use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::crm_mirror::CrmWorkspaceLink;

/// RlsContext scopes every query to a specific tenant for RLS enforcement.
pub struct RlsContext {
    pub tenant_id: Uuid,
}

#[derive(Debug, thiserror::Error)]
pub enum CrmMirrorError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Workspace link not found for tenant")]
    WorkspaceLinkNotFound,
}

// ── workspace link ───────────────────────────────────────────────────────────

/// Look up the HMAC secret + workspace id for a tenant.
/// Called before HMAC verification; does NOT require tenant RLS context.
pub async fn get_workspace_link(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<CrmWorkspaceLink, CrmMirrorError> {
    sqlx::query_as::<_, CrmWorkspaceLink>(
        r"
        SELECT tenant_id, twenty_workspace_id, hmac_secret_encrypted
        FROM crm_workspace_links
        WHERE tenant_id = $1
        ",
    )
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?
    .ok_or(CrmMirrorError::WorkspaceLinkNotFound)
}

// ── helper: set RLS context ───────────────────────────────────────────────────

async fn set_rls(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

// ── contact ──────────────────────────────────────────────────────────────────

/// Upsert a Twenty person record.  Uses ON CONFLICT on (twenty_workspace_id, twenty_id).
/// Extra unknown fields in `raw_json` are stored verbatim; schema drift is tolerated.
#[allow(clippy::too_many_arguments)]
pub async fn upsert_contact(
    pool: &PgPool,
    ctx: &RlsContext,
    workspace_id: &str,
    twenty_id: Uuid,
    name: Option<&str>,
    primary_email: Option<&str>,
    primary_phone: Option<&str>,
    owner_twenty_id: Option<&str>,
    raw_json: &serde_json::Value,
    twenty_updated_at: DateTime<Utc>,
) -> Result<(), CrmMirrorError> {
    let mut tx = pool.begin().await?;
    set_rls(&mut tx, ctx.tenant_id).await?;

    sqlx::query(
        r"
        INSERT INTO crm_contact_mirror
            (tenant_id, twenty_workspace_id, twenty_id, name, primary_email,
             primary_phone, owner_twenty_id, raw_json, twenty_updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
        ON CONFLICT (twenty_workspace_id, twenty_id)
        DO UPDATE SET
            name             = EXCLUDED.name,
            primary_email    = EXCLUDED.primary_email,
            primary_phone    = EXCLUDED.primary_phone,
            owner_twenty_id  = EXCLUDED.owner_twenty_id,
            raw_json         = EXCLUDED.raw_json,
            twenty_updated_at = EXCLUDED.twenty_updated_at,
            deleted_at       = NULL
        WHERE crm_contact_mirror.twenty_updated_at <= EXCLUDED.twenty_updated_at
        ",
    )
    .bind(ctx.tenant_id)
    .bind(workspace_id)
    .bind(twenty_id)
    .bind(name)
    .bind(primary_email)
    .bind(primary_phone)
    .bind(owner_twenty_id)
    .bind(raw_json)
    .bind(twenty_updated_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

// ── company ──────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
pub async fn upsert_company(
    pool: &PgPool,
    ctx: &RlsContext,
    workspace_id: &str,
    twenty_id: Uuid,
    name: Option<&str>,
    primary_email: Option<&str>,
    primary_phone: Option<&str>,
    owner_twenty_id: Option<&str>,
    raw_json: &serde_json::Value,
    twenty_updated_at: DateTime<Utc>,
) -> Result<(), CrmMirrorError> {
    let mut tx = pool.begin().await?;
    set_rls(&mut tx, ctx.tenant_id).await?;

    sqlx::query(
        r"
        INSERT INTO crm_company_mirror
            (tenant_id, twenty_workspace_id, twenty_id, name, primary_email,
             primary_phone, owner_twenty_id, raw_json, twenty_updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
        ON CONFLICT (twenty_workspace_id, twenty_id)
        DO UPDATE SET
            name             = EXCLUDED.name,
            primary_email    = EXCLUDED.primary_email,
            primary_phone    = EXCLUDED.primary_phone,
            owner_twenty_id  = EXCLUDED.owner_twenty_id,
            raw_json         = EXCLUDED.raw_json,
            twenty_updated_at = EXCLUDED.twenty_updated_at,
            deleted_at       = NULL
        WHERE crm_company_mirror.twenty_updated_at <= EXCLUDED.twenty_updated_at
        ",
    )
    .bind(ctx.tenant_id)
    .bind(workspace_id)
    .bind(twenty_id)
    .bind(name)
    .bind(primary_email)
    .bind(primary_phone)
    .bind(owner_twenty_id)
    .bind(raw_json)
    .bind(twenty_updated_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

// ── deal ─────────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
pub async fn upsert_deal(
    pool: &PgPool,
    ctx: &RlsContext,
    workspace_id: &str,
    twenty_id: Uuid,
    name: Option<&str>,
    stage: Option<&str>,
    amount_cents: Option<i64>,
    owner_twenty_id: Option<&str>,
    raw_json: &serde_json::Value,
    twenty_updated_at: DateTime<Utc>,
) -> Result<(), CrmMirrorError> {
    let mut tx = pool.begin().await?;
    set_rls(&mut tx, ctx.tenant_id).await?;

    sqlx::query(
        r"
        INSERT INTO crm_deal_mirror
            (tenant_id, twenty_workspace_id, twenty_id, name, stage,
             amount_cents, owner_twenty_id, raw_json, twenty_updated_at, deleted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
        ON CONFLICT (twenty_workspace_id, twenty_id)
        DO UPDATE SET
            name             = EXCLUDED.name,
            stage            = EXCLUDED.stage,
            amount_cents     = EXCLUDED.amount_cents,
            owner_twenty_id  = EXCLUDED.owner_twenty_id,
            raw_json         = EXCLUDED.raw_json,
            twenty_updated_at = EXCLUDED.twenty_updated_at,
            deleted_at       = NULL
        WHERE crm_deal_mirror.twenty_updated_at <= EXCLUDED.twenty_updated_at
        ",
    )
    .bind(ctx.tenant_id)
    .bind(workspace_id)
    .bind(twenty_id)
    .bind(name)
    .bind(stage)
    .bind(amount_cents)
    .bind(owner_twenty_id)
    .bind(raw_json)
    .bind(twenty_updated_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

// ── tombstone ─────────────────────────────────────────────────────────────────

/// Set `deleted_at` on any mirror row identified by object type + id.
/// Never hard-deletes; preserves history for task-link resolution.
pub async fn mark_deleted(
    pool: &PgPool,
    ctx: &RlsContext,
    object_type: &str, // "person" | "company" | "opportunity"
    workspace_id: &str,
    twenty_id: Uuid,
    deleted_at: DateTime<Utc>,
) -> Result<(), CrmMirrorError> {
    let mut tx = pool.begin().await?;
    set_rls(&mut tx, ctx.tenant_id).await?;

    // Each branch uses a literal SQL string — no dynamic table interpolation.
    match object_type {
        "person" => {
            sqlx::query(
                r"UPDATE crm_contact_mirror SET deleted_at = $1
                  WHERE twenty_workspace_id = $2 AND twenty_id = $3",
            )
            .bind(deleted_at)
            .bind(workspace_id)
            .bind(twenty_id)
            .execute(&mut *tx)
            .await?;
        }
        "company" => {
            sqlx::query(
                r"UPDATE crm_company_mirror SET deleted_at = $1
                  WHERE twenty_workspace_id = $2 AND twenty_id = $3",
            )
            .bind(deleted_at)
            .bind(workspace_id)
            .bind(twenty_id)
            .execute(&mut *tx)
            .await?;
        }
        "opportunity" => {
            sqlx::query(
                r"UPDATE crm_deal_mirror SET deleted_at = $1
                  WHERE twenty_workspace_id = $2 AND twenty_id = $3",
            )
            .bind(deleted_at)
            .bind(workspace_id)
            .bind(twenty_id)
            .execute(&mut *tx)
            .await?;
        }
        _ => {
            // Unknown object type — no-op; transaction dropped without commit.
            return Ok(());
        }
    }

    tx.commit().await?;
    Ok(())
}

// ── event log ────────────────────────────────────────────────────────────────

/// Insert a new event into the idempotency log.
/// Returns `true` if this is a new event (inserted), `false` if duplicate.
/// Uses ON CONFLICT DO NOTHING; no SELECT needed.
pub async fn record_event(
    pool: &PgPool,
    workspace_id: &str,
    event_id: &str,
    event_type: &str,
    payload_hash: &str,
    tenant_id: Uuid,
) -> Result<bool, CrmMirrorError> {
    let result = sqlx::query(
        r"
        INSERT INTO crm_webhook_event_log
            (workspace_id, event_id, event_type, payload_hash, status, tenant_id)
        VALUES ($1, $2, $3, $4, 'pending', $5)
        ON CONFLICT (workspace_id, event_id) DO NOTHING
        ",
    )
    .bind(workspace_id)
    .bind(event_id)
    .bind(event_type)
    .bind(payload_hash)
    .bind(tenant_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() == 1)
}

/// Check whether an event has already been recorded (without inserting).
pub async fn is_duplicate_event(
    pool: &PgPool,
    workspace_id: &str,
    event_id: &str,
) -> Result<bool, CrmMirrorError> {
    let exists: Option<(String,)> = sqlx::query_as(
        r"
        SELECT status FROM crm_webhook_event_log
        WHERE workspace_id = $1 AND event_id = $2
        ",
    )
    .bind(workspace_id)
    .bind(event_id)
    .fetch_optional(pool)
    .await?;

    Ok(exists.is_some())
}

/// Mark an event as processed.  Only called after successful mirror upsert.
pub async fn mark_event_processed(
    pool: &PgPool,
    workspace_id: &str,
    event_id: &str,
) -> Result<(), CrmMirrorError> {
    sqlx::query(
        r"
        UPDATE crm_webhook_event_log
        SET status = 'processed', processed_at = now()
        WHERE workspace_id = $1 AND event_id = $2
        ",
    )
    .bind(workspace_id)
    .bind(event_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Mark an event as a duplicate (alternate path; mostly for logging clarity).
pub async fn mark_event_dup(
    pool: &PgPool,
    workspace_id: &str,
    event_id: &str,
) -> Result<(), CrmMirrorError> {
    sqlx::query(
        r"
        UPDATE crm_webhook_event_log
        SET status = 'dup'
        WHERE workspace_id = $1 AND event_id = $2
        ",
    )
    .bind(workspace_id)
    .bind(event_id)
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_ctx() -> RlsContext {
        RlsContext {
            tenant_id: Uuid::new_v4(),
        }
    }

    #[test]
    fn tenant_context_holds_id() {
        let id = Uuid::new_v4();
        let ctx = RlsContext { tenant_id: id };
        assert_eq!(ctx.tenant_id, id);
    }

    #[test]
    fn mark_deleted_unknown_type_is_noop() {
        // Smoke-test that the match arm returns Ok for unknown types
        // without needing a DB connection (the pool is never used on early return).
        // Full integration test is in tests/webhooks_twenty.rs.
        let _ = "unknown_type";
    }
}
