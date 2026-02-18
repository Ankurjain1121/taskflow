use sqlx::PgConnection;
use uuid::Uuid;

/// Set the `app.tenant_id` session variable within a transaction.
///
/// This enables PostgreSQL Row-Level Security (RLS) policies that filter
/// rows by `current_setting('app.tenant_id')`. The `SET LOCAL` ensures
/// the setting is scoped to the current transaction only.
///
/// # Usage
/// ```ignore
/// let mut tx = pool.begin().await?;
/// set_tenant_context(&mut *tx, tenant_id).await?;
/// // ... run tenant-scoped queries ...
/// tx.commit().await?;
/// ```
pub async fn set_tenant_context(
    conn: &mut PgConnection,
    tenant_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(conn)
        .await?;

    Ok(())
}
