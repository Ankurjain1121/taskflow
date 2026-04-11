//! Dashboard API routes
//!
//! Provides endpoints for dashboard statistics and recent activity feed.
//! All endpoints support optional `workspace_id` query param for filtering.

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
use crate::services::cache;
use crate::state::AppState;
use taskbolt_db::queries::dashboard::{
    CompletionTrendPoint, DashboardActivityEntry, DashboardStats, FocusTask, OverdueTask,
    ProjectPulse, TasksByPriority, TasksByStatus, UpcomingDeadline, UserStreak,
    get_completion_trend, get_dashboard_stats, get_focus_tasks, get_overdue_tasks,
    get_project_pulse, get_recent_activity, get_tasks_by_priority, get_tasks_by_status,
    get_upcoming_deadlines, get_user_streak,
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
    // Check Redis cache first (30s TTL)
    let cache_key = cache::dashboard_stats_key(&tenant.user_id, filter.workspace_id.as_ref());
    if let Some(cached) = cache::cache_get::<DashboardStats>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let stats = get_dashboard_stats(&state.db, tenant.user_id, filter.workspace_id).await?;

    // Store in cache (30 second TTL)
    cache::cache_set(&state.redis, &cache_key, &stats, 30).await;

    Ok(Json(stats))
}

/// GET /api/dashboard/recent-activity
async fn get_recent_activity_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<RecentActivityQuery>,
) -> Result<Json<Vec<DashboardActivityEntry>>> {
    let limit = query.limit.clamp(1, 50);
    let ws_str = query
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!(
        "dashboard:{}:{}:recent-activity:{}",
        tenant.user_id, ws_str, limit
    );
    if let Some(cached) =
        cache::cache_get::<Vec<DashboardActivityEntry>>(&state.redis, &cache_key).await
    {
        return Ok(Json(cached));
    }

    let activity = get_recent_activity(
        &state.db,
        tenant.user_id,
        tenant.tenant_id,
        limit,
        query.workspace_id,
    )
    .await?;

    cache::cache_set(&state.redis, &cache_key, &activity, 30).await;
    Ok(Json(activity))
}

/// GET /api/dashboard/tasks-by-status
async fn get_tasks_by_status_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(filter): Query<DashboardFilter>,
) -> Result<Json<Vec<TasksByStatus>>> {
    let ws_str = filter
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!("dashboard:{}:{}:tasks-by-status", tenant.user_id, ws_str);
    if let Some(cached) = cache::cache_get::<Vec<TasksByStatus>>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let data = get_tasks_by_status(&state.db, tenant.user_id, filter.workspace_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
    Ok(Json(data))
}

/// GET /api/dashboard/tasks-by-priority
async fn get_tasks_by_priority_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(filter): Query<DashboardFilter>,
) -> Result<Json<Vec<TasksByPriority>>> {
    let ws_str = filter
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!("dashboard:{}:{}:tasks-by-priority", tenant.user_id, ws_str);
    if let Some(cached) = cache::cache_get::<Vec<TasksByPriority>>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let data = get_tasks_by_priority(&state.db, tenant.user_id, filter.workspace_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
    Ok(Json(data))
}

/// GET /api/dashboard/overdue-tasks
async fn get_overdue_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<RecentActivityQuery>,
) -> Result<Json<Vec<OverdueTask>>> {
    let limit = query.limit.clamp(1, 50);
    let ws_str = query
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!(
        "dashboard:{}:{}:overdue-tasks:{}",
        tenant.user_id, ws_str, limit
    );
    if let Some(cached) = cache::cache_get::<Vec<OverdueTask>>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let data = get_overdue_tasks(&state.db, tenant.user_id, limit, query.workspace_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
    Ok(Json(data))
}

/// GET /api/dashboard/completion-trend
async fn get_completion_trend_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<TrendQuery>,
) -> Result<Json<Vec<CompletionTrendPoint>>> {
    let days = query.days.clamp(1, 365);
    let ws_str = query
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!(
        "dashboard:{}:{}:completion-trend:{}",
        tenant.user_id, ws_str, days
    );
    if let Some(cached) =
        cache::cache_get::<Vec<CompletionTrendPoint>>(&state.redis, &cache_key).await
    {
        return Ok(Json(cached));
    }

    let data = get_completion_trend(&state.db, tenant.user_id, days, query.workspace_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
    Ok(Json(data))
}

/// GET /api/dashboard/upcoming-deadlines
async fn get_upcoming_deadlines_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(query): Query<DeadlinesQuery>,
) -> Result<Json<Vec<UpcomingDeadline>>> {
    let days = query.days.clamp(1, 365);
    let ws_str = query
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!(
        "dashboard:{}:{}:upcoming-deadlines:{}",
        tenant.user_id, ws_str, days
    );
    if let Some(cached) = cache::cache_get::<Vec<UpcomingDeadline>>(&state.redis, &cache_key).await
    {
        return Ok(Json(cached));
    }

    let data = get_upcoming_deadlines(&state.db, tenant.user_id, days, query.workspace_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
    Ok(Json(data))
}

/// GET /api/dashboard/focus-tasks
async fn get_focus_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(filter): Query<DashboardFilter>,
) -> Result<Json<Vec<FocusTask>>> {
    let ws_str = filter
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!("dashboard:{}:{}:focus-tasks", tenant.user_id, ws_str);
    if let Some(cached) = cache::cache_get::<Vec<FocusTask>>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let data = get_focus_tasks(&state.db, tenant.user_id, filter.workspace_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
    Ok(Json(data))
}

/// GET /api/dashboard/project-pulse
async fn get_project_pulse_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(filter): Query<DashboardFilter>,
) -> Result<Json<Vec<ProjectPulse>>> {
    let ws_str = filter
        .workspace_id
        .map_or("all".to_string(), |id| id.to_string());
    let cache_key = format!("dashboard:{}:{}:project-pulse", tenant.user_id, ws_str);
    if let Some(cached) = cache::cache_get::<Vec<ProjectPulse>>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let data = get_project_pulse(&state.db, tenant.user_id, filter.workspace_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
    Ok(Json(data))
}

/// GET /api/dashboard/streak
async fn get_streak_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<UserStreak>> {
    let cache_key = format!("dashboard:{}:streak", tenant.user_id);
    if let Some(cached) = cache::cache_get::<UserStreak>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let data = get_user_streak(&state.db, tenant.user_id).await?;

    cache::cache_set(&state.redis, &cache_key, &data, 30).await;
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
        .route("/focus-tasks", get(get_focus_tasks_handler))
        .route("/project-pulse", get(get_project_pulse_handler))
        .route("/streak", get(get_streak_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
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
