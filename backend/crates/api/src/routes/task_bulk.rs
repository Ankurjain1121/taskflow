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

/// Request body for bulk update
#[derive(Deserialize)]
pub struct BulkUpdateRequest {
    pub task_ids: Vec<Uuid>,
    pub column_id: Option<Uuid>,
    pub priority: Option<TaskPriority>,
    pub milestone_id: Option<Uuid>,
    pub clear_milestone: Option<bool>,
    pub group_id: Option<Uuid>,
    pub clear_group: Option<bool>,
}

/// Request body for bulk delete
#[derive(Deserialize)]
pub struct BulkDeleteRequest {
    pub task_ids: Vec<Uuid>,
}

/// POST /projects/{project_id}/tasks/bulk-update
pub async fn bulk_update_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(project_id): Path<Uuid>,
    Json(req): Json<BulkUpdateRequest>,
) -> Result<Json<serde_json::Value>> {
    let input = BulkUpdateInput {
        task_ids: req.task_ids,
        column_id: req.column_id,
        priority: req.priority,
        milestone_id: req.milestone_id,
        clear_milestone: req.clear_milestone,
        group_id: req.group_id,
        clear_group: req.clear_group,
    };

    let updated = bulk_update_tasks(&state.db, project_id, ctx.user_id, input)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    Ok(Json(json!({ "updated": updated })))
}

/// POST /projects/{project_id}/tasks/bulk-delete
pub async fn bulk_delete_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(project_id): Path<Uuid>,
    Json(req): Json<BulkDeleteRequest>,
) -> Result<Json<serde_json::Value>> {
    let deleted = bulk_delete_tasks(&state.db, project_id, ctx.user_id, &req.task_ids)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    Ok(Json(json!({ "deleted": deleted })))
}
