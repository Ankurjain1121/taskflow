//! Position REST endpoints
//!
//! Provides CRUD operations for board-level positions and holder management.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use taskbolt_db::models::{PositionWithHolders, RecurringTaskConfig};
use taskbolt_db::queries::{positions, projects};

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::MessageResponse;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct AddHolderRequest {
    pub user_id: Uuid,
}

// ============================================================================
// Helpers
// ============================================================================

/// Build a PositionWithHolders from a Position by fetching holders and recurring count.
async fn build_position_with_holders(
    state: &AppState,
    position: taskbolt_db::models::Position,
) -> Result<PositionWithHolders> {
    let holders = positions::list_holders(&state.db, position.id).await?;
    let recurring_configs =
        positions::list_recurring_tasks_for_position(&state.db, position.id).await?;
    let recurring_task_count = recurring_configs.len() as i64;

    let fallback_position_name = if let Some(fid) = position.fallback_position_id {
        positions::get_position(&state.db, fid)
            .await?
            .map(|p| p.name)
    } else {
        None
    };

    Ok(PositionWithHolders {
        id: position.id,
        name: position.name,
        description: position.description,
        project_id: position.project_id,
        fallback_position_id: position.fallback_position_id,
        fallback_position_name,
        tenant_id: position.tenant_id,
        created_by_id: position.created_by_id,
        created_at: position.created_at,
        updated_at: position.updated_at,
        holders,
        recurring_task_count,
    })
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/boards/:board_id/positions
async fn list_positions(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<PositionWithHolders>>> {
    let is_member = projects::is_project_member(&state.db, board_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let list = positions::list_positions(&state.db, board_id).await?;
    Ok(Json(list))
}

/// POST /api/boards/:board_id/positions
async fn create_position(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<taskbolt_db::models::CreatePositionRequest>,
) -> Result<Json<PositionWithHolders>> {
    let is_member = projects::is_project_member(&state.db, board_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Position name is required".into()));
    }

    let position = positions::create_position(
        &state.db,
        name,
        payload.description.as_deref(),
        payload.fallback_position_id,
        board_id,
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("positions_board_id_name_key") {
                return AppError::Conflict(
                    "A position with this name already exists on this board".into(),
                );
            }
        }
        AppError::SqlxError(e)
    })?;

    let response = build_position_with_holders(&state, position).await?;
    Ok(Json(response))
}

/// GET /api/positions/:id
async fn get_position(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<PositionWithHolders>> {
    let position = positions::get_position(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let is_member =
        projects::is_project_member(&state.db, position.project_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let response = build_position_with_holders(&state, position).await?;
    Ok(Json(response))
}

/// PUT /api/positions/:id
async fn update_position(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<taskbolt_db::models::UpdatePositionRequest>,
) -> Result<Json<PositionWithHolders>> {
    let existing = positions::get_position(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let is_member =
        projects::is_project_member(&state.db, existing.project_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    if let Some(ref name) = payload.name {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest("Position name cannot be empty".into()));
        }
    }

    let updated = positions::update_position(
        &state.db,
        id,
        payload.name.as_deref(),
        payload.description.as_deref(),
        payload.fallback_position_id,
    )
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("positions_board_id_name_key") {
                return AppError::Conflict(
                    "A position with this name already exists on this board".into(),
                );
            }
        }
        AppError::SqlxError(e)
    })?
    .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let response = build_position_with_holders(&state, updated).await?;
    Ok(Json(response))
}

/// DELETE /api/positions/:id
async fn delete_position(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    let existing = positions::get_position(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let is_member =
        projects::is_project_member(&state.db, existing.project_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let deleted = positions::delete_position(&state.db, id).await?;

    if deleted {
        Ok(Json(MessageResponse {
            message: "Position deleted successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Position not found".into()))
    }
}

/// POST /api/positions/:id/holders
async fn add_holder(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddHolderRequest>,
) -> Result<Json<MessageResponse>> {
    let position = positions::get_position(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let is_member =
        projects::is_project_member(&state.db, position.project_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    // Verify the target user is also a board member
    let is_target_member =
        projects::is_project_member(&state.db, position.project_id, payload.user_id).await?;
    if !is_target_member {
        return Err(AppError::BadRequest(
            "User must be a project member first".into(),
        ));
    }

    positions::add_holder(&state.db, id, payload.user_id).await?;

    Ok(Json(MessageResponse {
        message: "Holder added successfully".into(),
    }))
}

/// DELETE /api/positions/:id/holders/:user_id
async fn remove_holder(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    let position = positions::get_position(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let is_member =
        projects::is_project_member(&state.db, position.project_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let removed = positions::remove_holder(&state.db, id, user_id).await?;

    if removed {
        Ok(Json(MessageResponse {
            message: "Holder removed successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Position holder not found".into()))
    }
}

/// GET /api/positions/:id/recurring-tasks
async fn list_position_recurring_tasks(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<RecurringTaskConfig>>> {
    let position = positions::get_position(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Position not found".into()))?;

    let is_member =
        projects::is_project_member(&state.db, position.project_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let configs = positions::list_recurring_tasks_for_position(&state.db, id).await?;
    Ok(Json(configs))
}

// ============================================================================
// Routers
// ============================================================================

/// Board-scoped routes: /api/boards/:board_id/positions
pub fn board_positions_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_positions).post(create_position))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Direct position routes: /api/positions/:id
pub fn positions_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/{id}",
            get(get_position)
                .put(update_position)
                .delete(delete_position),
        )
        .route("/{id}/holders", post(add_holder))
        .route("/{id}/holders/{user_id}", delete(remove_holder))
        .route("/{id}/recurring-tasks", get(list_position_recurring_tasks))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
