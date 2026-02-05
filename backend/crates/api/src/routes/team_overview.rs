//! Team Overview API routes
//!
//! Provides endpoints for viewing team workload and member statistics.
//! Protected by ManagerOrAdmin extractor.

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::ManagerOrAdmin;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::team_overview::{get_overloaded_members, get_workload, MemberWorkload, OverloadedMember};
use taskflow_db::queries::is_workspace_member;

/// Query parameters for overloaded members endpoint
#[derive(Debug, Deserialize)]
pub struct OverloadedMembersQuery {
    #[serde(default = "default_threshold")]
    pub threshold: i64,
}

fn default_threshold() -> i64 {
    10
}

/// GET /api/workspaces/:workspace_id/team-workload
///
/// Get workload statistics for all members of a workspace.
/// Requires Manager or Admin role.
async fn get_team_workload(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<MemberWorkload>>> {
    let auth = manager.0;

    // Verify user is a workspace member
    let is_member = is_workspace_member(&state.db, workspace_id, auth.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let workload = get_workload(&state.db, workspace_id, auth.tenant_id).await?;

    Ok(Json(workload))
}

/// GET /api/workspaces/:workspace_id/overloaded-members
///
/// Get members who have >= threshold active tasks.
/// Requires Manager or Admin role.
async fn get_overloaded_members_handler(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<OverloadedMembersQuery>,
) -> Result<Json<Vec<OverloadedMember>>> {
    let auth = manager.0;

    // Verify user is a workspace member
    let is_member = is_workspace_member(&state.db, workspace_id, auth.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let members = get_overloaded_members(&state.db, workspace_id, auth.tenant_id, query.threshold).await?;

    Ok(Json(members))
}

/// Create the team overview router
///
/// Routes:
/// - GET /team-workload - Get workload for all members
/// - GET /overloaded-members - Get members with high task counts
pub fn team_overview_router() -> Router<AppState> {
    Router::new()
        .route("/team-workload", get(get_team_workload))
        .route("/overloaded-members", get(get_overloaded_members_handler))
        .layer(axum::middleware::from_fn(auth_middleware))
}
