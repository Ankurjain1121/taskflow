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
use crate::extractors::{AdminUser, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::archive::{list_archive, PaginatedArchive};
use taskflow_services::minio::{MinioConfig, MinioService};
use taskflow_services::trash_bin::{permanently_delete, restore_from_trash, TrashEntityType};

/// Query parameters for archive listing
#[derive(Debug, Deserialize)]
pub struct ArchiveListQuery {
    pub entity_type: Option<String>,
    pub cursor: Option<String>,
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

/// Response for archive operations
#[derive(Debug, Serialize)]
pub struct ArchiveOperationResponse {
    pub success: bool,
    pub message: String,
}

/// GET /api/archive
///
/// List soft-deleted items for the current tenant.
async fn list_archive_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<ArchiveListQuery>,
) -> Result<Json<PaginatedArchive>> {
    let page_size = query.page_size.clamp(1, 100);

    let cursor: Option<DateTime<Utc>> = query
        .cursor
        .as_ref()
        .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let result = list_archive(
        &state.db,
        tenant.tenant_id,
        query.entity_type.as_deref(),
        cursor,
        page_size,
    )
    .await
    .map_err(|e| AppError::InternalError(format!("Failed to list archive: {}", e)))?;

    Ok(Json(result))
}

/// POST /api/archive/restore
///
/// Restore a soft-deleted item. Any authenticated user in the tenant can restore.
async fn restore_archive_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Json(body): Json<RestoreRequest>,
) -> Result<Json<ArchiveOperationResponse>> {
    let entity_type = TrashEntityType::from_str(&body.entity_type).ok_or_else(|| {
        AppError::BadRequest(format!("Invalid entity type: {}", body.entity_type))
    })?;

    // Verify entity belongs to tenant
    verify_entity_tenant(&state, &entity_type, body.entity_id, tenant.tenant_id).await?;

    restore_from_trash(&state.db, &entity_type, body.entity_id, tenant.user_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to restore: {}", e)))?;

    Ok(Json(ArchiveOperationResponse {
        success: true,
        message: format!("{} restored successfully", entity_type.as_str()),
    }))
}

/// DELETE /api/archive/{entity_type}/{entity_id}
///
/// Permanently delete an item. Requires Admin role.
async fn delete_archive_handler(
    State(state): State<AppState>,
    admin: AdminUser,
    Path((entity_type_str, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<ArchiveOperationResponse>> {
    let tenant_id = admin.0.tenant_id;

    let entity_type = TrashEntityType::from_str(&entity_type_str)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid entity type: {}", entity_type_str)))?;

    verify_entity_tenant(&state, &entity_type, entity_id, tenant_id).await?;

    let minio = MinioService::new(MinioConfig {
        endpoint: state.config.minio_endpoint.clone(),
        public_url: state.config.minio_public_url.clone(),
        access_key: state.config.minio_access_key.clone(),
        secret_key: state.config.minio_secret_key.clone(),
        bucket: state.config.minio_bucket.clone(),
    })
    .await;

    permanently_delete(&state.db, &minio, &entity_type, entity_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to delete: {}", e)))?;

    Ok(Json(ArchiveOperationResponse {
        success: true,
        message: format!("{} permanently deleted", entity_type.as_str()),
    }))
}

/// Verify that an entity belongs to the specified tenant
async fn verify_entity_tenant(
    state: &AppState,
    entity_type: &TrashEntityType,
    entity_id: Uuid,
    tenant_id: Uuid,
) -> Result<()> {
    let exists: (bool,) = match entity_type {
        TrashEntityType::Task => {
            sqlx::query_as(r#"SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND tenant_id = $2)"#)
                .bind(entity_id)
                .bind(tenant_id)
                .fetch_one(&state.db)
                .await?
        }
        TrashEntityType::Board => {
            sqlx::query_as(
                r#"SELECT EXISTS(SELECT 1 FROM boards WHERE id = $1 AND tenant_id = $2)"#,
            )
            .bind(entity_id)
            .bind(tenant_id)
            .fetch_one(&state.db)
            .await?
        }
        TrashEntityType::Workspace => {
            sqlx::query_as(
                r#"SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = $1 AND tenant_id = $2)"#,
            )
            .bind(entity_id)
            .bind(tenant_id)
            .fetch_one(&state.db)
            .await?
        }
    };

    if !exists.0 {
        return Err(AppError::NotFound(format!(
            "{} not found",
            entity_type.as_str()
        )));
    }

    Ok(())
}

/// Create the archive router
pub fn archive_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/archive", get(list_archive_handler))
        .route("/archive/restore", post(restore_archive_handler))
        .route(
            "/archive/{entity_type}/{entity_id}",
            delete(delete_archive_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
