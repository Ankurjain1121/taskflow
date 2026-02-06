//! Workspace REST endpoints
//!
//! Provides CRUD operations for workspaces and workspace membership management.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::queries::workspaces;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchMembersQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    10
}

#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceDetailResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub members: Vec<MemberInfo>,
}

#[derive(Debug, Serialize)]
pub struct MemberInfo {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub joined_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct UserSearchResult {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces
///
/// List all workspaces the authenticated user is a member of.
async fn list_workspaces(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<Vec<WorkspaceResponse>>> {
    let workspaces = workspaces::list_workspaces_for_user(
        &state.db,
        auth.0.user_id,
        auth.0.tenant_id,
    )
    .await?;

    let response: Vec<WorkspaceResponse> = workspaces
        .into_iter()
        .map(|w| WorkspaceResponse {
            id: w.id,
            name: w.name,
            description: w.description,
            tenant_id: w.tenant_id,
            created_by_id: w.created_by_id,
            created_at: w.created_at,
            updated_at: w.updated_at,
        })
        .collect();

    Ok(Json(response))
}

/// GET /api/workspaces/:id
///
/// Get a workspace by ID with its members.
async fn get_workspace(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<WorkspaceDetailResponse>> {
    // First check if user is a member
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let workspace = workspaces::get_workspace_by_id(&state.db, id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    Ok(Json(WorkspaceDetailResponse {
        id: workspace.workspace.id,
        name: workspace.workspace.name,
        description: workspace.workspace.description,
        tenant_id: workspace.workspace.tenant_id,
        created_by_id: workspace.workspace.created_by_id,
        created_at: workspace.workspace.created_at,
        updated_at: workspace.workspace.updated_at,
        members: workspace
            .members
            .into_iter()
            .map(|m| MemberInfo {
                user_id: m.user_id,
                name: m.name,
                email: m.email,
                avatar_url: m.avatar_url,
                joined_at: m.joined_at,
            })
            .collect(),
    }))
}

/// POST /api/workspaces
///
/// Create a new workspace. The creator is automatically added as a member.
async fn create_workspace(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<CreateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>> {
    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Workspace name is required".into()));
    }

    let workspace = workspaces::create_workspace(
        &state.db,
        &payload.name,
        payload.description.as_deref(),
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await?;

    Ok(Json(WorkspaceResponse {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        tenant_id: workspace.tenant_id,
        created_by_id: workspace.created_by_id,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
    }))
}

/// PUT /api/workspaces/:id
///
/// Update a workspace's name and description.
/// Requires Manager or Admin role.
async fn update_workspace(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateWorkspaceRequest>,
) -> Result<Json<WorkspaceResponse>> {
    // Check membership
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Workspace name is required".into()));
    }

    let workspace = workspaces::update_workspace(
        &state.db,
        id,
        &payload.name,
        payload.description.as_deref(),
    )
    .await?
    .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    Ok(Json(WorkspaceResponse {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        tenant_id: workspace.tenant_id,
        created_by_id: workspace.created_by_id,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
    }))
}

/// DELETE /api/workspaces/:id
///
/// Soft-delete a workspace.
/// Requires Manager or Admin role.
async fn delete_workspace(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    // Check membership
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let deleted = workspaces::soft_delete_workspace(&state.db, id).await?;

    if deleted {
        Ok(Json(MessageResponse {
            message: "Workspace deleted successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Workspace not found".into()))
    }
}

/// GET /api/workspaces/:id/members/search?q=<query>
///
/// Search workspace members by name or email.
async fn search_members(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Query(query): Query<SearchMembersQuery>,
) -> Result<Json<Vec<UserSearchResult>>> {
    // Check membership
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let users = workspaces::search_workspace_members(&state.db, id, &query.q, query.limit).await?;

    let results: Vec<UserSearchResult> = users
        .into_iter()
        .map(|u| UserSearchResult {
            id: u.id,
            name: u.name,
            email: u.email,
            avatar_url: u.avatar_url,
        })
        .collect();

    Ok(Json(results))
}

/// POST /api/workspaces/:id/members
///
/// Add a user to a workspace.
/// Requires Manager or Admin role.
async fn add_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddMemberRequest>,
) -> Result<Json<MessageResponse>> {
    // Check if auth user is a member
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    workspaces::add_workspace_member(&state.db, id, payload.user_id).await?;

    Ok(Json(MessageResponse {
        message: "Member added successfully".into(),
    }))
}

/// DELETE /api/workspaces/:id/members/:user_id
///
/// Remove a user from a workspace.
/// Requires Manager or Admin role.
async fn remove_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    // Check if auth user is a member
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let removed = workspaces::remove_workspace_member(&state.db, id, user_id).await?;

    if removed {
        Ok(Json(MessageResponse {
            message: "Member removed successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Member not found".into()))
    }
}

// ============================================================================
// Router
// ============================================================================

/// Build the workspace router
pub fn workspace_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_workspaces).post(create_workspace))
        .route("/{id}", get(get_workspace).put(update_workspace).delete(delete_workspace))
        .route("/{id}/members/search", get(search_members))
        .route("/{id}/members", post(add_member))
        .route("/{id}/members/{user_id}", delete(remove_member))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
