//! Read-only Status Timeline route for a task.
//!
//! Exposes `GET /api/tasks/{task_id}/status-timeline` which returns every
//! recorded `status_changed` activity log entry for the task in chronological
//! order (oldest first). Consumers render this as a vertical timeline on the
//! task detail page.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::verify_project_membership;
use taskbolt_db::queries::activity_log::{list_task_status_timeline, StatusTimelineEntry};
use taskbolt_db::queries::tasks::get_task_project_id;

/// GET /api/tasks/{task_id}/status-timeline
async fn get_status_timeline_for_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<StatusTimelineEntry>>> {
    // 1. Resolve project (404 if task missing / soft-deleted).
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // 2. Authorize: caller must be a project member (or workspace admin).
    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    // 3. Fetch chronological timeline (may be empty — that's fine).
    let entries = list_task_status_timeline(&state.db, task_id).await?;
    Ok(Json(entries))
}

pub fn task_status_timeline_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/tasks/{task_id}/status-timeline",
            get(get_status_timeline_for_task),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
