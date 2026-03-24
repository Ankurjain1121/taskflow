//! Personal Work Board API routes
//!
//! Endpoints for managing the user's personal kanban board.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{get, put},
    Json, Router,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::queries::personal_board::{
    self, MovePersonalTaskInput, PersonalBoardError, PersonalBoardResponse,
};

/// GET /api/my-work/board
///
/// Get the user's personal kanban board state.
async fn get_personal_board_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<PersonalBoardResponse>> {
    let board = personal_board::get_personal_board(&state.db, tenant.user_id).await?;
    Ok(Json(board))
}

/// PUT /api/my-work/board/:task_id
///
/// Move a task to a column/position on the personal board.
async fn move_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(input): Json<MovePersonalTaskInput>,
) -> Result<Json<serde_json::Value>> {
    personal_board::move_personal_task(&state.db, tenant.user_id, task_id, &input)
        .await
        .map_err(map_personal_board_error)?;

    Ok(Json(serde_json::json!({ "message": "Task moved" })))
}

/// Map PersonalBoardError to AppError
fn map_personal_board_error(e: PersonalBoardError) -> AppError {
    match e {
        PersonalBoardError::InvalidColumn(col) => {
            AppError::BadRequest(format!("Invalid column: {}", col))
        }
        PersonalBoardError::TaskNotAccessible => {
            AppError::Forbidden("Task not accessible or not found".into())
        }
        PersonalBoardError::Database(e) => AppError::SqlxError(e),
    }
}

/// Build the personal board router
pub fn personal_board_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/my-work/board", get(get_personal_board_handler))
        .route("/my-work/board/{task_id}", put(move_task_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
