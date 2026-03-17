use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::recurring::{
    create_config, delete_config, get_config_for_task, update_config, CreateRecurringInput,
    RecurringQueryError, UpdateRecurringInput,
};

/// Map RecurringQueryError to AppError
fn map_recurring_error(e: RecurringQueryError) -> AppError {
    match e {
        RecurringQueryError::NotFound => AppError::NotFound("Recurring config not found".into()),
        RecurringQueryError::TaskNotFound => AppError::NotFound("Task not found".into()),
        RecurringQueryError::NotBoardMember => AppError::Forbidden("Not a project member".into()),
        RecurringQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/tasks/{task_id}/recurring
/// Get recurring config for a task
async fn get_config_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<taskflow_db::models::RecurringTaskConfig>> {
    let config = get_config_for_task(&state.db, task_id, tenant.user_id)
        .await
        .map_err(map_recurring_error)?;

    Ok(Json(config))
}

/// POST /api/tasks/{task_id}/recurring
/// Create recurring config for a task
async fn create_config_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<CreateRecurringInput>,
) -> Result<Json<taskflow_db::models::RecurringTaskConfig>> {
    let config = create_config(&state.db, task_id, body, tenant.user_id, tenant.tenant_id)
        .await
        .map_err(map_recurring_error)?;

    Ok(Json(config))
}

/// PUT /api/recurring/{id}
/// Update recurring config
async fn update_config_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(config_id): Path<Uuid>,
    Json(body): Json<UpdateRecurringInput>,
) -> Result<Json<taskflow_db::models::RecurringTaskConfig>> {
    let config = update_config(&state.db, config_id, body, tenant.user_id)
        .await
        .map_err(map_recurring_error)?;

    Ok(Json(config))
}

/// DELETE /api/recurring/{id}
/// Delete recurring config
async fn delete_config_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(config_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_config(&state.db, config_id, tenant.user_id)
        .await
        .map_err(map_recurring_error)?;

    Ok(Json(json!({ "success": true })))
}

/// Create the recurring router
pub fn recurring_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Task-scoped recurring routes
        .route("/tasks/{task_id}/recurring", get(get_config_handler))
        .route("/tasks/{task_id}/recurring", post(create_config_handler))
        // Recurring-specific routes
        .route("/recurring/{id}", put(update_config_handler))
        .route("/recurring/{id}", delete(delete_config_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
