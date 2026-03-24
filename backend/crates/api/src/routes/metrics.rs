//! Metrics API routes
//!
//! Provides endpoints for workspace, team, and personal metrics dashboards.
//! Results are cached in Redis with a 120-second TTL.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde::Deserialize;
use sqlx;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::services::cache;
use crate::state::AppState;
use taskbolt_db::queries::metrics::{
    get_personal_dashboard, get_resource_utilization, get_team_dashboard, get_workspace_dashboard,
    PersonalDashboard, ResourceUtilizationRow, TeamDashboard, WorkspaceDashboard,
};

#[derive(Deserialize)]
struct MetricsPeriodQuery {
    period: Option<String>,
}

/// Compute calendar boundaries for a period type.
/// Returns (current_start, prev_start, prev_label).
fn period_boundaries(
    period: &str,
) -> (
    Option<chrono::DateTime<Utc>>,
    Option<chrono::DateTime<Utc>>,
    Option<String>,
) {
    let now = Utc::now();
    match period {
        "week" => {
            let weekday = now.weekday().num_days_from_monday() as i64;
            let this_monday = (now - Duration::days(weekday))
                .date_naive()
                .and_hms_opt(0, 0, 0)
                .expect("valid time")
                .and_utc();
            let prev_monday = this_monday - Duration::days(7);
            (
                Some(this_monday),
                Some(prev_monday),
                Some("last week".into()),
            )
        }
        "month" => {
            let this_start = NaiveDate::from_ymd_opt(now.year(), now.month(), 1)
                .expect("valid date")
                .and_hms_opt(0, 0, 0)
                .expect("valid time")
                .and_utc();
            let prev_month = if now.month() == 1 {
                NaiveDate::from_ymd_opt(now.year() - 1, 12, 1)
            } else {
                NaiveDate::from_ymd_opt(now.year(), now.month() - 1, 1)
            }
            .expect("valid date")
            .and_hms_opt(0, 0, 0)
            .expect("valid time")
            .and_utc();
            let label = prev_month.format("%b").to_string();
            (Some(this_start), Some(prev_month), Some(label))
        }
        "quarter" => {
            let q_month = ((now.month() - 1) / 3) * 3 + 1;
            let this_start = NaiveDate::from_ymd_opt(now.year(), q_month, 1)
                .expect("valid date")
                .and_hms_opt(0, 0, 0)
                .expect("valid time")
                .and_utc();
            let (prev_year, prev_q_month) = if q_month == 1 {
                (now.year() - 1, 10)
            } else {
                (now.year(), q_month - 3)
            };
            let prev_start = NaiveDate::from_ymd_opt(prev_year, prev_q_month, 1)
                .expect("valid date")
                .and_hms_opt(0, 0, 0)
                .expect("valid time")
                .and_utc();
            let q_num = (prev_q_month - 1) / 3 + 1;
            (
                Some(this_start),
                Some(prev_start),
                Some(format!("Q{}", q_num)),
            )
        }
        _ => (None, None, None), // "all" or unknown → no filter
    }
}

/// Cache key for workspace metrics (includes period)
fn workspace_metrics_key(workspace_id: &Uuid, period: &str) -> String {
    format!("cache:metrics:ws:{}:{}", workspace_id, period)
}

/// Cache key for team metrics
fn team_metrics_key(team_id: &Uuid) -> String {
    format!("cache:metrics:team:{}", team_id)
}

/// Cache key for personal metrics
fn personal_metrics_key(user_id: &Uuid) -> String {
    format!("cache:metrics:user:{}", user_id)
}

const METRICS_CACHE_TTL: u64 = 120;

/// GET /api/workspaces/{workspace_id}/metrics/workspace?period=month
///
/// Fetch workspace-level metrics dashboard with cycle time, velocity,
/// on-time %, and workload distribution. Cached for 120 seconds.
/// Period can be: week, month, quarter, all (default: all).
async fn get_workspace_metrics_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<MetricsPeriodQuery>,
) -> Result<Json<WorkspaceDashboard>> {
    // Verify user is a member of this workspace
    let is_member: bool = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)",
    )
    .bind(workspace_id)
    .bind(tenant.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::InternalError(format!("Membership check failed: {}", e)))?;

    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let period = query.period.as_deref().unwrap_or("all");
    let (current_start, prev_start, period_label) = period_boundaries(period);

    let cache_key = workspace_metrics_key(&workspace_id, period);
    if let Some(cached) = cache::cache_get::<WorkspaceDashboard>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let dashboard = get_workspace_dashboard(
        &state.db,
        workspace_id,
        current_start,
        prev_start,
        period_label,
    )
    .await
    .map_err(|e| AppError::InternalError(format!("Workspace metrics failed: {}", e)))?;

    cache::cache_set(&state.redis, &cache_key, &dashboard, METRICS_CACHE_TTL).await;

    Ok(Json(dashboard))
}

/// GET /api/teams/{team_id}/metrics
///
/// Fetch team-level metrics dashboard. Cached for 120 seconds.
async fn get_team_metrics_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(team_id): Path<Uuid>,
) -> Result<Json<TeamDashboard>> {
    // Verify user is a member of the team's workspace
    let is_member: bool = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
            SELECT 1 FROM workspace_members wm
            JOIN teams t ON t.workspace_id = wm.workspace_id
            WHERE t.id = $1 AND wm.user_id = $2
        )"#,
    )
    .bind(team_id)
    .bind(tenant.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::InternalError(format!("Membership check failed: {}", e)))?;

    if !is_member {
        return Err(AppError::Forbidden(
            "Not a member of this team's workspace".into(),
        ));
    }

    let cache_key = team_metrics_key(&team_id);
    if let Some(cached) = cache::cache_get::<TeamDashboard>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let dashboard = get_team_dashboard(&state.db, team_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Team metrics failed: {}", e)))?;

    cache::cache_set(&state.redis, &cache_key, &dashboard, METRICS_CACHE_TTL).await;

    Ok(Json(dashboard))
}

/// GET /api/me/metrics
///
/// Fetch personal metrics dashboard for the authenticated user.
/// Cached for 120 seconds.
async fn get_personal_metrics_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<PersonalDashboard>> {
    let cache_key = personal_metrics_key(&tenant.user_id);
    if let Some(cached) = cache::cache_get::<PersonalDashboard>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let dashboard = get_personal_dashboard(&state.db, tenant.user_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Personal metrics failed: {}", e)))?;

    cache::cache_set(&state.redis, &cache_key, &dashboard, METRICS_CACHE_TTL).await;

    Ok(Json(dashboard))
}

/// GET /api/workspaces/{workspace_id}/resource-utilization
///
/// Per-user resource utilization: estimated hours vs actual logged hours.
/// Cached for 120 seconds.
async fn get_resource_utilization_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<ResourceUtilizationRow>>> {
    let is_member: bool = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2)",
    )
    .bind(workspace_id)
    .bind(tenant.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::InternalError(format!("Membership check failed: {}", e)))?;

    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let cache_key = format!("cache:metrics:utilization:{}", workspace_id);
    if let Some(cached) =
        cache::cache_get::<Vec<ResourceUtilizationRow>>(&state.redis, &cache_key).await
    {
        return Ok(Json(cached));
    }

    let rows = get_resource_utilization(&state.db, workspace_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Resource utilization failed: {}", e)))?;

    cache::cache_set(&state.redis, &cache_key, &rows, METRICS_CACHE_TTL).await;

    Ok(Json(rows))
}

/// Metrics router for workspace and personal endpoints (requires auth)
pub fn metrics_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/workspaces/{workspace_id}/metrics/workspace",
            get(get_workspace_metrics_handler),
        )
        .route("/teams/{team_id}/metrics", get(get_team_metrics_handler))
        .route("/me/metrics", get(get_personal_metrics_handler))
        .route(
            "/workspaces/{workspace_id}/resource-utilization",
            get(get_resource_utilization_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

// metrics_cron_router removed — refresh-metrics endpoint is now in cron.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_key_formats() {
        let id = Uuid::nil();
        assert_eq!(
            workspace_metrics_key(&id, "month"),
            "cache:metrics:ws:00000000-0000-0000-0000-000000000000:month"
        );
        assert_eq!(
            workspace_metrics_key(&id, "all"),
            "cache:metrics:ws:00000000-0000-0000-0000-000000000000:all"
        );
        assert_eq!(
            team_metrics_key(&id),
            "cache:metrics:team:00000000-0000-0000-0000-000000000000"
        );
        assert_eq!(
            personal_metrics_key(&id),
            "cache:metrics:user:00000000-0000-0000-0000-000000000000"
        );
    }

    #[test]
    fn test_period_boundaries_month() {
        let (current, prev, label) = period_boundaries("month");
        assert!(current.is_some());
        assert!(prev.is_some());
        assert!(label.is_some());
        // Current start should be day 1 of current month
        let cs = current.expect("current start");
        assert_eq!(cs.day(), 1);
    }

    #[test]
    fn test_period_boundaries_all() {
        let (current, prev, label) = period_boundaries("all");
        assert!(current.is_none());
        assert!(prev.is_none());
        assert!(label.is_none());
    }

    #[test]
    fn test_metrics_cache_ttl() {
        assert_eq!(METRICS_CACHE_TTL, 120);
    }
}
