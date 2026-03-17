//! Metrics API routes
//!
//! Provides endpoints for workspace, team, and personal metrics dashboards.
//! Results are cached in Redis with a 120-second TTL.

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    middleware::from_fn_with_state,
    routing::{get, post},
    Json, Router,
};
use sqlx;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::services::cache;
use crate::state::AppState;
use taskflow_db::queries::metrics::{
    get_personal_dashboard, get_team_dashboard, get_workspace_dashboard, refresh_metrics,
    PersonalDashboard, TeamDashboard, WorkspaceDashboard,
};

/// Cache key for workspace metrics
fn workspace_metrics_key(workspace_id: &Uuid) -> String {
    format!("cache:metrics:ws:{}", workspace_id)
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

/// GET /api/workspaces/{workspace_id}/metrics/workspace
///
/// Fetch workspace-level metrics dashboard with cycle time, velocity,
/// on-time %, and workload distribution. Cached for 120 seconds.
async fn get_workspace_metrics_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(workspace_id): Path<Uuid>,
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

    let cache_key = workspace_metrics_key(&workspace_id);
    if let Some(cached) = cache::cache_get::<WorkspaceDashboard>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let dashboard = get_workspace_dashboard(&state.db, workspace_id)
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

/// Validate the X-Cron-Secret header for the refresh endpoint
fn validate_cron_secret(headers: &HeaderMap) -> Result<()> {
    let expected_secret = std::env::var("CRON_SECRET").unwrap_or_default();

    if expected_secret.is_empty() {
        return Err(AppError::InternalError(
            "CRON_SECRET environment variable not set".into(),
        ));
    }

    let provided_secret = headers
        .get("X-Cron-Secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // Constant-time comparison to prevent timing attacks
    let a = provided_secret.as_bytes();
    let b = expected_secret.as_bytes();
    let matches = a.len() == b.len()
        && a.iter()
            .zip(b.iter())
            .fold(0u8, |acc, (x, y)| acc | (x ^ y))
            == 0;
    if !matches {
        return Err(AppError::Unauthorized("Invalid cron secret".into()));
    }

    Ok(())
}

/// Response for the refresh endpoint
#[derive(serde::Serialize)]
struct RefreshMetricsResponse {
    status: &'static str,
}

/// POST /api/cron/refresh-metrics
///
/// Refresh all materialized metrics views. Protected by X-Cron-Secret header.
async fn refresh_metrics_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<RefreshMetricsResponse>> {
    validate_cron_secret(&headers)?;

    refresh_metrics(&state.db)
        .await
        .map_err(|e| AppError::InternalError(format!("Metrics refresh failed: {}", e)))?;

    Ok(Json(RefreshMetricsResponse { status: "ok" }))
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
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Cron endpoint for refreshing metrics (no auth, uses X-Cron-Secret)
pub fn metrics_cron_router() -> Router<AppState> {
    Router::new().route("/cron/refresh-metrics", post(refresh_metrics_handler))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_key_formats() {
        let id = Uuid::nil();
        assert_eq!(
            workspace_metrics_key(&id),
            "cache:metrics:ws:00000000-0000-0000-0000-000000000000"
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
    fn test_metrics_cache_ttl() {
        assert_eq!(METRICS_CACHE_TTL, 120);
    }

    #[test]
    fn test_refresh_response_serializes() {
        let resp = RefreshMetricsResponse { status: "ok" };
        let json = serde_json::to_string(&resp).expect("serialize");
        assert!(json.contains("ok"));
    }
}
