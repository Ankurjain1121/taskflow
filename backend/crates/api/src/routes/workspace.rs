//! Workspace REST endpoints
//!
//! Provides CRUD operations for workspaces and workspace membership management.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_auth::rbac::can_manage_workspace;
use taskflow_db::models::{WorkspaceMemberRole, WorkspaceVisibility};
use taskflow_db::queries::workspaces;

use taskflow_db::models::automation::AutomationTrigger;
use taskflow_services::{spawn_automation_evaluation, TriggerContext};

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::auth_middleware;
use crate::state::AppState;

/// Fire MemberJoined trigger for all boards in a workspace
fn fire_member_joined_trigger(
    pool: sqlx::PgPool,
    redis: redis::aio::ConnectionManager,
    workspace_id: Uuid,
    member_user_id: Uuid,
    tenant_id: Uuid,
) {
    tokio::spawn(async move {
        let board_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM boards WHERE workspace_id = $1 AND deleted_at IS NULL",
        )
        .bind(workspace_id)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        for board_id in board_ids {
            // Use a dummy task_id (Nil) since MemberJoined doesn't relate to a specific task
            spawn_automation_evaluation(
                pool.clone(),
                redis.clone(),
                AutomationTrigger::MemberJoined,
                TriggerContext {
                    task_id: Uuid::nil(),
                    board_id,
                    tenant_id,
                    user_id: member_user_id,
                    previous_column_id: None,
                    new_column_id: None,
                    priority: None,
                    member_user_id: Some(member_user_id),
                },
            );
        }
    });
}

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
    pub visibility: Option<WorkspaceVisibility>,
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

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: WorkspaceMemberRole,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub visibility: WorkspaceVisibility,
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
    pub visibility: WorkspaceVisibility,
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
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub role: WorkspaceMemberRole,
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

#[derive(Debug, Deserialize)]
pub struct BulkAddMembersRequest {
    pub user_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct BulkAddMembersResponse {
    pub added: u64,
}

#[derive(Debug, Serialize)]
pub struct JoinWorkspaceResponse {
    pub message: String,
    pub workspace_id: Uuid,
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
    let workspaces =
        workspaces::list_workspaces_for_user(&state.db, auth.0.user_id, auth.0.tenant_id).await?;

    let response: Vec<WorkspaceResponse> = workspaces
        .into_iter()
        .map(|w| WorkspaceResponse {
            id: w.id,
            name: w.name,
            description: w.description,
            visibility: w.visibility,
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
        visibility: workspace.workspace.visibility,
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
                job_title: m.job_title,
                department: m.department,
                role: m.role,
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
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Workspace name is required".into()));
    }

    let workspace = workspaces::create_workspace(
        &state.db,
        name,
        payload.description.as_deref(),
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await?;

    Ok(Json(WorkspaceResponse {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        visibility: workspace.visibility,
        tenant_id: workspace.tenant_id,
        created_by_id: workspace.created_by_id,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
    }))
}

/// PUT /api/workspaces/:id
///
/// Update a workspace's name, description, and optionally visibility.
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

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Workspace name is required".into()));
    }

    let workspace =
        workspaces::update_workspace(&state.db, id, name, payload.description.as_deref())
            .await?
            .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    // Update visibility if provided
    let workspace = if let Some(visibility) = payload.visibility {
        workspaces::update_workspace_visibility(&state.db, id, visibility)
            .await?
            .unwrap_or(workspace)
    } else {
        workspace
    };

    Ok(Json(WorkspaceResponse {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        visibility: workspace.visibility,
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

    let limit = query.limit.clamp(1, 50);
    let users = workspaces::search_workspace_members(&state.db, id, &query.q, limit).await?;

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

    // Fire MemberJoined automation trigger
    fire_member_joined_trigger(
        state.db.clone(),
        state.redis.clone(),
        id,
        payload.user_id,
        auth.0.tenant_id,
    );

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

    // Prevent removing the workspace owner
    let target_role = workspaces::get_workspace_member_role(&state.db, id, user_id).await?;
    if matches!(target_role, Some(WorkspaceMemberRole::Owner)) {
        return Err(AppError::BadRequest(
            "Cannot remove the workspace owner".into(),
        ));
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

/// PATCH /api/workspaces/:id/members/:user_id
///
/// Update a workspace member's role.
/// Caller must be ws owner/admin or global Admin.
/// Cannot change own role, cannot change owner, cannot promote to owner.
async fn update_member_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, target_user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateMemberRoleRequest>,
) -> Result<Json<MemberInfo>> {
    // Cannot change own role
    if auth.0.user_id == target_user_id {
        return Err(AppError::BadRequest("Cannot change your own role".into()));
    }

    // Cannot promote to owner
    if payload.role == WorkspaceMemberRole::Owner {
        return Err(AppError::BadRequest(
            "Cannot promote a member to owner".into(),
        ));
    }

    // Check caller's workspace role
    let caller_ws_role =
        workspaces::get_workspace_member_role(&state.db, workspace_id, auth.0.user_id).await?;

    // Must be ws owner/admin or global admin
    if !can_manage_workspace(&auth.0.role, caller_ws_role.as_ref()) {
        return Err(AppError::Forbidden(
            "Only workspace owners, admins, or global admins can change roles".into(),
        ));
    }

    // Cannot change owner's role
    let target_ws_role =
        workspaces::get_workspace_member_role(&state.db, workspace_id, target_user_id).await?;
    match target_ws_role {
        Some(WorkspaceMemberRole::Owner) => {
            return Err(AppError::BadRequest(
                "Cannot change the workspace owner's role".into(),
            ));
        }
        None => {
            return Err(AppError::NotFound("Member not found in workspace".into()));
        }
        _ => {}
    }

    // Perform the update
    let updated = workspaces::update_workspace_member_role(
        &state.db,
        workspace_id,
        target_user_id,
        payload.role,
    )
    .await?;

    if !updated {
        return Err(AppError::NotFound("Member not found".into()));
    }

    // Fetch the updated member info to return
    let workspace_detail =
        workspaces::get_workspace_by_id(&state.db, workspace_id, auth.0.tenant_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    let member_info = workspace_detail
        .members
        .into_iter()
        .find(|m| m.user_id == target_user_id)
        .ok_or_else(|| AppError::NotFound("Member not found".into()))?;

    Ok(Json(MemberInfo {
        user_id: member_info.user_id,
        name: member_info.name,
        email: member_info.email,
        avatar_url: member_info.avatar_url,
        job_title: member_info.job_title,
        department: member_info.department,
        role: member_info.role,
        joined_at: member_info.joined_at,
    }))
}

/// GET /api/workspaces/discover
///
/// List open workspaces the user can join.
async fn discover_workspaces(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<Vec<WorkspaceResponse>>> {
    let workspaces =
        workspaces::list_open_workspaces(&state.db, auth.0.tenant_id, auth.0.user_id).await?;

    let response: Vec<WorkspaceResponse> = workspaces
        .into_iter()
        .map(|w| WorkspaceResponse {
            id: w.id,
            name: w.name,
            description: w.description,
            visibility: w.visibility,
            tenant_id: w.tenant_id,
            created_by_id: w.created_by_id,
            created_at: w.created_at,
            updated_at: w.updated_at,
        })
        .collect();

    Ok(Json(response))
}

/// POST /api/workspaces/:id/join
///
/// Join an open workspace.
async fn join_workspace(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<JoinWorkspaceResponse>> {
    // Check if already a member
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if is_member {
        return Err(AppError::Conflict(
            "Already a member of this workspace".into(),
        ));
    }

    // Verify workspace belongs to user's tenant and is open
    let workspace = workspaces::get_workspace_by_id(&state.db, id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    if workspace.workspace.visibility != WorkspaceVisibility::Open {
        return Err(AppError::Forbidden(
            "This workspace is not open for joining".into(),
        ));
    }

    workspaces::join_open_workspace(&state.db, id, auth.0.user_id).await?;

    // Fire MemberJoined automation trigger
    fire_member_joined_trigger(
        state.db.clone(),
        state.redis.clone(),
        id,
        auth.0.user_id,
        auth.0.tenant_id,
    );

    Ok(Json(JoinWorkspaceResponse {
        message: "Successfully joined the workspace".into(),
        workspace_id: id,
    }))
}

/// POST /api/workspaces/:id/members/bulk
///
/// Bulk-add existing tenant users to a workspace.
/// Requires Manager or Admin role.
async fn bulk_add_members(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<BulkAddMembersRequest>,
) -> Result<Json<BulkAddMembersResponse>> {
    if payload.user_ids.is_empty() {
        return Err(AppError::BadRequest("No user IDs provided".into()));
    }
    if payload.user_ids.len() > 100 {
        return Err(AppError::BadRequest(
            "Cannot add more than 100 members at once".into(),
        ));
    }

    // Check if auth user is a member of the workspace
    let is_member = workspaces::is_workspace_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Verify workspace belongs to user's tenant
    let workspace = workspaces::get_workspace_by_id(&state.db, id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Workspace not found".into()))?;

    // Verify all users belong to the same tenant
    let tenant_members =
        workspaces::list_tenant_members(&state.db, workspace.workspace.tenant_id).await?;
    let tenant_user_ids: std::collections::HashSet<Uuid> =
        tenant_members.iter().map(|m| m.user_id).collect();

    for uid in &payload.user_ids {
        if !tenant_user_ids.contains(uid) {
            return Err(AppError::BadRequest(format!(
                "User {} does not belong to this tenant",
                uid
            )));
        }
    }

    let added = workspaces::bulk_add_workspace_members(&state.db, id, &payload.user_ids).await?;

    Ok(Json(BulkAddMembersResponse { added }))
}

// ============================================================================
// Router
// ============================================================================

/// Build the workspace router
pub fn workspace_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_workspaces).post(create_workspace))
        .route("/discover", get(discover_workspaces))
        .route(
            "/{id}",
            get(get_workspace)
                .put(update_workspace)
                .delete(delete_workspace),
        )
        .route("/{id}/join", post(join_workspace))
        .route("/{id}/members/search", get(search_members))
        .route("/{id}/members/bulk", post(bulk_add_members))
        .route("/{id}/members", post(add_member))
        .route(
            "/{id}/members/{user_id}",
            delete(remove_member).patch(update_member_role),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
