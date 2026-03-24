//! Team REST endpoints
//!
//! Provides CRUD operations for teams and team membership management.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskbolt_db::queries::{teams, workspaces};

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::MessageResponse;
use super::validation::{
    validate_optional_string, validate_required_string, MAX_NAME_LEN, MAX_PROJECT_DESCRIPTION_LEN,
};

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateTeamRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTeamRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddTeamMemberRequest {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct TeamResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub workspace_id: Uuid,
    pub member_count: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct TeamDetailResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub workspace_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub members: Vec<TeamMemberResponse>,
}

#[derive(Debug, Serialize)]
pub struct TeamMemberResponse {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub added_at: chrono::DateTime<chrono::Utc>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/teams
async fn list_teams(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<TeamResponse>>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let team_list = teams::list_teams_by_workspace(&state.db, workspace_id).await?;

    let response: Vec<TeamResponse> = team_list
        .into_iter()
        .map(|t| TeamResponse {
            id: t.id,
            name: t.name,
            description: t.description,
            color: t.color,
            workspace_id: t.workspace_id,
            member_count: t.member_count,
            created_at: t.created_at,
        })
        .collect();

    Ok(Json(response))
}

/// POST /api/workspaces/:workspace_id/teams
async fn create_team(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateTeamRequest>,
) -> Result<Json<TeamDetailResponse>> {
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    validate_required_string("Team name", &payload.name, MAX_NAME_LEN)?;
    validate_optional_string(
        "Description",
        payload.description.as_deref(),
        MAX_PROJECT_DESCRIPTION_LEN,
    )?;

    let name = payload.name.trim();

    let color = payload.color.as_deref().unwrap_or("#6366F1");
    if color.len() != 7
        || !color.starts_with('#')
        || !color[1..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err(AppError::BadRequest(
            "Invalid color format. Use #RRGGBB".into(),
        ));
    }

    let team = teams::create_team(
        &state.db,
        name,
        payload.description.as_deref(),
        color,
        workspace_id,
        auth.0.user_id,
    )
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("teams_workspace_id_name_key") {
                return AppError::Conflict("A team with this name already exists".into());
            }
        }
        AppError::SqlxError(e)
    })?;

    Ok(Json(TeamDetailResponse {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        workspace_id: team.workspace_id,
        created_by_id: team.created_by_id,
        created_at: team.created_at,
        updated_at: team.updated_at,
        members: vec![],
    }))
}

/// GET /api/teams/:id
async fn get_team(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<TeamDetailResponse>> {
    let team = teams::get_team_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    // Verify workspace belongs to caller's tenant
    workspaces::get_workspace_by_id(&state.db, team.workspace_id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    // Verify workspace membership
    let is_member =
        workspaces::is_workspace_member(&state.db, team.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let members = teams::list_team_members(&state.db, id).await?;

    let member_responses: Vec<TeamMemberResponse> = members
        .into_iter()
        .map(|m| TeamMemberResponse {
            id: m.id,
            team_id: m.team_id,
            user_id: m.user_id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
            added_at: m.added_at,
        })
        .collect();

    Ok(Json(TeamDetailResponse {
        id: team.id,
        name: team.name,
        description: team.description,
        color: team.color,
        workspace_id: team.workspace_id,
        created_by_id: team.created_by_id,
        created_at: team.created_at,
        updated_at: team.updated_at,
        members: member_responses,
    }))
}

/// PUT /api/teams/:id
async fn update_team(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTeamRequest>,
) -> Result<Json<TeamDetailResponse>> {
    let team = teams::get_team_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    // Verify workspace belongs to caller's tenant
    workspaces::get_workspace_by_id(&state.db, team.workspace_id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let is_member =
        workspaces::is_workspace_member(&state.db, team.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    validate_required_string("Team name", &payload.name, MAX_NAME_LEN)?;
    validate_optional_string(
        "Description",
        payload.description.as_deref(),
        MAX_PROJECT_DESCRIPTION_LEN,
    )?;

    let name = payload.name.trim();

    let color = payload.color.as_deref().unwrap_or(&team.color);
    if color.len() != 7
        || !color.starts_with('#')
        || !color[1..].chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err(AppError::BadRequest(
            "Invalid color format. Use #RRGGBB".into(),
        ));
    }

    let updated = teams::update_team(&state.db, id, name, payload.description.as_deref(), color)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref db_err) = e {
                if db_err.constraint() == Some("teams_workspace_id_name_key") {
                    return AppError::Conflict("A team with this name already exists".into());
                }
            }
            AppError::SqlxError(e)
        })?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let members = teams::list_team_members(&state.db, id).await?;

    let member_responses: Vec<TeamMemberResponse> = members
        .into_iter()
        .map(|m| TeamMemberResponse {
            id: m.id,
            team_id: m.team_id,
            user_id: m.user_id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
            added_at: m.added_at,
        })
        .collect();

    Ok(Json(TeamDetailResponse {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        color: updated.color,
        workspace_id: updated.workspace_id,
        created_by_id: updated.created_by_id,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        members: member_responses,
    }))
}

/// DELETE /api/teams/:id
async fn delete_team(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    let team = teams::get_team_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    // Verify workspace belongs to caller's tenant
    workspaces::get_workspace_by_id(&state.db, team.workspace_id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let is_member =
        workspaces::is_workspace_member(&state.db, team.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let deleted = teams::delete_team(&state.db, id).await?;

    if deleted {
        Ok(Json(MessageResponse {
            message: "Team deleted successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Team not found".into()))
    }
}

/// POST /api/teams/:id/members
async fn add_team_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddTeamMemberRequest>,
) -> Result<Json<MessageResponse>> {
    let team = teams::get_team_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    // Verify workspace belongs to caller's tenant
    workspaces::get_workspace_by_id(&state.db, team.workspace_id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let is_member =
        workspaces::is_workspace_member(&state.db, team.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Verify the user being added is also a workspace member
    let is_target_member =
        workspaces::is_workspace_member(&state.db, team.workspace_id, payload.user_id).await?;
    if !is_target_member {
        return Err(AppError::BadRequest(
            "User must be a workspace member first".into(),
        ));
    }

    teams::add_team_member(&state.db, id, payload.user_id).await?;

    Ok(Json(MessageResponse {
        message: "Member added successfully".into(),
    }))
}

/// DELETE /api/teams/:id/members/:user_id
async fn remove_team_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    let team = teams::get_team_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    // Verify workspace belongs to caller's tenant
    workspaces::get_workspace_by_id(&state.db, team.workspace_id, auth.0.tenant_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Team not found".into()))?;

    let is_member =
        workspaces::is_workspace_member(&state.db, team.workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let removed = teams::remove_team_member(&state.db, id, user_id).await?;

    if removed {
        Ok(Json(MessageResponse {
            message: "Member removed successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Team member not found".into()))
    }
}

// ============================================================================
// Routers
// ============================================================================

/// Build the teams router for workspace-scoped routes
/// Routes: /api/workspaces/:workspace_id/teams
pub fn workspace_teams_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_teams).post(create_team))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the teams router for direct team routes
/// Routes: /api/teams/:id
pub fn teams_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/{id}", get(get_team).put(update_team).delete(delete_team))
        .route("/{id}/members", axum::routing::post(add_team_member))
        .route("/{id}/members/{user_id}", delete(remove_team_member))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
