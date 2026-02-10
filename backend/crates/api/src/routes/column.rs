//! Board Column REST endpoints
//!
//! Provides CRUD operations for board columns.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::BoardMemberRole;
use taskflow_db::queries::{boards, columns, DeleteColumnResult};
use taskflow_db::utils::generate_key_between;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateColumnRequest {
    pub name: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
    /// Optional: index position to insert at (0-based). If not provided, adds at the end.
    pub insert_at: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RenameColumnRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct ReorderColumnRequest {
    /// The new index position (0-based)
    pub new_index: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusMappingRequest {
    pub status_mapping: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateColumnColorRequest {
    pub color: Option<String>,
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
pub struct MessageResponse {
    pub message: String,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Check if user has editor access to the board
async fn require_editor_access(
    state: &AppState,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let role = boards::get_board_member_role(&state.db, board_id, user_id).await?;
    match role {
        Some(BoardMemberRole::Editor) => Ok(()),
        Some(BoardMemberRole::Viewer) => {
            Err(AppError::Forbidden("Editor role required".into()))
        }
        None => Err(AppError::NotFound("Board not found or access denied".into())),
    }
}

/// Check if user has at least viewer access to the board
async fn require_viewer_access(
    state: &AppState,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    let is_member = boards::is_board_member(&state.db, board_id, user_id).await?;
    if !is_member {
        return Err(AppError::NotFound("Board not found or access denied".into()));
    }
    Ok(())
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/boards/:board_id/columns
///
/// List all columns for a board ordered by position.
async fn list_columns(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<ColumnResponse>>> {
    require_viewer_access(&state, board_id, auth.0.user_id).await?;

    let cols = columns::list_columns_by_board(&state.db, board_id).await?;

    let response: Vec<ColumnResponse> = cols
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
        .collect();

    Ok(Json(response))
}

/// POST /api/boards/:board_id/columns
///
/// Add a new column to a board.
async fn create_column(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<CreateColumnRequest>,
) -> Result<Json<ColumnResponse>> {
    require_editor_access(&state, board_id, auth.0.user_id).await?;

    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Column name is required".into()));
    }

    // Calculate position
    let existing_columns = columns::list_columns_by_board(&state.db, board_id).await?;

    let position = if let Some(insert_at) = payload.insert_at {
        // Insert at specific position
        let insert_at = insert_at.max(0) as usize;

        if insert_at == 0 {
            // Insert at beginning
            let first_pos = existing_columns.first().map(|c| c.position.as_str());
            generate_key_between(None, first_pos)
        } else if insert_at >= existing_columns.len() {
            // Insert at end
            let last_pos = existing_columns.last().map(|c| c.position.as_str());
            generate_key_between(last_pos, None)
        } else {
            // Insert between two columns
            let prev_pos = existing_columns.get(insert_at - 1).map(|c| c.position.as_str());
            let next_pos = existing_columns.get(insert_at).map(|c| c.position.as_str());
            generate_key_between(prev_pos, next_pos)
        }
    } else {
        // Add at end
        let last_pos = existing_columns.last().map(|c| c.position.as_str());
        generate_key_between(last_pos, None)
    };

    let column = columns::add_column(
        &state.db,
        board_id,
        &payload.name,
        payload.color.as_deref(),
        payload.status_mapping,
        &position,
    )
    .await?;

    Ok(Json(ColumnResponse {
        id: column.id,
        name: column.name,
        board_id: column.board_id,
        position: column.position,
        color: column.color,
        status_mapping: column.status_mapping,
        created_at: column.created_at,
    }))
}

/// PUT /api/columns/:id/name
///
/// Rename a column.
async fn rename_column(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<RenameColumnRequest>,
) -> Result<Json<ColumnResponse>> {
    // Get column to find board_id
    let existing = columns::get_column_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    require_editor_access(&state, existing.board_id, auth.0.user_id).await?;

    if payload.name.is_empty() {
        return Err(AppError::BadRequest("Column name is required".into()));
    }

    let column = columns::rename_column(&state.db, id, &payload.name)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    Ok(Json(ColumnResponse {
        id: column.id,
        name: column.name,
        board_id: column.board_id,
        position: column.position,
        color: column.color,
        status_mapping: column.status_mapping,
        created_at: column.created_at,
    }))
}

/// PUT /api/columns/:id/position
///
/// Reorder a column to a new position.
async fn reorder_column(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<ReorderColumnRequest>,
) -> Result<Json<ColumnResponse>> {
    // Get column to find board_id
    let existing = columns::get_column_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    require_editor_access(&state, existing.board_id, auth.0.user_id).await?;

    // Get all columns to calculate new position
    let all_columns = columns::list_columns_by_board(&state.db, existing.board_id).await?;

    // Find current index
    let current_index = all_columns.iter().position(|c| c.id == id)
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    let new_index = payload.new_index.max(0) as usize;

    // If same position, no change needed
    if current_index == new_index {
        return Ok(Json(ColumnResponse {
            id: existing.id,
            name: existing.name,
            board_id: existing.board_id,
            position: existing.position,
            color: existing.color,
            status_mapping: existing.status_mapping,
            created_at: existing.created_at,
        }));
    }

    // Calculate new position key
    let new_position = if new_index == 0 {
        // Move to beginning
        let first = all_columns.first().filter(|c| c.id != id);
        generate_key_between(None, first.map(|c| c.position.as_str()))
    } else if new_index >= all_columns.len() - 1 {
        // Move to end
        let last = all_columns.last().filter(|c| c.id != id);
        generate_key_between(last.map(|c| c.position.as_str()), None)
    } else {
        // Move between two columns (excluding self)
        let filtered: Vec<_> = all_columns.iter().filter(|c| c.id != id).collect();
        let target_index = new_index.min(filtered.len() - 1);

        if target_index == 0 {
            generate_key_between(None, filtered.first().map(|c| c.position.as_str()))
        } else {
            let prev = filtered.get(target_index - 1).map(|c| c.position.as_str());
            let next = filtered.get(target_index).map(|c| c.position.as_str());
            generate_key_between(prev, next)
        }
    };

    let column = columns::reorder_column(&state.db, id, &new_position)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    Ok(Json(ColumnResponse {
        id: column.id,
        name: column.name,
        board_id: column.board_id,
        position: column.position,
        color: column.color,
        status_mapping: column.status_mapping,
        created_at: column.created_at,
    }))
}

/// PUT /api/columns/:id/status-mapping
///
/// Update a column's status mapping.
async fn update_status_mapping(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateStatusMappingRequest>,
) -> Result<Json<ColumnResponse>> {
    // Get column to find board_id
    let existing = columns::get_column_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    require_editor_access(&state, existing.board_id, auth.0.user_id).await?;

    let column = columns::update_status_mapping(&state.db, id, payload.status_mapping)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    Ok(Json(ColumnResponse {
        id: column.id,
        name: column.name,
        board_id: column.board_id,
        position: column.position,
        color: column.color,
        status_mapping: column.status_mapping,
        created_at: column.created_at,
    }))
}

/// PUT /api/columns/:id/color
///
/// Update a column's color.
async fn update_color(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateColumnColorRequest>,
) -> Result<Json<ColumnResponse>> {
    // Get column to find board_id
    let existing = columns::get_column_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    require_editor_access(&state, existing.board_id, auth.0.user_id).await?;

    let column = columns::update_column_color(&state.db, id, payload.color.as_deref())
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    Ok(Json(ColumnResponse {
        id: column.id,
        name: column.name,
        board_id: column.board_id,
        position: column.position,
        color: column.color,
        status_mapping: column.status_mapping,
        created_at: column.created_at,
    }))
}

/// DELETE /api/columns/:id
///
/// Delete a column. Fails if the column has tasks.
async fn delete_column(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    // Get column to find board_id
    let existing = columns::get_column_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Column not found".into()))?;

    require_editor_access(&state, existing.board_id, auth.0.user_id).await?;

    match columns::delete_column(&state.db, id).await? {
        DeleteColumnResult::Deleted => Ok(Json(MessageResponse {
            message: "Column deleted successfully".into(),
        })),
        DeleteColumnResult::NotFound => Err(AppError::NotFound("Column not found".into())),
        DeleteColumnResult::HasTasks => Err(AppError::PreconditionFailed(
            "Cannot delete column with tasks. Move or delete tasks first.".into(),
        )),
    }
}

// ============================================================================
// Routers
// ============================================================================

/// Build the columns router for board-scoped routes
/// Routes: /api/boards/:board_id/columns
pub fn board_columns_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_columns).post(create_column))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the columns router for direct column routes
/// Routes: /api/columns/:id
pub fn column_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/{id}", delete(delete_column))
        .route("/{id}/name", put(rename_column))
        .route("/{id}/position", put(reorder_column))
        .route("/{id}/status-mapping", put(update_status_mapping))
        .route("/{id}/color", put(update_color))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
