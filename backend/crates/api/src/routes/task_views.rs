//! Alternative task view handlers (list, calendar, gantt)

use axum::{
    Json,
    extract::{Path, Query, State},
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::Result;
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskbolt_db::queries::{
    CalendarTask, GanttTask, TaskListItem, list_tasks_flat, list_tasks_for_calendar,
    list_tasks_for_gantt,
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
    let tasks = list_tasks_flat(&state.db, board_id, tenant.user_id).await?;
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
            .await?;
    Ok(Json(tasks))
}

/// GET /api/boards/{board_id}/tasks/gantt
pub async fn list_gantt_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<GanttTask>>> {
    let tasks = list_tasks_for_gantt(&state.db, board_id, tenant.user_id).await?;
    Ok(Json(tasks))
}
