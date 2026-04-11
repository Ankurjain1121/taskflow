use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use taskbolt_db::models::ProjectGroup;
use taskbolt_db::queries::project_groups::{
    create_project_group, delete_project_group, get_group_workspace_id, get_project_group,
    list_project_groups, set_project_group, update_project_group, CreateProjectGroupInput,
    ProjectGroupQueryError, ProjectGroupWithCount, UpdateProjectGroupInput,
};
use taskbolt_db::queries::projects::get_project_internal;

fn map_group_error(e: ProjectGroupQueryError) -> AppError {
    match e {
        ProjectGroupQueryError::NotWorkspaceMember => {
            AppError::Forbidden("Not a workspace member".into())
        }
        ProjectGroupQueryError::NotFound => AppError::NotFound("Project group not found".into()),
        ProjectGroupQueryError::Invalid(msg) => AppError::BadRequest(msg),
        ProjectGroupQueryError::Database(e) => AppError::SqlxError(e),
    }
}

// ============================================
// Request bodies
// ============================================

#[derive(Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
pub struct UpdateGroupRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct AssignGroupRequest {
    /// Null to unassign the project from any group.
    pub group_id: Option<Uuid>,
}

// ============================================
// Handlers
// ============================================

/// GET /api/workspaces/{workspace_id}/project-groups
async fn list_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<ProjectGroupWithCount>>> {
    let groups = list_project_groups(&state.db, workspace_id, tenant.user_id)
        .await
        .map_err(map_group_error)?;
    Ok(Json(groups))
}

/// POST /api/workspaces/{workspace_id}/project-groups
async fn create_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(workspace_id): Path<Uuid>,
    Json(body): Json<CreateGroupRequest>,
) -> Result<Json<ProjectGroup>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("name cannot be empty".into()));
    }
    let input = CreateProjectGroupInput {
        name: body.name,
        color: body.color,
        description: body.description,
    };
    let group = create_project_group(&state.db, workspace_id, tenant.tenant_id, tenant.user_id, input)
        .await
        .map_err(map_group_error)?;
    Ok(Json(group))
}

/// GET /api/project-groups/{id}
async fn get_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<ProjectGroup>> {
    let group = get_project_group(&state.db, id, tenant.user_id)
        .await
        .map_err(map_group_error)?;
    Ok(Json(group))
}

/// PUT /api/project-groups/{id}
async fn update_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateGroupRequest>,
) -> Result<Json<ProjectGroup>> {
    // Auth: ensure caller is a workspace member of the group's workspace
    let ws_id = get_group_workspace_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project group not found".into()))?;
    // Reuse list_project_groups membership check by loading the group with auth
    let _ = get_project_group(&state.db, id, tenant.user_id)
        .await
        .map_err(map_group_error)?;
    let _ = ws_id; // keeps the binding alive for clarity

    let input = UpdateProjectGroupInput {
        name: body.name,
        color: body.color,
        description: body.description,
    };
    let group = update_project_group(&state.db, id, input)
        .await
        .map_err(map_group_error)?;
    Ok(Json(group))
}

/// DELETE /api/project-groups/{id}
async fn delete_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Auth
    let _ = get_project_group(&state.db, id, tenant.user_id)
        .await
        .map_err(map_group_error)?;

    delete_project_group(&state.db, id)
        .await
        .map_err(map_group_error)?;
    Ok(Json(json!({ "success": true })))
}

/// PATCH /api/projects/{project_id}/group
async fn assign_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    Json(body): Json<AssignGroupRequest>,
) -> Result<Json<serde_json::Value>> {
    // Load the project to check workspace + membership
    let project = get_project_internal(&state.db, project_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    // Caller must be a workspace member of the project's workspace.
    // Use project_groups membership check which validates workspace membership.
    // We verify by attempting a load with a dummy group — simpler: inline check.
    let is_member = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS(
            SELECT 1 FROM workspace_members
            WHERE workspace_id = $1 AND user_id = $2
        )
        ",
    )
    .bind(project.workspace_id)
    .bind(tenant.user_id)
    .fetch_one(&state.db)
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    // If a group_id is provided, it must belong to the same workspace.
    if let Some(gid) = body.group_id {
        let group_ws = get_group_workspace_id(&state.db, gid)
            .await?
            .ok_or_else(|| AppError::NotFound("Project group not found".into()))?;
        if group_ws != project.workspace_id {
            return Err(AppError::BadRequest(
                "Group belongs to a different workspace".into(),
            ));
        }
    }

    set_project_group(&state.db, project_id, body.group_id)
        .await
        .map_err(map_group_error)?;

    Ok(Json(json!({ "success": true })))
}

// ============================================
// Router
// ============================================

pub fn project_group_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Workspace-scoped list + create
        .route(
            "/workspaces/{workspace_id}/project-groups",
            get(list_handler).post(create_handler),
        )
        // Group-specific routes
        .route(
            "/project-groups/{id}",
            get(get_handler).put(update_handler).delete(delete_handler),
        )
        // Assign a project to a group (or unassign with null)
        .route("/projects/{project_id}/group", post(assign_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
