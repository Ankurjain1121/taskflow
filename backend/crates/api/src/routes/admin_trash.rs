//! Admin trash bin routes
//!
//! Provides endpoints for viewing and managing soft-deleted items.
//! All endpoints require Admin role.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AdminUser;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_services::minio::{MinioConfig, MinioService};
use taskflow_services::trash_bin::{
    get_trash_items, permanently_delete, restore_from_trash, PaginatedTrashItems, TrashEntityType,
};

/// Query parameters for trash listing
#[derive(Debug, Deserialize)]
pub struct TrashListQuery {
    /// Filter by entity type (task, board, workspace)
    pub entity_type: Option<String>,
    /// Cursor for pagination (deleted_at timestamp in RFC3339)
    pub cursor: Option<String>,
    /// Number of entries to return (default 20, max 100)
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn default_page_size() -> i64 {
    20
}

/// Request body for restore operation
#[derive(Debug, Deserialize)]
pub struct RestoreRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
}

/// Response for trash operations
#[derive(Debug, Serialize)]
pub struct TrashOperationResponse {
    pub success: bool,
    pub message: String,
}

/// Empty trash response
#[derive(Debug, Serialize)]
pub struct EmptyTrashResponse {
    pub success: bool,
    pub deleted_count: usize,
    pub message: String,
}

/// Helper to create MinioService from app config
async fn create_minio_service(state: &AppState) -> MinioService {
    MinioService::new(MinioConfig {
        endpoint: state.config.minio_endpoint.clone(),
        public_url: state.config.minio_public_url.clone(),
        access_key: state.config.minio_access_key.clone(),
        secret_key: state.config.minio_secret_key.clone(),
        bucket: state.config.minio_bucket.clone(),
    })
    .await
}

/// GET /api/admin/trash
///
/// List items in trash with optional filtering and cursor-based pagination.
/// Requires Admin role.
async fn list_trash(
    State(state): State<AppState>,
    admin: AdminUser,
    Query(query): Query<TrashListQuery>,
) -> Result<Json<PaginatedTrashItems>> {
    let tenant_id = admin.0.tenant_id;
    let page_size = query.page_size.clamp(1, 100);

    // Parse entity type filter
    let entity_type_filter = query
        .entity_type
        .as_ref()
        .and_then(|t| TrashEntityType::from_str(t));

    // Parse cursor (RFC3339 timestamp)
    let cursor: Option<DateTime<Utc>> = query
        .cursor
        .as_ref()
        .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let result = get_trash_items(
        &state.db,
        tenant_id,
        entity_type_filter.as_ref(),
        cursor,
        page_size,
    )
    .await
    .map_err(|e| AppError::InternalError(format!("Failed to fetch trash items: {}", e)))?;

    Ok(Json(result))
}

/// POST /api/admin/trash/restore
///
/// Restore an item from trash.
/// Requires Admin role.
async fn restore_item(
    State(state): State<AppState>,
    admin: AdminUser,
    Json(body): Json<RestoreRequest>,
) -> Result<Json<TrashOperationResponse>> {
    let user_id = admin.0.user_id;
    let tenant_id = admin.0.tenant_id;

    let entity_type = TrashEntityType::from_str(&body.entity_type).ok_or_else(|| {
        AppError::BadRequest(format!("Invalid entity type: {}", body.entity_type))
    })?;

    // Verify entity belongs to tenant
    verify_entity_tenant(&state, &entity_type, body.entity_id, tenant_id).await?;

    restore_from_trash(&state.db, &entity_type, body.entity_id, user_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to restore: {}", e)))?;

    Ok(Json(TrashOperationResponse {
        success: true,
        message: format!("{} restored successfully", entity_type.as_str()),
    }))
}

/// DELETE /api/admin/trash/:entity_type/:entity_id
///
/// Permanently delete an item from trash.
/// Requires Admin role.
async fn delete_item(
    State(state): State<AppState>,
    admin: AdminUser,
    Path((entity_type_str, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<TrashOperationResponse>> {
    let tenant_id = admin.0.tenant_id;

    let entity_type = TrashEntityType::from_str(&entity_type_str)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid entity type: {}", entity_type_str)))?;

    // Verify entity belongs to tenant
    verify_entity_tenant(&state, &entity_type, entity_id, tenant_id).await?;

    let minio = create_minio_service(&state).await;

    permanently_delete(&state.db, &minio, &entity_type, entity_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to delete: {}", e)))?;

    Ok(Json(TrashOperationResponse {
        success: true,
        message: format!("{} permanently deleted", entity_type.as_str()),
    }))
}

/// DELETE /api/admin/trash/empty
///
/// Empty all items from trash (permanent delete).
/// Requires Admin role.
async fn empty_trash(
    State(state): State<AppState>,
    admin: AdminUser,
) -> Result<Json<EmptyTrashResponse>> {
    let tenant_id = admin.0.tenant_id;
    let minio = create_minio_service(&state).await;

    let mut deleted_count = 0;

    // Delete in order: workspaces first (to avoid FK issues), then boards, then tasks
    // Workspaces
    let workspace_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"
        SELECT id FROM workspaces
        WHERE tenant_id = $1 AND deleted_at IS NOT NULL
        "#,
        tenant_id
    )
    .fetch_all(&state.db)
    .await?;

    for ws_id in workspace_ids {
        if let Err(e) =
            permanently_delete(&state.db, &minio, &TrashEntityType::Workspace, ws_id).await
        {
            tracing::warn!(workspace_id = %ws_id, error = %e, "Failed to delete workspace");
        } else {
            deleted_count += 1;
        }
    }

    // Boards (that weren't deleted with workspaces)
    let board_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"
        SELECT id FROM boards
        WHERE tenant_id = $1 AND deleted_at IS NOT NULL
        "#,
        tenant_id
    )
    .fetch_all(&state.db)
    .await?;

    for board_id in board_ids {
        if let Err(e) =
            permanently_delete(&state.db, &minio, &TrashEntityType::Board, board_id).await
        {
            tracing::warn!(board_id = %board_id, error = %e, "Failed to delete board");
        } else {
            deleted_count += 1;
        }
    }

    // Tasks (that weren't deleted with boards)
    let task_ids: Vec<Uuid> = sqlx::query_scalar!(
        r#"
        SELECT id FROM tasks
        WHERE tenant_id = $1 AND deleted_at IS NOT NULL
        "#,
        tenant_id
    )
    .fetch_all(&state.db)
    .await?;

    for task_id in task_ids {
        if let Err(e) = permanently_delete(&state.db, &minio, &TrashEntityType::Task, task_id).await
        {
            tracing::warn!(task_id = %task_id, error = %e, "Failed to delete task");
        } else {
            deleted_count += 1;
        }
    }

    Ok(Json(EmptyTrashResponse {
        success: true,
        deleted_count,
        message: format!("Permanently deleted {} items", deleted_count),
    }))
}

/// Verify that an entity belongs to the specified tenant
async fn verify_entity_tenant(
    state: &AppState,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
    tenant_id: Uuid,
) -> Result<()> {
    let exists = match entity_type {
        TrashEntityType::Task => {
            sqlx::query_scalar!(
                r#"SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND tenant_id = $2) as "exists!""#,
                entity_id,
                tenant_id
            )
            .fetch_one(&state.db)
            .await?
        }
        TrashEntityType::Board => {
            sqlx::query_scalar!(
                r#"SELECT EXISTS(SELECT 1 FROM boards WHERE id = $1 AND tenant_id = $2) as "exists!""#,
                entity_id,
                tenant_id
            )
            .fetch_one(&state.db)
            .await?
        }
        TrashEntityType::Workspace => {
            sqlx::query_scalar!(
                r#"SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1 AND tenant_id = $2) as "exists!""#,
                entity_id,
                tenant_id
            )
            .fetch_one(&state.db)
            .await?
        }
    };

    if !exists {
        return Err(AppError::NotFound(format!(
            "{} not found",
            entity_type.as_str()
        )));
    }

    Ok(())
}

/// Create the admin trash router
pub fn admin_trash_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/admin/trash", get(list_trash))
        .route("/admin/trash/restore", post(restore_item))
        .route(
            "/admin/trash/{entity_type}/{entity_id}",
            delete(delete_item),
        )
        .route("/admin/trash/empty", delete(empty_trash))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_page_size() {
        assert_eq!(default_page_size(), 20);
    }

    #[test]
    fn test_restore_request_deserialize() {
        let json =
            r#"{"entity_type": "task", "entity_id": "550e8400-e29b-41d4-a716-446655440000"}"#;
        let req: RestoreRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.entity_type, "task");
    }
}
