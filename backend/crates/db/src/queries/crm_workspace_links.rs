//! CRUD for `crm_workspace_links`.
//!
//! All mutating queries require a `TenantScope` so callers can never accidentally
//! issue cross-tenant writes. Reads also accept `TenantScope` so the caller is
//! forced to declare which tenant they are operating on; the underlying RLS
//! policy on the table is the second line of defence.

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::CrmWorkspaceLink;

/// Typed wrapper that forces callers to declare a tenant before running a query.
/// Constructed by the API layer from the authenticated `TenantContext`.
#[derive(Debug, Clone, Copy)]
pub struct TenantScope {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
}

impl TenantScope {
    pub fn new(tenant_id: Uuid, user_id: Uuid) -> Self {
        Self { tenant_id, user_id }
    }
}

/// Set the RLS session variable for the current connection.
async fn set_rls<'e, E>(executor: E, tenant_id: Uuid) -> Result<(), sqlx::Error>
where
    E: sqlx::Executor<'e, Database = sqlx::Postgres>,
{
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(executor)
        .await?;
    Ok(())
}

/// Look up the active link for a tenant (the row with `valid_to IS NULL` and
/// `status='active'`). Returns `None` if no active link exists.
pub async fn get_active_for_tenant(
    pool: &PgPool,
    scope: &TenantScope,
) -> Result<Option<CrmWorkspaceLink>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_rls(&mut *tx, scope.tenant_id).await?;

    let row = sqlx::query_as::<_, CrmWorkspaceLink>(
        r"
        SELECT id, tenant_id, twenty_workspace_id, twenty_api_key_encrypted,
               twenty_oidc_client_id, twenty_oidc_client_secret_encrypted,
               valid_from, valid_to, status, created_at, created_by_id
        FROM crm_workspace_links
        WHERE tenant_id = $1 AND valid_to IS NULL AND status = 'active'
        LIMIT 1
        ",
    )
    .bind(scope.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(row)
}

/// Look up the active link by Twenty's workspace identifier (used by the OIDC
/// `/token` endpoint to resolve which tenant a code belongs to). Bypasses
/// `TenantScope` because the lookup itself is what discovers the tenant — but
/// callers must immediately re-scope subsequent operations to the returned
/// `tenant_id`.
///
/// # Security boundary
///
/// This function is *intentionally* unauthenticated at the DB layer — anyone
/// who knows a `twenty_workspace_id` can resolve a link record. The actual
/// security gate is the constant-time `client_secret` comparison performed by
/// the caller at `routes/integrations/twenty_oidc.rs:413` (token endpoint).
/// Without a valid `client_secret`, the resolved row cannot be exchanged for
/// an ID token, and `twenty_workspace_id` alone leaks no PII (it is an opaque
/// UUID issued by Twenty, not user data).
///
/// # Rate limiting
///
/// Callers MUST be invoked from an endpoint protected by the global
/// per-IP/per-client rate limiter (e.g. `/oauth/twenty/token`). This guards
/// against brute-force enumeration of workspace IDs paired with secret-guessing.
/// Do not call this function from any unauthenticated, unrate-limited path.
pub async fn get_by_twenty_workspace_id(
    pool: &PgPool,
    twenty_workspace_id: &str,
) -> Result<Option<CrmWorkspaceLink>, sqlx::Error> {
    sqlx::query_as::<_, CrmWorkspaceLink>(
        r"
        SELECT id, tenant_id, twenty_workspace_id, twenty_api_key_encrypted,
               twenty_oidc_client_id, twenty_oidc_client_secret_encrypted,
               valid_from, valid_to, status, created_at, created_by_id
        FROM crm_workspace_links
        WHERE twenty_workspace_id = $1 AND valid_to IS NULL AND status = 'active'
        LIMIT 1
        ",
    )
    .bind(twenty_workspace_id)
    .fetch_optional(pool)
    .await
}

/// Inputs for creating a new CRM workspace link.
#[derive(Debug, Clone)]
pub struct CreateLinkInput<'a> {
    pub twenty_workspace_id: &'a str,
    pub twenty_oidc_client_id: &'a str,
    pub twenty_oidc_client_secret_encrypted: &'a [u8],
    pub twenty_api_key_encrypted: Option<&'a [u8]>,
}

/// Create a new active link, or return the existing active link if one already
/// exists for this tenant. The partial unique index
/// `(tenant_id) WHERE valid_to IS NULL` makes concurrent provisioning safe:
///
/// 1. First INSERT wins and returns the new row.
/// 2. Second INSERT hits the unique index — `ON CONFLICT DO NOTHING` swallows
///    the conflict, so we re-SELECT and return the existing active row.
///
/// This means two browser tabs (or two retries) racing through the provision
/// flow both see the same record, and neither receives a 500. Callers should
/// treat the returned row as authoritative regardless of which path was hit.
pub async fn create(
    pool: &PgPool,
    scope: &TenantScope,
    input: CreateLinkInput<'_>,
) -> Result<CrmWorkspaceLink, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_rls(&mut *tx, scope.tenant_id).await?;

    let inserted = sqlx::query_as::<_, CrmWorkspaceLink>(
        r"
        INSERT INTO crm_workspace_links (
            tenant_id, twenty_workspace_id, twenty_api_key_encrypted,
            twenty_oidc_client_id, twenty_oidc_client_secret_encrypted,
            created_by_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (tenant_id) WHERE (valid_to IS NULL) DO NOTHING
        RETURNING id, tenant_id, twenty_workspace_id, twenty_api_key_encrypted,
                  twenty_oidc_client_id, twenty_oidc_client_secret_encrypted,
                  valid_from, valid_to, status, created_at, created_by_id
        ",
    )
    .bind(scope.tenant_id)
    .bind(input.twenty_workspace_id)
    .bind(input.twenty_api_key_encrypted)
    .bind(input.twenty_oidc_client_id)
    .bind(input.twenty_oidc_client_secret_encrypted)
    .bind(scope.user_id)
    .fetch_optional(&mut *tx)
    .await?;

    let row = if let Some(row) = inserted {
        row
    } else {
        // Conflict: another concurrent caller already inserted the active row.
        // Re-SELECT it and return — callers see the same record either way.
        sqlx::query_as::<_, CrmWorkspaceLink>(
            r"
            SELECT id, tenant_id, twenty_workspace_id, twenty_api_key_encrypted,
                   twenty_oidc_client_id, twenty_oidc_client_secret_encrypted,
                   valid_from, valid_to, status, created_at, created_by_id
            FROM crm_workspace_links
            WHERE tenant_id = $1 AND valid_to IS NULL
            LIMIT 1
            ",
        )
        .bind(scope.tenant_id)
        .fetch_one(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(row)
}

/// Revoke the active link by setting `valid_to=now()` and `status='revoked'`.
/// Returns true if a row was updated.
pub async fn revoke(
    pool: &PgPool,
    scope: &TenantScope,
    link_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_rls(&mut *tx, scope.tenant_id).await?;

    let result = sqlx::query(
        r"
        UPDATE crm_workspace_links
        SET valid_to = NOW(), status = 'revoked'
        WHERE id = $1 AND tenant_id = $2 AND valid_to IS NULL
        ",
    )
    .bind(link_id)
    .bind(scope.tenant_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

/// Pause the active link (keeps the row but blocks token issuance).
pub async fn pause(pool: &PgPool, scope: &TenantScope, link_id: Uuid) -> Result<bool, sqlx::Error> {
    update_status(pool, scope, link_id, "active", "paused").await
}

/// Resume a paused link.
pub async fn resume(
    pool: &PgPool,
    scope: &TenantScope,
    link_id: Uuid,
) -> Result<bool, sqlx::Error> {
    update_status(pool, scope, link_id, "paused", "active").await
}

async fn update_status(
    pool: &PgPool,
    scope: &TenantScope,
    link_id: Uuid,
    from_status: &str,
    to_status: &str,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    set_rls(&mut *tx, scope.tenant_id).await?;

    let result = sqlx::query(
        r"
        UPDATE crm_workspace_links
        SET status = $3
        WHERE id = $1 AND tenant_id = $2 AND status = $4 AND valid_to IS NULL
        ",
    )
    .bind(link_id)
    .bind(scope.tenant_id)
    .bind(to_status)
    .bind(from_status)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tenant_scope_construction() {
        let s = TenantScope::new(Uuid::new_v4(), Uuid::new_v4());
        assert_ne!(s.tenant_id, s.user_id);
    }

    #[test]
    fn tenant_scope_copy() {
        let a = TenantScope::new(Uuid::new_v4(), Uuid::new_v4());
        let b = a;
        assert_eq!(a.tenant_id, b.tenant_id);
        assert_eq!(a.user_id, b.user_id);
    }
}
