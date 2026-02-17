//! Eisenhower Matrix API routes
//!
//! Provides endpoints for the Eisenhower Matrix view (2×2 prioritization grid).

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::eisenhower::{
    get_eisenhower_matrix, reset_eisenhower_overrides, update_eisenhower_overrides,
    EisenhowerMatrixResponse,
};
use taskflow_db::queries::get_task_board_id;

/// Request body for updating Eisenhower overrides
#[derive(Debug, Deserialize)]
pub struct UpdateEisenhowerRequest {
    pub urgency: Option<bool>,
    pub importance: Option<bool>,
}

/// Response for reset operation
#[derive(Debug, Serialize)]
pub struct ResetEisenhowerResponse {
    pub tasks_reset: u64,
}

/// GET /api/eisenhower
///
/// Get all tasks assigned to the current user, grouped by Eisenhower Matrix quadrants:
/// - do_first: Urgent + Important
/// - schedule: Not Urgent + Important
/// - delegate: Urgent + Not Important
/// - eliminate: Not Urgent + Not Important
async fn get_eisenhower_matrix_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<EisenhowerMatrixResponse>> {
    let matrix = get_eisenhower_matrix(&state.db, tenant.user_id).await?;

    Ok(Json(matrix))
}

/// PUT /api/eisenhower/tasks/:id
///
/// Update manual overrides for a task's urgency and importance.
/// Set to null to use auto-computation based on due_date and priority.
async fn update_task_eisenhower(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(req): Json<UpdateEisenhowerRequest>,
) -> Result<Json<()>> {
    // Verify user has access to the task via board membership
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let is_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)",
    )
    .bind(board_id)
    .bind(tenant.user_id)
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    update_eisenhower_overrides(&state.db, task_id, req.urgency, req.importance).await?;

    Ok(Json(()))
}

/// PUT /api/eisenhower/reset
///
/// Reset all manual overrides for the current user's tasks.
/// This returns all tasks to auto-computed quadrants.
async fn reset_eisenhower(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<ResetEisenhowerResponse>> {
    let count = reset_eisenhower_overrides(&state.db, tenant.user_id).await?;

    Ok(Json(ResetEisenhowerResponse { tasks_reset: count }))
}

/// Create the eisenhower router
///
/// Routes:
/// - GET / - Get Eisenhower Matrix with all quadrants
/// - PUT /tasks/:id - Update task's manual overrides
/// - PUT /reset - Reset all overrides to auto-compute
pub fn eisenhower_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(get_eisenhower_matrix_handler))
        .route("/tasks/{id}", put(update_task_eisenhower))
        .route("/reset", put(reset_eisenhower))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
