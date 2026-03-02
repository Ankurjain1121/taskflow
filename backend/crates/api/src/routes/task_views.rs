//! Alternative task view handlers (list, calendar, gantt)

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskflow_db::queries::{
    list_tasks_flat, list_tasks_for_calendar, list_tasks_for_gantt, CalendarTask, GanttTask,
    TaskListItem, TaskQueryError,
};

/// Query params for calendar endpoint
#[derive(Deserialize)]
pub struct CalendarQuery {
    pub start: chrono::DateTime<chrono::Utc>,
    pub end: chrono::DateTime<chrono::Utc>,
}

/// GET /api/boards/:board_id/tasks/list
/// List all tasks for a board as a flat list with column names
pub async fn list_tasks_flat_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<TaskListItem>>> {
    let tasks = list_tasks_flat(&state.db, board_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Board not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
        })?;
    Ok(Json(tasks))
}

/// GET /api/boards/{board_id}/tasks/calendar?start=&end=
pub async fn list_calendar_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Query(query): Query<CalendarQuery>,
) -> Result<Json<Vec<CalendarTask>>> {
    let tasks =
        list_tasks_for_calendar(&state.db, board_id, tenant.user_id, query.start, query.end)
            .await
            .map_err(|e| match e {
                TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
                TaskQueryError::NotFound => AppError::NotFound("Board not found".into()),
                TaskQueryError::Database(e) => AppError::SqlxError(e),
                TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
            })?;
    Ok(Json(tasks))
}

/// GET /api/boards/{board_id}/tasks/gantt
pub async fn list_gantt_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<GanttTask>>> {
    let tasks = list_tasks_for_gantt(&state.db, board_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Board not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
        })?;
    Ok(Json(tasks))
}
