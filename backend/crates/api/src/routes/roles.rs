//! Workspace roles CRUD and project visibility endpoints
//!
//! Provides management of custom workspace roles and project visibility settings.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::{BoardMemberRole, Capabilities, WorkspaceRole};
use taskflow_db::queries::{projects, workspace_roles, workspaces};

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::MessageResponse;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub description: Option<String>,
    pub capabilities: Capabilities,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub capabilities: Option<Capabilities>,
    pub position: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceRoleResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub is_system: bool,
    pub capabilities: serde_json::Value,
    pub position: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<WorkspaceRole> for WorkspaceRoleResponse {
    fn from(r: WorkspaceRole) -> Self {
        Self {
            id: r.id,
            workspace_id: r.workspace_id,
            name: r.name,
            description: r.description,
            is_system: r.is_system,
            capabilities: r.capabilities,
            position: r.position,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectVisibilityRequest {
    pub visibility: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectVisibilityResponse {
    pub project_id: Uuid,
    pub visibility: Option<String>,
}

// ============================================================================
// Helper: check if user has can_manage_roles capability in workspace
// ============================================================================

async fn require_manage_roles(
    pool: &sqlx::PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    // Get the user's workspace membership role
    let ws_role = workspaces::get_workspace_member_role(pool, workspace_id, user_id).await?;
    let ws_role =
        ws_role.ok_or_else(|| AppError::Forbidden("Not a member of this workspace".into()))?;

    // Check by legacy enum role: Owner and Admin can always manage roles
    let role_name = format!("{:?}", ws_role);
    if role_name == "Owner" || role_name == "Admin" {
        return Ok(());
    }

    // For other roles, try to look up the workspace_roles row by name
    // and check the capabilities JSON
    if let Some(role_row) =
        workspace_roles::get_workspace_role_by_name(pool, workspace_id, &role_name).await?
    {
        let caps = role_row.parsed_capabilities();
        if caps.can_manage_roles {
            return Ok(());
        }
    }

    Err(AppError::Forbidden(
        "You do not have permission to manage roles".into(),
    ))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/roles
///
/// List all roles for a workspace, ordered by position.
async fn list_roles(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<WorkspaceRoleResponse>>> {
    // Verify workspace membership
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let roles = workspace_roles::list_workspace_roles(&state.db, workspace_id).await?;
    let response: Vec<WorkspaceRoleResponse> = roles.into_iter().map(Into::into).collect();

    Ok(Json(response))
}

/// POST /api/workspaces/:workspace_id/roles
///
/// Create a custom role. Requires can_manage_roles capability.
async fn create_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateRoleRequest>,
) -> Result<(axum::http::StatusCode, Json<WorkspaceRoleResponse>)> {
    require_manage_roles(&state.db, workspace_id, auth.0.user_id).await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Role name is required".into()));
    }

    // Check for duplicate name
    let existing =
        workspace_roles::get_workspace_role_by_name(&state.db, workspace_id, name).await?;
    if existing.is_some() {
        return Err(AppError::Conflict(
            "A role with this name already exists".into(),
        ));
    }

    let input = workspace_roles::CreateWorkspaceRoleInput {
        name: name.to_string(),
        description: payload.description,
        capabilities: payload.capabilities,
        position: payload.position,
    };

    let role = workspace_roles::create_workspace_role(&state.db, workspace_id, input).await?;

    Ok((axum::http::StatusCode::CREATED, Json(role.into())))
}

/// PUT /api/workspaces/:workspace_id/roles/:role_id
///
/// Update a role. Cannot modify the is_system flag on system roles.
/// Requires can_manage_roles capability.
async fn update_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, role_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateRoleRequest>,
) -> Result<Json<WorkspaceRoleResponse>> {
    require_manage_roles(&state.db, workspace_id, auth.0.user_id).await?;

    // Fetch the existing role
    let existing = workspace_roles::get_workspace_role(&state.db, role_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Role not found".into()))?;

    // Verify role belongs to this workspace
    if existing.workspace_id != workspace_id {
        return Err(AppError::NotFound("Role not found".into()));
    }

    // Validate name if provided
    if let Some(ref name) = payload.name {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest("Role name cannot be empty".into()));
        }
        // Check for duplicate name (excluding current role)
        if let Some(dup) =
            workspace_roles::get_workspace_role_by_name(&state.db, workspace_id, trimmed).await?
        {
            if dup.id != role_id {
                return Err(AppError::Conflict(
                    "A role with this name already exists".into(),
                ));
            }
        }
    }

    let input = workspace_roles::UpdateWorkspaceRoleInput {
        name: payload.name.map(|n| n.trim().to_string()),
        description: payload.description,
        capabilities: payload.capabilities,
        position: payload.position,
    };

    let updated = workspace_roles::update_workspace_role(&state.db, role_id, input).await?;

    Ok(Json(updated.into()))
}

/// DELETE /api/workspaces/:workspace_id/roles/:role_id
///
/// Delete a custom role. System roles cannot be deleted.
/// Requires can_manage_roles capability.
async fn delete_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, role_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    require_manage_roles(&state.db, workspace_id, auth.0.user_id).await?;

    // Fetch the existing role
    let existing = workspace_roles::get_workspace_role(&state.db, role_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Role not found".into()))?;

    // Verify role belongs to this workspace
    if existing.workspace_id != workspace_id {
        return Err(AppError::NotFound("Role not found".into()));
    }

    // Cannot delete system roles
    if existing.is_system {
        return Err(AppError::Forbidden("System roles cannot be deleted".into()));
    }

    let deleted = workspace_roles::delete_workspace_role(&state.db, role_id).await?;

    if deleted {
        Ok(Json(MessageResponse {
            message: "Role deleted successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Role not found".into()))
    }
}

/// PUT /api/projects/:project_id/visibility
///
/// Update project visibility setting.
/// Requires can_manage_project_settings capability, or Owner/Editor role as fallback.
async fn update_project_visibility(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<UpdateProjectVisibilityRequest>,
) -> Result<Json<ProjectVisibilityResponse>> {
    // Validate the visibility value
    if let Some(ref v) = payload.visibility {
        if !["public", "private", "assignee_only"].contains(&v.as_str()) {
            return Err(AppError::BadRequest(
                "Visibility must be one of: public, private, assignee_only".into(),
            ));
        }
    }

    // Check project membership and role
    let role = projects::get_project_member_role(&state.db, project_id, auth.0.user_id).await?;

    let has_permission = match role {
        Some(BoardMemberRole::Owner | BoardMemberRole::Editor) => true,
        Some(BoardMemberRole::Viewer) => false,
        None => {
            return Err(AppError::NotFound(
                "Project not found or access denied".into(),
            ));
        }
    };

    if !has_permission {
        // As fallback, check workspace-level can_manage_project_settings capability
        // Get the project's workspace_id
        let board = projects::get_project_internal(&state.db, project_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

        let ws_role =
            workspaces::get_workspace_member_role(&state.db, board.workspace_id, auth.0.user_id)
                .await?;

        let ws_has_permission = if let Some(ref wr) = ws_role {
            let role_name = format!("{:?}", wr);
            if role_name == "Owner" || role_name == "Admin" {
                true
            } else if let Some(role_row) = workspace_roles::get_workspace_role_by_name(
                &state.db,
                board.workspace_id,
                &role_name,
            )
            .await?
            {
                role_row.parsed_capabilities().can_manage_project_settings
            } else {
                false
            }
        } else {
            false
        };

        if !ws_has_permission {
            return Err(AppError::Forbidden(
                "You do not have permission to change project visibility".into(),
            ));
        }
    }

    // Update the visibility column
    let visibility_val = payload.visibility.as_deref();
    sqlx::query("UPDATE projects SET visibility = $1 WHERE id = $2")
        .bind(visibility_val)
        .bind(project_id)
        .execute(&state.db)
        .await?;

    Ok(Json(ProjectVisibilityResponse {
        project_id,
        visibility: payload.visibility,
    }))
}

// ============================================================================
// Router
// ============================================================================

/// Build the workspace roles router
/// Routes: /api/workspaces/:workspace_id/roles
pub fn workspace_roles_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_roles).post(create_role))
        .route("/{role_id}", put(update_role).delete(delete_role))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the project visibility router
/// Routes: /api/projects/:project_id/visibility
pub fn project_visibility_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", put(update_project_visibility))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
