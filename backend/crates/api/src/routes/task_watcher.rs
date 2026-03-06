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
use taskflow_db::queries::{add_watcher, get_task_project_id, remove_watcher};

use super::task_helpers::verify_project_membership;

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
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    if !verify_project_membership(&state.db, project_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    add_watcher(&state.db, task_id, body.user_id).await?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/:id/watchers/:user_id
pub async fn remove_watcher_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    if !verify_project_membership(&state.db, project_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    remove_watcher(&state.db, task_id, user_id).await?;

    Ok(Json(json!({ "success": true })))
}
