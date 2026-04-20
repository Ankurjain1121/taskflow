//! Workspace Job Roles REST endpoints
//!
//! Provides CRUD operations for custom workspace job roles (Developer, Designer, QA, etc.)
//! and member-role assignments.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use taskbolt_db::models::WorkspaceJobRole;
use taskbolt_db::queries::workspace_job_roles::{
    self, CreateJobRoleInput, MemberJobRoleInfo, MemberRoleBatch, UpdateJobRoleInput,
};
use taskbolt_db::queries::workspaces;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, StrictJson};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::MessageResponse;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct CreateJobRoleRequest {
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct UpdateJobRoleRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct JobRoleResponse {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct AssignRoleRequest {
    pub job_role_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct MemberRoleResponse {
    pub role_id: Uuid,
    pub role_name: String,
    pub role_color: Option<String>,
    pub assigned_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct MemberRoleBatchResponse {
    pub user_id: Uuid,
    pub role_id: Uuid,
    pub role_name: String,
    pub role_color: Option<String>,
}

impl From<WorkspaceJobRole> for JobRoleResponse {
    fn from(r: WorkspaceJobRole) -> Self {
        Self {
            id: r.id,
            workspace_id: r.workspace_id,
            name: r.name,
            color: r.color,
            description: r.description,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

impl From<MemberJobRoleInfo> for MemberRoleResponse {
    fn from(r: MemberJobRoleInfo) -> Self {
        Self {
            role_id: r.role_id,
            role_name: r.role_name,
            role_color: r.role_color,
            assigned_at: r.assigned_at,
        }
    }
}

impl From<MemberRoleBatch> for MemberRoleBatchResponse {
    fn from(r: MemberRoleBatch) -> Self {
        Self {
            user_id: r.user_id,
            role_id: r.role_id,
            role_name: r.role_name,
            role_color: r.role_color,
        }
    }
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:id/roles
async fn list_roles(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<JobRoleResponse>>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let roles = workspace_job_roles::list_job_roles(&state.db, workspace_id).await?;
    Ok(Json(roles.into_iter().map(Into::into).collect()))
}

/// POST /api/workspaces/:id/roles
async fn create_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    StrictJson(payload): StrictJson<CreateJobRoleRequest>,
) -> Result<Json<JobRoleResponse>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Role name is required".into()));
    }

    let role = workspace_job_roles::create_job_role(
        &state.db,
        workspace_id,
        CreateJobRoleInput {
            name: name.to_string(),
            color: payload.color,
            description: payload.description,
        },
    )
    .await?;

    Ok(Json(role.into()))
}

/// PUT /api/workspaces/:id/roles/:role_id
async fn update_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, role_id)): Path<(Uuid, Uuid)>,
    StrictJson(payload): StrictJson<UpdateJobRoleRequest>,
) -> Result<Json<JobRoleResponse>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let role = workspace_job_roles::update_job_role(
        &state.db,
        role_id,
        UpdateJobRoleInput {
            name: payload.name,
            color: payload.color,
            description: payload.description,
        },
    )
    .await?;

    Ok(Json(role.into()))
}

/// DELETE /api/workspaces/:id/roles/:role_id
async fn delete_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, role_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    workspace_job_roles::delete_job_role(&state.db, role_id).await?;

    Ok(Json(MessageResponse {
        message: "Role deleted successfully".into(),
    }))
}

/// GET /api/workspaces/:id/roles/members
/// Batch get all member role assignments for the workspace
async fn list_all_member_roles(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<MemberRoleBatchResponse>>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let batch = workspace_job_roles::get_roles_for_all_members(&state.db, workspace_id).await?;
    Ok(Json(batch.into_iter().map(Into::into).collect()))
}

/// POST /api/workspaces/:id/members/:user_id/roles
async fn assign_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, user_id)): Path<(Uuid, Uuid)>,
    StrictJson(payload): StrictJson<AssignRoleRequest>,
) -> Result<Json<MessageResponse>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    workspace_job_roles::assign_role_to_member(
        &state.db,
        workspace_id,
        user_id,
        payload.job_role_id,
    )
    .await?;

    Ok(Json(MessageResponse {
        message: "Role assigned successfully".into(),
    }))
}

/// DELETE /api/workspaces/:id/members/:user_id/roles/:role_id
async fn remove_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, user_id, role_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    workspace_job_roles::remove_role_from_member(&state.db, user_id, role_id).await?;

    Ok(Json(MessageResponse {
        message: "Role removed successfully".into(),
    }))
}

/// GET /api/workspaces/:id/members/:user_id/roles
async fn get_member_roles(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Vec<MemberRoleResponse>>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let roles = workspace_job_roles::get_member_roles(&state.db, workspace_id, user_id).await?;
    Ok(Json(roles.into_iter().map(Into::into).collect()))
}

// ============================================================================
// Router
// ============================================================================

pub fn workspace_job_roles_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/{id}/roles", get(list_roles).post(create_role))
        .route(
            "/{id}/roles/{role_id}",
            put(update_role).delete(delete_role),
        )
        .route("/{id}/roles/members", get(list_all_member_roles))
        .route(
            "/{id}/members/{user_id}/roles",
            post(assign_role).get(get_member_roles),
        )
        .route(
            "/{id}/members/{user_id}/roles/{role_id}",
            delete(remove_role),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
