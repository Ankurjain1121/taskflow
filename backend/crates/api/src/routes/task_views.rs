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
    list_tasks_enhanced, list_tasks_flat, list_tasks_for_calendar, list_tasks_for_gantt,
    CalendarTask, GanttTask, ListTasksParams, PaginatedTaskList, TaskListItem,
};

/// Query params for calendar endpoint
#[derive(Deserialize)]
pub struct CalendarQuery {
    pub start: chrono::DateTime<chrono::Utc>,
    pub end: chrono::DateTime<chrono::Utc>,
}

/// Query params for the enhanced list endpoint
#[derive(Deserialize)]
pub struct TaskListQuery {
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub search: Option<String>,
    pub priority: Option<String>,
    pub assignee_ids: Option<String>,
    pub column_ids: Option<String>,
    pub label_ids: Option<String>,
    pub overdue: Option<bool>,
}

/// GET /api/projects/:project_id/tasks/list
/// List all tasks for a project as a flat list with column names
pub async fn list_tasks_flat_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<TaskListItem>>> {
    let tasks = list_tasks_flat(&state.db, project_id, tenant.user_id).await?;
    Ok(Json(tasks))
}

/// GET /api/projects/{project_id}/tasks/list-enhanced
/// Enhanced list with filtering, sorting, pagination, and enriched data
pub async fn list_tasks_enhanced_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    Query(query): Query<TaskListQuery>,
) -> Result<Json<PaginatedTaskList>> {
    let page_size = query.page_size.unwrap_or(50).clamp(1, 200);
    let page = query.page.unwrap_or(1).max(1);

    let priorities: Vec<String> = query
        .priority
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| s.split(',').map(|p| p.trim().to_string()).collect())
        .unwrap_or_default();

    let assignee_ids: Vec<Uuid> = query
        .assignee_ids
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            s.split(',')
                .filter_map(|id| id.trim().parse::<Uuid>().ok())
                .collect()
        })
        .unwrap_or_default();

    let column_ids: Vec<Uuid> = query
        .column_ids
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            s.split(',')
                .filter_map(|id| id.trim().parse::<Uuid>().ok())
                .collect()
        })
        .unwrap_or_default();

    let label_ids: Vec<Uuid> = query
        .label_ids
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| {
            s.split(',')
                .filter_map(|id| id.trim().parse::<Uuid>().ok())
                .collect()
        })
        .unwrap_or_default();

    let params = ListTasksParams {
        sort_by: query.sort_by.unwrap_or_else(|| "created_at".to_string()),
        sort_order: query.sort_order.unwrap_or_else(|| "desc".to_string()),
        page,
        page_size,
        search: query.search,
        priorities,
        assignee_ids,
        column_ids,
        label_ids,
        overdue: query.overdue.unwrap_or(false),
    };

    let result = list_tasks_enhanced(&state.db, project_id, tenant.user_id, params).await?;
    Ok(Json(result))
}

/// GET /api/projects/{project_id}/tasks/calendar?start=&end=
pub async fn list_calendar_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    Query(query): Query<CalendarQuery>,
) -> Result<Json<Vec<CalendarTask>>> {
    let tasks = list_tasks_for_calendar(
        &state.db,
        project_id,
        tenant.user_id,
        query.start,
        query.end,
    )
    .await?;
    Ok(Json(tasks))
}

/// GET /api/projects/{project_id}/tasks/gantt
pub async fn list_gantt_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<GanttTask>>> {
    let tasks = list_tasks_for_gantt(&state.db, project_id, tenant.user_id).await?;
    Ok(Json(tasks))
}
