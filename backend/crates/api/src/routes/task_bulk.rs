//! Bulk task operations (update, delete)

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
use taskflow_db::models::TaskPriority;
use taskflow_db::queries::{bulk_delete_tasks, bulk_update_tasks, BulkUpdateInput, TaskQueryError};

const MAX_BULK_TASK_IDS: usize = 200;

/// Request body for bulk update
#[derive(Deserialize)]
pub struct BulkUpdateRequest {
    pub task_ids: Vec<Uuid>,
    pub status_id: Option<Uuid>,
    pub priority: Option<TaskPriority>,
    pub milestone_id: Option<Uuid>,
    pub clear_milestone: Option<bool>,
    pub task_list_id: Option<Uuid>,
    pub clear_task_list: Option<bool>,
}

/// Request body for bulk delete
#[derive(Deserialize)]
pub struct BulkDeleteRequest {
    pub task_ids: Vec<Uuid>,
}

/// POST /boards/{board_id}/tasks/bulk-update
pub async fn bulk_update_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(req): Json<BulkUpdateRequest>,
) -> Result<Json<serde_json::Value>> {
    if req.task_ids.len() > MAX_BULK_TASK_IDS {
        return Err(AppError::BadRequest(format!(
            "Bulk update is limited to {} tasks at a time",
            MAX_BULK_TASK_IDS
        )));
    }

    let input = BulkUpdateInput {
        task_ids: req.task_ids,
        status_id: req.status_id,
        priority: req.priority,
        milestone_id: req.milestone_id,
        clear_milestone: req.clear_milestone,
        task_list_id: req.task_list_id,
        clear_task_list: req.clear_task_list,
    };

    let updated = bulk_update_tasks(&state.db, board_id, ctx.user_id, input)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    Ok(Json(json!({ "updated": updated })))
}

/// POST /boards/{board_id}/tasks/bulk-delete
pub async fn bulk_delete_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(req): Json<BulkDeleteRequest>,
) -> Result<Json<serde_json::Value>> {
    if req.task_ids.len() > MAX_BULK_TASK_IDS {
        return Err(AppError::BadRequest(format!(
            "Bulk delete is limited to {} tasks at a time",
            MAX_BULK_TASK_IDS
        )));
    }

    let deleted = bulk_delete_tasks(&state.db, board_id, ctx.user_id, &req.task_ids)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    Ok(Json(json!({ "deleted": deleted })))
}
