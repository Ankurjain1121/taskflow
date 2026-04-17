//! Eisenhower Matrix API routes
//!
//! Provides endpoints for the Eisenhower Matrix view (2x2 prioritization grid).

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{get, put},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::queries::eisenhower::{
    EisenhowerFilters, EisenhowerMatrixResponse, get_eisenhower_matrix, reset_eisenhower_overrides,
    update_eisenhower_overrides,
};
use taskbolt_db::queries::get_task_project_id;
use taskbolt_db::queries::membership::verify_project_membership;

/// Query parameters for filtering the Eisenhower Matrix
#[derive(Debug, Deserialize)]
pub struct EisenhowerQueryParams {
    pub workspace_id: Option<Uuid>,
    pub board_id: Option<Uuid>,
    pub daily: Option<bool>,
}

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
/// Get all tasks assigned to the current user, grouped by Eisenhower Matrix quadrants.
/// Optional query params: workspace_id, board_id, daily (bool)
async fn get_eisenhower_matrix_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(params): Query<EisenhowerQueryParams>,
) -> Result<Json<EisenhowerMatrixResponse>> {
    let filters = EisenhowerFilters {
        workspace_id: params.workspace_id,
        board_id: params.board_id,
        daily: params.daily.unwrap_or(false),
    };

    let matrix = get_eisenhower_matrix(&state.db, tenant.user_id, &filters).await?;

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
    // Verify user has access to the task via project membership
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let is_member = verify_project_membership(&state.db, project_id, tenant.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
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
/// - GET / - Get Eisenhower Matrix with all quadrants (supports ?workspace_id, ?board_id, ?daily)
/// - PUT /tasks/:id - Update task's manual overrides
/// - PUT /reset - Reset all overrides to auto-compute
pub fn eisenhower_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(get_eisenhower_matrix_handler))
        .route("/tasks/{id}", put(update_task_eisenhower))
        .route("/reset", put(reset_eisenhower))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
