//! Alternative task view handlers (list, calendar, gantt)

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::Result;
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskflow_db::queries::{
    list_tasks_flat, list_tasks_for_calendar, list_tasks_for_gantt, CalendarTask,
    PaginatedGanttTasks, PaginatedTaskList,
};

/// Query params for calendar endpoint
#[derive(Deserialize)]
pub struct CalendarQuery {
    pub start: chrono::DateTime<chrono::Utc>,
    pub end: chrono::DateTime<chrono::Utc>,
}

/// Query params for paginated list/gantt endpoints
#[derive(Deserialize)]
pub struct PaginatedQuery {
    pub cursor: Option<Uuid>,
    pub limit: Option<i64>,
}

/// GET /api/boards/:board_id/tasks/list
/// List all tasks for a board as a flat list with column names (paginated)
pub async fn list_tasks_flat_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Query(query): Query<PaginatedQuery>,
) -> Result<Json<PaginatedTaskList>> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let tasks = list_tasks_flat(&state.db, board_id, tenant.user_id, query.cursor, limit).await?;
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
    Query(query): Query<PaginatedQuery>,
) -> Result<Json<PaginatedGanttTasks>> {
    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let tasks =
        list_tasks_for_gantt(&state.db, board_id, tenant.user_id, query.cursor, limit).await?;
    Ok(Json(tasks))
}
