//! Board REST endpoints
//!
//! Provides CRUD operations for boards and board membership management.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::BoardMemberRole;
use taskflow_db::queries::{boards, columns, workspaces};
use taskflow_db::utils::generate_key_between;

use taskflow_services::board_templates;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateBoardRequest {
    pub name: String,
    pub description: Option<String>,
    pub template: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBoardRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddBoardMemberRequest {
    pub user_id: Uuid,
    pub role: BoardMemberRole,
}

#[derive(Debug, Serialize)]
pub struct BoardResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct BoardDetailResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub columns: Vec<ColumnResponse>,
}

#[derive(Debug, Serialize)]
pub struct ColumnResponse {
    pub id: Uuid,
    pub name: String,
    pub board_id: Uuid,
    pub position: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct BoardMemberResponse {
    pub id: Uuid,
    pub board_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
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

/// GET /api/workspaces/:workspace_id/boards
///
/// List all boards in a workspace that the user has access to.
async fn list_boards(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<BoardResponse>>> {
    // Check workspace membership
    let is_member = workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let boards_list = boards::list_boards_by_workspace(&state.db, workspace_id, auth.0.user_id).await?;

    let response: Vec<BoardResponse> = boards_list
        .into_iter()
        .map(|b| BoardResponse {
            id: b.id,
            name: b.name,
            description: b.description,
            slack_webhook_url: b.slack_webhook_url,
            workspace_id: b.workspace_id,
            tenant_id: b.tenant_id,
            created_by_id: b.created_by_id,
            created_at: b.created_at,
            updated_at: b.updated_at,
        })
        .collect();

    Ok(Json(response))
}

/// GET /api/boards/:id
///
/// Get a board by ID with its columns.
async fn get_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<BoardDetailResponse>> {
    let board = boards::get_board_by_id(&state.db, id, auth.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Board not found or access denied".into()))?;

    Ok(Json(BoardDetailResponse {
        id: board.board.id,
        name: board.board.name,
        description: board.board.description,
        slack_webhook_url: board.board.slack_webhook_url,
        workspace_id: board.board.workspace_id,
        tenant_id: board.board.tenant_id,
        created_by_id: board.board.created_by_id,
        created_at: board.board.created_at,
        updated_at: board.board.updated_at,
        columns: board
            .columns
            .into_iter()
            .map(|c| ColumnResponse {
                id: c.id,
                name: c.name,
                board_id: c.board_id,
                position: c.position,
                color: c.color,
                status_mapping: c.status_mapping,
                created_at: c.created_at,
            })
            .collect(),
    }))
}

/// POST /api/workspaces/:workspace_id/boards
///
/// Create a new board with default columns.
async fn create_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateBoardRequest>,
) -> Result<Json<BoardDetailResponse>> {
    // Check workspace membership
    let is_member = workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Board name is required".into()));
    }

    let board = boards::create_board(
        &state.db,
        &payload.name,
        payload.description.as_deref(),
        workspace_id,
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await?;

    // If a template was specified (and it's not the default kanban that create_board already creates),
    // replace the default columns with template columns
    let mut final_columns = board.columns;

    if let Some(ref template_id) = payload.template {
        if let Some(template) = board_templates::get_template(template_id) {
            // Delete the default columns that were auto-created
            for col in &final_columns {
                let _ = columns::force_delete_column(&state.db, col.id).await;
            }
            final_columns.clear();

            if template_id == "blank" {
                // Blank template: no columns
            } else {
                // Create columns from the template
                let mut prev_pos: Option<String> = None;
                for template_col in template.columns {
                    let position = generate_key_between(
                        prev_pos.as_deref(),
                        None,
                    );

                    let status_mapping = if template_col.is_done {
                        Some(serde_json::json!({"done": true}))
                    } else {
                        None
                    };

                    let col = columns::add_column(
                        &state.db,
                        board.board.id,
                        template_col.name,
                        Some(template_col.color),
                        status_mapping,
                        &position,
                    )
                    .await?;

                    prev_pos = Some(position);
                    final_columns.push(col);
                }
            }
        }
    }

    Ok(Json(BoardDetailResponse {
        id: board.board.id,
        name: board.board.name,
        description: board.board.description,
        slack_webhook_url: board.board.slack_webhook_url,
        workspace_id: board.board.workspace_id,
        tenant_id: board.board.tenant_id,
        created_by_id: board.board.created_by_id,
        created_at: board.board.created_at,
        updated_at: board.board.updated_at,
        columns: final_columns
            .into_iter()
            .map(|c| ColumnResponse {
                id: c.id,
                name: c.name,
                board_id: c.board_id,
                position: c.position,
                color: c.color,
                status_mapping: c.status_mapping,
                created_at: c.created_at,
            })
            .collect(),
    }))
}

/// PUT /api/boards/:id
///
/// Update a board's name and description.
async fn update_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBoardRequest>,
) -> Result<Json<BoardResponse>> {
    // Check board membership with editor role
    let role = boards::get_board_member_role(&state.db, id, auth.0.user_id).await?;
    match role {
        Some(BoardMemberRole::Editor) => {}
        Some(BoardMemberRole::Viewer) => {
            return Err(AppError::Forbidden("Editor role required".into()));
        }
        None => {
            return Err(AppError::NotFound("Board not found or access denied".into()));
        }
    }

    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Board name is required".into()));
    }

    let board = boards::update_board(&state.db, id, &payload.name, payload.description.as_deref())
        .await?
        .ok_or_else(|| AppError::NotFound("Board not found".into()))?;

    Ok(Json(BoardResponse {
        id: board.id,
        name: board.name,
        description: board.description,
        slack_webhook_url: board.slack_webhook_url,
        workspace_id: board.workspace_id,
        tenant_id: board.tenant_id,
        created_by_id: board.created_by_id,
        created_at: board.created_at,
        updated_at: board.updated_at,
    }))
}

/// DELETE /api/boards/:id
///
/// Soft-delete a board.
/// Requires Manager or Admin role.
async fn delete_board(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound("Board not found or access denied".into()));
    }

    let deleted = boards::soft_delete_board(&state.db, id).await?;

    if deleted {
        Ok(Json(MessageResponse {
            message: "Board deleted successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Board not found".into()))
    }
}

/// GET /api/boards/:id/members
///
/// List all members of a board.
async fn list_board_members(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<BoardMemberResponse>>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound("Board not found or access denied".into()));
    }

    let members = boards::list_board_members(&state.db, id).await?;

    let response: Vec<BoardMemberResponse> = members
        .into_iter()
        .map(|m| BoardMemberResponse {
            id: m.id,
            board_id: m.board_id,
            user_id: m.user_id,
            role: m.role,
            joined_at: m.joined_at,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
        })
        .collect();

    Ok(Json(response))
}

/// POST /api/boards/:id/members
///
/// Add a user to a board.
/// Requires Manager or Admin role.
async fn add_board_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddBoardMemberRequest>,
) -> Result<Json<MessageResponse>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound("Board not found or access denied".into()));
    }

    // Get board to check workspace membership of the user being added
    let board = boards::get_board_internal(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Board not found".into()))?;

    // Verify user is a workspace member
    let is_ws_member = workspaces::is_workspace_member(&state.db, board.workspace_id, payload.user_id).await?;
    if !is_ws_member {
        return Err(AppError::BadRequest("User must be a workspace member first".into()));
    }

    boards::add_board_member(&state.db, id, payload.user_id, payload.role).await?;

    Ok(Json(MessageResponse {
        message: "Member added successfully".into(),
    }))
}

/// DELETE /api/boards/:id/members/:user_id
///
/// Remove a user from a board.
/// Requires Manager or Admin role.
async fn remove_board_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound("Board not found or access denied".into()));
    }

    let removed = boards::remove_board_member(&state.db, id, user_id).await?;

    if removed {
        Ok(Json(MessageResponse {
            message: "Member removed successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Member not found".into()))
    }
}

/// GET /api/board-templates
///
/// List available board templates.
async fn list_board_templates() -> Json<Vec<board_templates::BoardTemplate>> {
    Json(board_templates::TEMPLATES.to_vec())
}

// ============================================================================
// Routers
// ============================================================================

/// Build the boards router for workspace-scoped routes
/// Routes: /api/workspaces/:workspace_id/boards
pub fn workspace_boards_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_boards).post(create_board))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the boards router for direct board routes
/// Routes: /api/boards/:id
pub fn board_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/{id}", get(get_board).put(update_board).delete(delete_board))
        .route("/{id}/members", get(list_board_members).post(add_board_member))
        .route("/{id}/members/{user_id}", delete(remove_board_member))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the board templates router
/// Routes: /api/board-templates
pub fn board_templates_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_board_templates))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
