//! My Tasks API routes
//!
//! Provides endpoints for viewing tasks assigned to the current user.

use axum::{
    Json, Router,
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::Result;
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::queries::my_tasks::{
    MyTasksSortBy, MyTasksSummary, PaginatedMyTasks, SortOrder, list_my_tasks, my_tasks_summary,
};

/// Query parameters for listing my tasks
#[derive(Debug, Deserialize)]
pub struct ListMyTasksQuery {
    #[serde(default)]
    pub sort_by: MyTasksSortBy,
    #[serde(default)]
    pub sort_order: SortOrder,
    pub board_id: Option<Uuid>,
    pub cursor: Option<Uuid>,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

/// GET /api/my-tasks
///
/// List all tasks assigned to the current user across all boards.
/// Supports filtering by board, sorting, and cursor-based pagination.
async fn list_my_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<ListMyTasksQuery>,
) -> Result<Json<PaginatedMyTasks>> {
    let limit = query.limit.clamp(1, 100);
    let tasks = list_my_tasks(
        &state.db,
        tenant.user_id,
        query.sort_by,
        query.sort_order,
        query.board_id,
        query.cursor,
        limit,
    )
    .await?;

    Ok(Json(tasks))
}

/// GET /api/my-tasks/summary
///
/// Get summary statistics for tasks assigned to the current user.
/// Returns total assigned, due soon, overdue, and completed this week counts.
async fn get_my_tasks_summary(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<MyTasksSummary>> {
    let summary = my_tasks_summary(&state.db, tenant.user_id).await?;

    Ok(Json(summary))
}

/// Create the my tasks router
///
/// Routes:
/// - GET / - List my tasks with pagination
/// - GET /summary - Get task summary statistics
pub fn my_tasks_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_my_tasks_handler))
        .route("/summary", get(get_my_tasks_summary))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
