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
use taskflow_db::queries::{
    get_task_project_id, list_reminders_for_task, remove_reminder, set_reminder, ReminderInfo,
};

use super::task_helpers::verify_project_membership;

#[derive(Deserialize)]
pub struct SetReminderRequest {
    pub remind_before_minutes: i32,
}

/// POST /api/tasks/:id/reminders
pub async fn set_reminder_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<SetReminderRequest>,
) -> Result<Json<serde_json::Value>> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    if !verify_project_membership(&state.db, project_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let reminder = set_reminder(
        &state.db,
        task_id,
        tenant.user_id,
        body.remind_before_minutes,
    )
    .await?;

    Ok(Json(json!({ "success": true, "id": reminder.id })))
}

/// GET /api/tasks/:id/reminders
pub async fn list_reminders_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<ReminderInfo>>> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    if !verify_project_membership(&state.db, project_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let reminders = list_reminders_for_task(&state.db, task_id, tenant.user_id).await?;

    Ok(Json(reminders))
}

/// DELETE /api/tasks/:id/reminders/:reminder_id
pub async fn remove_reminder_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, reminder_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    if !verify_project_membership(&state.db, project_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    remove_reminder(&state.db, reminder_id, tenant.user_id).await?;

    Ok(Json(json!({ "success": true })))
}
