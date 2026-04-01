use sqlx::PgPool;
use uuid::Uuid;

use crate::models::WorkspaceApiKey;

/// Create a new API key (stores hash, returns the record)
pub async fn create_key(
    pool: &PgPool,
    workspace_id: Uuid,
    name: &str,
    key_hash: &str,
    key_prefix: &str,
    created_by_id: Uuid,
) -> Result<WorkspaceApiKey, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceApiKey>(
        r"
        INSERT INTO workspace_api_keys (id, workspace_id, name, key_hash, key_prefix, created_by_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, workspace_id, name, key_hash, key_prefix, created_by_id,
                  last_used_at, expires_at, revoked_at, created_at
        ",
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(name)
    .bind(key_hash)
    .bind(key_prefix)
    .bind(created_by_id)
    .fetch_one(pool)
    .await
}

/// List active (non-revoked) API keys for a workspace
pub async fn list_keys(
    pool: &PgPool,
    workspace_id: Uuid,
) -> Result<Vec<WorkspaceApiKey>, sqlx::Error> {
    sqlx::query_as::<_, WorkspaceApiKey>(
        r"
        SELECT id, workspace_id, name, key_hash, key_prefix, created_by_id,
               last_used_at, expires_at, revoked_at, created_at
        FROM workspace_api_keys
        WHERE workspace_id = $1 AND revoked_at IS NULL
        ORDER BY created_at DESC
        ",
    )
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Revoke an API key
pub async fn revoke_key(
    pool: &PgPool,
    key_id: Uuid,
    workspace_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r"
        UPDATE workspace_api_keys
        SET revoked_at = NOW()
        WHERE id = $1 AND workspace_id = $2 AND revoked_at IS NULL
        ",
    )
    .bind(key_id)
    .bind(workspace_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}
