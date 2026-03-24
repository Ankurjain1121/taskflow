//! Tenant-level REST endpoints
//!
//! Provides org-wide member listing and cross-workspace membership info.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use taskbolt_db::models::UserRole;
use taskbolt_db::queries::workspaces;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/tenant/members
///
/// List all members in the authenticated user's tenant with workspace counts.
async fn list_tenant_members(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<Vec<workspaces::TenantMemberInfo>>> {
    let members = workspaces::list_tenant_members(&state.db, auth.0.tenant_id).await?;
    Ok(Json(members))
}

/// GET /api/tenant/members/:user_id/workspaces
///
/// Get all workspaces a specific user belongs to within the tenant.
/// Only the user themselves or an admin may query this endpoint.
async fn get_member_workspaces(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<workspaces::UserWorkspaceMembership>>> {
    // Only allow users to query their own workspaces, or admins to query anyone's
    if user_id != auth.0.user_id && !matches!(auth.0.role, UserRole::SuperAdmin | UserRole::Admin) {
        return Err(AppError::Forbidden(
            "You can only view your own workspace memberships".into(),
        ));
    }

    let memberships = workspaces::get_user_workspaces(&state.db, user_id, auth.0.tenant_id).await?;
    Ok(Json(memberships))
}

/// GET /api/tenant/members/:user_id/workspace-matrix
///
/// Get all workspaces with membership status for a specific user.
/// Shows which workspaces the user is a member of, their role, and whether
/// they have implicit admin access. Only admins or the user themselves.
async fn get_workspace_matrix(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<workspaces::WorkspaceMatrixEntry>>> {
    // Only allow users to query their own matrix, or admins to query anyone's
    if user_id != auth.0.user_id && !matches!(auth.0.role, UserRole::SuperAdmin | UserRole::Admin) {
        return Err(AppError::Forbidden(
            "You can only view your own workspace memberships".into(),
        ));
    }

    let matrix =
        workspaces::get_user_workspace_matrix(&state.db, user_id, auth.0.tenant_id).await?;
    Ok(Json(matrix))
}

// ============================================================================
// Router
// ============================================================================

/// Build the tenant router
pub fn tenant_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/members", get(list_tenant_members))
        .route("/members/{user_id}/workspaces", get(get_member_workspaces))
        .route(
            "/members/{user_id}/workspace-matrix",
            get(get_workspace_matrix),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
