//! Task Snooze API routes
//!
//! Endpoints for snoozing and unsnoozing tasks in the my-tasks view.

use axum::{
    Json, Router,
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::post,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::queries::task_snooze::{self, SnoozeTaskInput, TaskSnooze, TaskSnoozeError};

/// POST /api/my-tasks/:task_id/snooze
///
/// Snooze a task until a given date.
async fn snooze_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(input): Json<SnoozeTaskInput>,
) -> Result<Json<TaskSnooze>> {
    let snooze = task_snooze::snooze_task(&state.db, tenant.user_id, task_id, &input)
        .await
        .map_err(map_snooze_error)?;

    Ok(Json(snooze))
}

/// DELETE /api/my-tasks/:task_id/snooze
///
/// Unsnooze a task.
async fn unsnooze_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    task_snooze::unsnooze_task(&state.db, tenant.user_id, task_id)
        .await
        .map_err(map_snooze_error)?;

    Ok(Json(serde_json::json!({ "message": "Task unsnoozed" })))
}

/// Map TaskSnoozeError to AppError
fn map_snooze_error(e: TaskSnoozeError) -> AppError {
    match e {
        TaskSnoozeError::NotFound => AppError::NotFound("Snooze not found".into()),
        TaskSnoozeError::TaskNotAccessible => {
            AppError::Forbidden("Task not accessible or not found".into())
        }
        TaskSnoozeError::InvalidDate(msg) => AppError::BadRequest(msg),
        TaskSnoozeError::Database(e) => AppError::SqlxError(e),
    }
}

/// Build the task snooze router
pub fn task_snooze_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/my-tasks/{task_id}/snooze",
            post(snooze_task_handler).delete(unsnooze_task_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
