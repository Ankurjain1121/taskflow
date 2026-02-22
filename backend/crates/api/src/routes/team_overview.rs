//! Team Overview API routes
//!
//! Provides endpoints for viewing team workload and member statistics.
//! Protected by ManagerOrAdmin extractor.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::ManagerOrAdmin;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::is_workspace_member;
use taskflow_db::queries::team_overview::{
    get_member_active_tasks, get_overloaded_members, get_workload, reassign_tasks, MemberTask,
    MemberWorkload, OverloadedMember,
};

/// Query parameters for overloaded members endpoint
#[derive(Debug, Deserialize)]
pub struct OverloadedMembersQuery {
    #[serde(default = "default_threshold")]
    pub threshold: i64,
}

fn default_threshold() -> i64 {
    10
}

/// Request body for task reassignment
#[derive(Debug, Deserialize)]
pub struct ReassignTasksRequest {
    pub task_ids: Vec<Uuid>,
    pub from_user_id: Uuid,
    pub to_user_id: Uuid,
}

/// Response for task reassignment
#[derive(Debug, Serialize)]
pub struct ReassignTasksResponse {
    pub reassigned_count: usize,
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

    let members =
        get_overloaded_members(&state.db, workspace_id, auth.tenant_id, query.threshold).await?;

    Ok(Json(members))
}

/// GET /api/workspaces/:workspace_id/members/:user_id/tasks
///
/// Get active tasks assigned to a specific workspace member.
/// Requires Manager or Admin role.
async fn get_member_tasks_handler(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path((workspace_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<MemberTask>>> {
    let auth = manager.0;

    // Verify caller is a workspace member
    let is_member = is_workspace_member(&state.db, workspace_id, auth.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let tasks = get_member_active_tasks(&state.db, workspace_id, user_id).await?;

    Ok(Json(tasks))
}

/// POST /api/workspaces/:workspace_id/reassign-tasks
///
/// Reassign tasks from one member to another.
/// Requires Manager or Admin role.
async fn reassign_tasks_handler(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<ReassignTasksRequest>,
) -> Result<Json<ReassignTasksResponse>> {
    let auth = manager.0;

    // Verify caller is a workspace member
    let is_member = is_workspace_member(&state.db, workspace_id, auth.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    if payload.task_ids.is_empty() {
        return Err(AppError::BadRequest("No task IDs provided".into()));
    }

    if payload.from_user_id == payload.to_user_id {
        return Err(AppError::BadRequest(
            "Source and destination users must be different".into(),
        ));
    }

    // Verify both users are workspace members
    let from_is_member = is_workspace_member(&state.db, workspace_id, payload.from_user_id).await?;
    if !from_is_member {
        return Err(AppError::BadRequest(
            "Source user is not a workspace member".into(),
        ));
    }

    let to_is_member = is_workspace_member(&state.db, workspace_id, payload.to_user_id).await?;
    if !to_is_member {
        return Err(AppError::BadRequest(
            "Destination user is not a workspace member".into(),
        ));
    }

    let reassigned_count = reassign_tasks(
        &state.db,
        &payload.task_ids,
        payload.from_user_id,
        payload.to_user_id,
    )
    .await?;

    Ok(Json(ReassignTasksResponse { reassigned_count }))
}

/// Create the team overview router
///
/// Routes:
/// - GET /team-workload - Get workload for all members
/// - GET /overloaded-members - Get members with high task counts
/// - GET /members/:user_id/tasks - Get active tasks for a member
/// - POST /reassign-tasks - Reassign tasks between members
pub fn team_overview_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/team-workload", get(get_team_workload))
        .route("/overloaded-members", get(get_overloaded_members_handler))
        .route("/members/{user_id}/tasks", get(get_member_tasks_handler))
        .route("/reassign-tasks", post(reassign_tasks_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
