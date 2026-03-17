use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::ManagerOrAdmin;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use taskflow_db::queries::{api_keys, is_workspace_member};

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct CreateApiKeyResponse {
    pub id: Uuid,
    pub name: String,
    pub key_prefix: String,
    pub full_key: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct ApiKeyListItem {
    pub id: Uuid,
    pub name: String,
    pub key_prefix: String,
    pub created_by_id: Uuid,
    pub last_used_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// POST /api/workspaces/:workspace_id/api-keys
async fn create_api_key(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path(workspace_id): Path<Uuid>,
    Json(body): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>> {
    let name = body.name.trim();
    if name.is_empty() || name.len() > 100 {
        return Err(AppError::BadRequest("Name must be 1-100 characters".into()));
    }

    // Verify workspace membership
    let is_member = is_workspace_member(&state.db, workspace_id, manager.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    // Generate CSPRNG key: tf_ prefix + 40 hex chars (using UUID v4 bytes as CSPRNG source)
    let uuid1 = Uuid::new_v4();
    let uuid2 = Uuid::new_v4();
    let mut all_bytes = Vec::with_capacity(32);
    all_bytes.extend_from_slice(uuid1.as_bytes());
    all_bytes.extend_from_slice(uuid2.as_bytes());
    let hex_part: String = all_bytes[..20]
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect();
    let full_key = format!("tf_{}", hex_part);
    let key_prefix = format!("tf_{}...", &hex_part[..8]);

    // Hash with SHA-256 before storage
    let mut hasher = Sha256::new();
    hasher.update(full_key.as_bytes());
    let key_hash = format!("{:x}", hasher.finalize());

    let record = api_keys::create_key(
        &state.db,
        workspace_id,
        name,
        &key_hash,
        &key_prefix,
        manager.0.user_id,
    )
    .await?;

    // Audit log
    log_api_key_action(
        &state.db,
        manager.0.user_id,
        manager.0.tenant_id,
        workspace_id,
        "api_key_created",
    )
    .await;

    Ok(Json(CreateApiKeyResponse {
        id: record.id,
        name: record.name,
        key_prefix: record.key_prefix,
        full_key,
        created_at: record.created_at,
    }))
}

/// GET /api/workspaces/:workspace_id/api-keys
async fn list_api_keys(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<ApiKeyListItem>>> {
    let is_member = is_workspace_member(&state.db, workspace_id, manager.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let keys = api_keys::list_keys(&state.db, workspace_id).await?;

    let items: Vec<ApiKeyListItem> = keys
        .into_iter()
        .map(|k| ApiKeyListItem {
            id: k.id,
            name: k.name,
            key_prefix: k.key_prefix,
            created_by_id: k.created_by_id,
            last_used_at: k.last_used_at,
            created_at: k.created_at,
        })
        .collect();

    Ok(Json(items))
}

/// DELETE /api/workspaces/:workspace_id/api-keys/:key_id
async fn revoke_api_key(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path((workspace_id, key_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let is_member = is_workspace_member(&state.db, workspace_id, manager.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let revoked = api_keys::revoke_key(&state.db, key_id, workspace_id).await?;
    if !revoked {
        return Err(AppError::NotFound("API key not found".into()));
    }

    log_api_key_action(
        &state.db,
        manager.0.user_id,
        manager.0.tenant_id,
        workspace_id,
        "api_key_revoked",
    )
    .await;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn log_api_key_action(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    tenant_id: Uuid,
    workspace_id: Uuid,
    action: &str,
) {
    let metadata = serde_json::json!({ "action": action, "workspace_id": workspace_id });
    let _ = sqlx::query(
        r#"
        INSERT INTO activity_log (id, action, entity_type, entity_id, user_id, metadata, tenant_id)
        VALUES ($1, 'updated', 'api_key', $2, $3, $4, $5)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(user_id)
    .bind(metadata)
    .bind(tenant_id)
    .execute(pool)
    .await;
}

pub fn workspace_api_keys_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/workspaces/{workspace_id}/api-keys",
            get(list_api_keys).post(create_api_key),
        )
        .route(
            "/workspaces/{workspace_id}/api-keys/{key_id}",
            delete(revoke_api_key),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
