//! Portfolio dashboard routes
//!
//! Provides a cross-project portfolio view for a workspace with aggregated
//! task stats, health indicators, and milestone timeline.
//! Results are cached in Redis with a 60-second TTL.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::services::cache;
use crate::state::AppState;
use taskflow_db::queries::portfolio::{
    get_portfolio_milestones, get_portfolio_projects, PortfolioResponse,
};
use taskflow_db::queries::workspaces::is_workspace_member;

const PORTFOLIO_CACHE_TTL: u64 = 60;

/// Cache key for portfolio data
fn portfolio_cache_key(workspace_id: &Uuid) -> String {
    format!("cache:portfolio:ws:{}", workspace_id)
}

/// GET /api/workspaces/{workspace_id}/portfolio
///
/// Returns aggregated portfolio data for all projects in the workspace,
/// including task stats, health indicators, and upcoming milestones.
/// Cached for 60 seconds.
async fn get_portfolio_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<PortfolioResponse>> {
    // Verify workspace membership
    let is_member = is_workspace_member(&state.db, workspace_id, tenant.user_id)
        .await
        .map_err(|e| {
            AppError::InternalError(format!("Workspace membership check failed: {}", e))
        })?;

    if !is_member {
        return Err(AppError::Forbidden(
            "You are not a member of this workspace".into(),
        ));
    }

    // Check cache
    let cache_key = portfolio_cache_key(&workspace_id);
    if let Some(cached) = cache::cache_get::<PortfolioResponse>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    // Fetch projects and milestones in parallel
    let (projects_result, milestones_result) = tokio::join!(
        get_portfolio_projects(&state.db, workspace_id, tenant.tenant_id),
        get_portfolio_milestones(&state.db, workspace_id, tenant.tenant_id),
    );

    let projects = projects_result
        .map_err(|e| AppError::InternalError(format!("Portfolio projects query failed: {}", e)))?;
    let milestones = milestones_result.map_err(|e| {
        AppError::InternalError(format!("Portfolio milestones query failed: {}", e))
    })?;

    let response = PortfolioResponse {
        projects,
        milestones,
    };

    cache::cache_set(&state.redis, &cache_key, &response, PORTFOLIO_CACHE_TTL).await;

    Ok(Json(response))
}

/// Portfolio router (requires auth)
pub fn portfolio_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/{workspace_id}/portfolio", get(get_portfolio_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_key_format() {
        let id = Uuid::nil();
        assert_eq!(
            portfolio_cache_key(&id),
            "cache:portfolio:ws:00000000-0000-0000-0000-000000000000"
        );
    }

    #[test]
    fn test_portfolio_cache_ttl() {
        assert_eq!(PORTFOLIO_CACHE_TTL, 60);
    }
}
