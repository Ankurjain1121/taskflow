use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskflow_db::queries::{add_watcher, get_task_board_id, remove_watcher, TaskQueryError};

use super::task_helpers::verify_board_membership;

#[derive(Deserialize)]
pub struct AddWatcherRequest {
    pub user_id: Uuid,
}

/// POST /api/tasks/:id/watchers
pub async fn add_watcher_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<AddWatcherRequest>,
) -> Result<Json<serde_json::Value>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    add_watcher(&state.db, task_id, body.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
        })?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/:id/watchers/:user_id
pub async fn remove_watcher_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    remove_watcher(&state.db, task_id, user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Watcher not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
        })?;

    Ok(Json(json!({ "success": true })))
}
