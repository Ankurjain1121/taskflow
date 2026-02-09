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
    get_dashboard_stats, get_recent_activity, DashboardActivityEntry, DashboardStats,
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

/// Create the dashboard router
///
/// Routes:
/// - GET /stats - Get dashboard statistics
/// - GET /recent-activity - Get recent activity feed
pub fn dashboard_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/stats", get(get_stats_handler))
        .route("/recent-activity", get(get_recent_activity_handler))
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
