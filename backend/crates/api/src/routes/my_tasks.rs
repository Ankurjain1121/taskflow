//! My Tasks API routes
//!
//! Provides endpoints for viewing tasks assigned to the current user.

use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::Result;
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::my_tasks::{
    list_my_tasks, my_tasks_summary, MyTasksSortBy, MyTasksSummary, PaginatedMyTasks, SortOrder,
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
    let tasks = list_my_tasks(
        &state.db,
        tenant.user_id,
        query.sort_by,
        query.sort_order,
        query.board_id,
        query.cursor,
        query.limit,
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
pub fn my_tasks_router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_my_tasks_handler))
        .route("/summary", get(get_my_tasks_summary))
        .layer(axum::middleware::from_fn(auth_middleware))
}
