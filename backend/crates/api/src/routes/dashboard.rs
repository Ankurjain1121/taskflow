//! Dashboard API routes
//!
//! Provides endpoints for dashboard statistics and recent activity feed.
//! All endpoints support optional `workspace_id` query param for filtering.

use axum::{
    extract::{Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

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

/// Common workspace filter applied to all dashboard endpoints
#[derive(Debug, Deserialize)]
pub struct DashboardFilter {
    pub workspace_id: Option<Uuid>,
}

/// Query parameters for recent activity
#[derive(Debug, Deserialize)]
pub struct RecentActivityQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub workspace_id: Option<Uuid>,
}

fn default_limit() -> i64 {
    10
}

/// Query parameters for trend data
#[derive(Debug, Deserialize)]
pub struct TrendQuery {
    #[serde(default = "default_trend_days")]
    pub days: i64,
    pub workspace_id: Option<Uuid>,
}

fn default_trend_days() -> i64 {
    30
}

/// Query parameters for upcoming deadlines
#[derive(Debug, Deserialize)]
pub struct DeadlinesQuery {
    #[serde(default = "default_deadline_days")]
    pub days: i64,
    pub workspace_id: Option<Uuid>,
}

fn default_deadline_days() -> i64 {
    14
}

/// GET /api/dashboard/stats
async fn get_stats_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(filter): Query<DashboardFilter>,
) -> Result<Json<DashboardStats>> {
    let stats = get_dashboard_stats(&state.db, tenant.user_id, filter.workspace_id).await?;
    Ok(Json(stats))
}

/// GET /api/dashboard/recent-activity
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
        query.workspace_id,
    )
    .await?;
    Ok(Json(activity))
}

/// GET /api/dashboard/tasks-by-status
async fn get_tasks_by_status_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(filter): Query<DashboardFilter>,
) -> Result<Json<Vec<TasksByStatus>>> {
    let data = get_tasks_by_status(&state.db, tenant.user_id, filter.workspace_id).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/tasks-by-priority
async fn get_tasks_by_priority_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(filter): Query<DashboardFilter>,
) -> Result<Json<Vec<TasksByPriority>>> {
    let data = get_tasks_by_priority(&state.db, tenant.user_id, filter.workspace_id).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/overdue-tasks
async fn get_overdue_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<RecentActivityQuery>,
) -> Result<Json<Vec<OverdueTask>>> {
    let data = get_overdue_tasks(&state.db, tenant.user_id, query.limit, query.workspace_id).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/completion-trend
async fn get_completion_trend_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<TrendQuery>,
) -> Result<Json<Vec<CompletionTrendPoint>>> {
    let data = get_completion_trend(&state.db, tenant.user_id, query.days, query.workspace_id).await?;
    Ok(Json(data))
}

/// GET /api/dashboard/upcoming-deadlines
async fn get_upcoming_deadlines_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<DeadlinesQuery>,
) -> Result<Json<Vec<UpcomingDeadline>>> {
    let data = get_upcoming_deadlines(&state.db, tenant.user_id, query.days, query.workspace_id).await?;
    Ok(Json(data))
}

/// Create the dashboard router
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
        assert!(query.workspace_id.is_none());
    }

    #[test]
    fn test_query_params_with_workspace_id() {
        let json = r#"{"limit": 15, "workspace_id": "550e8400-e29b-41d4-a716-446655440000"}"#;
        let query: RecentActivityQuery = serde_json::from_str(json).unwrap();
        assert_eq!(query.limit, 15);
        assert!(query.workspace_id.is_some());
    }

    #[test]
    fn test_dashboard_filter_empty() {
        let json = r#"{}"#;
        let filter: DashboardFilter = serde_json::from_str(json).unwrap();
        assert!(filter.workspace_id.is_none());
    }
}
