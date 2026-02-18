use axum::{
    extract::{Path, State},
    routing::{delete, get, patch},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use taskflow_auth::rbac::{require_permission, Permission};
use taskflow_db::models::{Project, ProjectMemberRole};
use taskflow_db::queries::projects as project_queries;
use taskflow_db::set_tenant_context;

use crate::errors::AppError;
use crate::middleware::AuthUser;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Deserialize)]
pub struct AddProjectMemberRequest {
    pub user_id: Uuid,
    pub role: Option<ProjectMemberRoleInput>,
}

/// Input wrapper for deserializing project member role.
#[derive(Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ProjectMemberRoleInput {
    Owner,
    Manager,
    Viewer,
    Editor,
}

impl From<ProjectMemberRoleInput> for ProjectMemberRole {
    fn from(r: ProjectMemberRoleInput) -> Self {
        match r {
            ProjectMemberRoleInput::Owner => ProjectMemberRole::Owner,
            ProjectMemberRoleInput::Manager => ProjectMemberRole::Manager,
            ProjectMemberRoleInput::Viewer => ProjectMemberRole::Viewer,
            ProjectMemberRoleInput::Editor => ProjectMemberRole::Editor,
        }
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/workspaces/:workspace_id/projects
async fn list_projects(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<Project>>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let projects =
        project_queries::list_projects_by_workspace(&mut *tx, workspace_id, auth_user.user_id)
            .await?;

    tx.commit().await?;
    Ok(Json(projects))
}

/// POST /api/workspaces/:workspace_id/projects
async fn create_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<Json<Project>, AppError> {
    require_permission(&auth_user.role, Permission::BoardCreate)
        .map_err(AppError::Forbidden)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let project = project_queries::create_project(
        &mut *tx,
        &payload.name,
        payload.description.as_deref(),
        workspace_id,
        auth_user.tenant_id,
        auth_user.user_id,
        payload.color.as_deref(),
        payload.icon.as_deref(),
    )
    .await?;

    tx.commit().await?;
    Ok(Json(project))
}

/// GET /api/projects/:id
async fn get_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let project = project_queries::get_project_by_id(&mut *tx, id, auth_user.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    tx.commit().await?;
    Ok(Json(project))
}

/// PUT /api/projects/:id
async fn update_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<Project>, AppError> {
    require_permission(&auth_user.role, Permission::BoardUpdate)
        .map_err(AppError::Forbidden)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    // Verify project membership
    let is_member = project_queries::check_project_membership(&mut *tx, id, auth_user.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let project = project_queries::update_project(
        &mut *tx,
        id,
        &payload.name,
        payload.description.as_deref(),
        payload.color.as_deref(),
        payload.icon.as_deref(),
    )
    .await?;

    tx.commit().await?;
    Ok(Json(project))
}

/// DELETE /api/projects/:id
async fn delete_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&auth_user.role, Permission::BoardDelete)
        .map_err(AppError::Forbidden)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    project_queries::soft_delete_project(&mut *tx, id).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"message": "Project deleted"})))
}

/// PATCH /api/projects/:id/archive
async fn archive_project(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Project>, AppError> {
    require_permission(&auth_user.role, Permission::BoardUpdate)
        .map_err(AppError::Forbidden)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let is_member = project_queries::check_project_membership(&mut *tx, id, auth_user.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let project = project_queries::archive_project(&mut *tx, id).await?;

    tx.commit().await?;
    Ok(Json(project))
}

/// GET /api/projects/:id/members
async fn list_project_members(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<project_queries::ProjectMemberInfo>>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    // Verify project membership
    let is_member = project_queries::check_project_membership(&mut *tx, id, auth_user.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let members = project_queries::list_project_members(&mut *tx, id).await?;

    tx.commit().await?;
    Ok(Json(members))
}

/// POST /api/projects/:id/members
async fn add_project_member(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddProjectMemberRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&auth_user.role, Permission::WorkspaceManageMembers)
        .map_err(AppError::Forbidden)?;

    let role: ProjectMemberRole = payload
        .role
        .map(ProjectMemberRole::from)
        .unwrap_or(ProjectMemberRole::Editor);

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    let member = project_queries::add_project_member(&mut *tx, id, payload.user_id, role).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "id": member.id,
        "project_id": member.project_id,
        "user_id": member.user_id,
        "role": member.role,
    })))
}

/// DELETE /api/projects/:id/members/:user_id
async fn remove_project_member(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((project_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&auth_user.role, Permission::WorkspaceManageMembers)
        .map_err(AppError::Forbidden)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut *tx, auth_user.tenant_id).await?;

    project_queries::remove_project_member(&mut *tx, project_id, user_id).await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"message": "Project member removed"})))
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn project_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/api/workspaces/{workspace_id}/projects",
            get(list_projects).post(create_project),
        )
        .route(
            "/api/projects/{id}",
            get(get_project).put(update_project).delete(delete_project),
        )
        .route(
            "/api/projects/{id}/archive",
            patch(archive_project),
        )
        .route(
            "/api/projects/{id}/members",
            get(list_project_members).post(add_project_member),
        )
        .route(
            "/api/projects/{id}/members/{user_id}",
            delete(remove_project_member),
        )
}
