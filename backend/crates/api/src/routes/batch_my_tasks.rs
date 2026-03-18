//! Batch My Tasks API route
//!
//! Bulk update tasks from the my-tasks view with per-task RBAC.

use axum::{extract::State, middleware::from_fn_with_state, routing::post, Json, Router};

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::batch_my_tasks::{
    self, BatchMyTasksError, BatchMyTasksInput, BatchMyTasksResult,
};

/// POST /api/my-tasks/batch
///
/// Bulk update tasks (max 50 per request) with RBAC per task.
async fn batch_update_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Json(input): Json<BatchMyTasksInput>,
) -> Result<Json<BatchMyTasksResult>> {
    let result = batch_my_tasks::batch_update_my_tasks(&state.db, tenant.user_id, &input)
        .await
        .map_err(map_batch_error)?;

    Ok(Json(result))
}

/// Map BatchMyTasksError to AppError
fn map_batch_error(e: BatchMyTasksError) -> AppError {
    match e {
        BatchMyTasksError::TooMany(msg) => AppError::BadRequest(msg),
        BatchMyTasksError::Database(e) => AppError::SqlxError(e),
    }
}

/// Build the batch my-tasks router
pub fn batch_my_tasks_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/my-tasks/batch", post(batch_update_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
