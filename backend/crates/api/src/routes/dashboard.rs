//! Dashboard API routes
//!
//! Provides endpoints for dashboard statistics and recent activity feed.

use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use serde::Deserialize;

use crate::errors::Result;
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::dashboard::{
    get_dashboard_stats, get_recent_activity, get_tasks_by_status, get_tasks_by_priority,
    get_overdue_tasks, get_completion_trend, get_upcoming_deadlines,
    DashboardActivityEntry, DashboardStats, TasksByStatus, TasksByPriority,
    OverdueTask, CompletionTrendPoint, UpcomingDeadline,
};

/// Query parameters for recent activity
#[derive(Debug, Deserialize)]
pub struct RecentActivityQuery {
    /// Number of entries to return (default 10, max 20)
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    10
}

/// Query parameters for trend data
#[derive(Debug, Deserialize)]
pub struct TrendQuery {
    /// Number of days to look back (default 30, max 90)
    #[serde(default = "default_trend_days")]
    pub days: i64,
}

fn default_trend_days() -> i64 {
    30
}

/// Query parameters for upcoming deadlines
#[derive(Debug, Deserialize)]
pub struct DeadlinesQuery {
    /// Number of days to look ahead (default 14)
    #[serde(default = "default_deadline_days")]
    pub days: i64,
}

fn default_deadline_days() -> i64 {
    14
}

/// GET /api/dashboard/stats
///
/// Returns dashboard statistics for the authenticated user:
/// - total_tasks: Total tasks assigned to the user
/// - overdue: Tasks past their due date (not in done columns)
/// - completed_this_week: Tasks completed in the last 7 days
/// - due_today: Tasks due today
async fn get_stats_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<DashboardStats>> {
    let stats = get_dashboard_stats(&state.db, tenant.user_id).await?;
    Ok(Json(stats))
}

/// GET /api/dashboard/recent-activity
///
/// Returns the most recent activity log entries for the user's tenant.
/// Query parameters:
/// - limit: Number of entries to return (default 10, max 20)
async fn get_recent_activity_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<RecentActivityQuery>,
) -> Result<Json<Vec<DashboardActivityEntry>>> {
    let activity = get_recent_activity(
        &state.db,
        tenant.user_id,
        tenant.tenant_id,
        query.limit,
    )
    .await?;
    Ok(Json(activity))
}

/// GET /api/dashboard/tasks-by-status
async fn get_tasks_by_status_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<Vec<TasksByStatus>>> {
    let data = get_tasks_by_status(&state.db, tenant.user_id).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/tasks-by-priority
async fn get_tasks_by_priority_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<Vec<TasksByPriority>>> {
    let data = get_tasks_by_priority(&state.db, tenant.user_id).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/overdue-tasks
async fn get_overdue_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<RecentActivityQuery>,
) -> Result<Json<Vec<OverdueTask>>> {
    let data = get_overdue_tasks(&state.db, tenant.user_id, query.limit).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/completion-trend
async fn get_completion_trend_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<TrendQuery>,
) -> Result<Json<Vec<CompletionTrendPoint>>> {
    let data = get_completion_trend(&state.db, tenant.user_id, query.days).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/upcoming-deadlines
async fn get_upcoming_deadlines_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<DeadlinesQuery>,
) -> Result<Json<Vec<UpcomingDeadline>>> {
    let data = get_upcoming_deadlines(&state.db, tenant.user_id, query.days).await?;
    Ok(Json(data))
}

/// Create the dashboard router
///
/// Routes:
/// - GET /stats - Get dashboard statistics
/// - GET /recent-activity - Get recent activity feed
/// - GET /tasks-by-status - Get tasks grouped by status (for donut chart)
/// - GET /tasks-by-priority - Get tasks grouped by priority (for bar chart)
/// - GET /overdue-tasks - Get overdue tasks table
/// - GET /completion-trend - Get completion trend over time (for line chart)
/// - GET /upcoming-deadlines - Get upcoming deadlines
pub fn dashboard_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/stats", get(get_stats_handler))
        .route("/recent-activity", get(get_recent_activity_handler))
        .route("/tasks-by-status", get(get_tasks_by_status_handler))
        .route("/tasks-by-priority", get(get_tasks_by_priority_handler))
        .route("/overdue-tasks", get(get_overdue_tasks_handler))
        .route("/completion-trend", get(get_completion_trend_handler))
        .route("/upcoming-deadlines", get(get_upcoming_deadlines_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_limit() {
        assert_eq!(default_limit(), 10);
    }

    #[test]
    fn test_query_params_defaults() {
        let json = r#"{}"#;
        let query: RecentActivityQuery = serde_json::from_str(json).unwrap();
        assert_eq!(query.limit, 10);
    }

    #[test]
    fn test_query_params_custom_limit() {
        let json = r#"{"limit": 15}"#;
        let query: RecentActivityQuery = serde_json::from_str(json).unwrap();
        assert_eq!(query.limit, 15);
    }
}
