use axum::{
    Json, Router,
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::models::TaskTemplateData;
use taskbolt_db::queries::recurring::{
    CreateRecurringInput, CreateTemplateRecurringInput, RecurringConfigWithTask,
    RecurringQueryError, UpdateRecurringInput, create_config, create_template_config,
    delete_config, get_config_for_task, list_configs_for_project, update_config,
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

/// GET /api/projects/{board_id}/recurring
/// List all recurring configs for a project
async fn list_configs_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<RecurringConfigWithTask>>> {
    let configs = list_configs_for_project(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_recurring_error)?;

    Ok(Json(configs))
}

/// GET /api/tasks/{task_id}/recurring
/// Get recurring config for a task
async fn get_config_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<taskbolt_db::models::RecurringTaskConfig>> {
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
) -> Result<Json<taskbolt_db::models::RecurringTaskConfig>> {
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
) -> Result<Json<taskbolt_db::models::RecurringTaskConfig>> {
    let config = update_config(&state.db, config_id, body, tenant.user_id)
        .await
        .map_err(map_recurring_error)?;

    Ok(Json(config))
}

/// Request body for creating a template-based recurring config.
#[derive(Debug, serde::Deserialize)]
pub struct CreateTemplateRecurringRequest {
    pub template: TaskTemplateData,
    pub pattern: taskbolt_db::models::RecurrencePattern,
    pub start_date: String,
    pub day_of_month: Option<i32>,
    pub creation_mode: Option<String>,
    pub skip_weekends: Option<bool>,
    pub days_of_week: Option<Vec<i32>>,
    pub max_occurrences: Option<i32>,
    pub end_date: Option<String>,
}

/// POST /api/projects/{project_id}/recurring
/// Create a template-based recurring config (no source task needed)
async fn create_template_config_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(project_id): Path<Uuid>,
    Json(body): Json<CreateTemplateRecurringRequest>,
) -> Result<Json<taskbolt_db::models::RecurringTaskConfig>> {
    let start_date: chrono::DateTime<chrono::Utc> = body.start_date.parse().map_err(|_| {
        AppError::BadRequest("Invalid start_date format (expected ISO 8601)".into())
    })?;

    let end_date = body
        .end_date
        .as_deref()
        .map(|s| {
            s.parse::<chrono::DateTime<chrono::Utc>>().map_err(|_| {
                AppError::BadRequest("Invalid end_date format (expected ISO 8601)".into())
            })
        })
        .transpose()?;

    let input = CreateTemplateRecurringInput {
        template: body.template,
        pattern: body.pattern,
        start_date,
        day_of_month: body.day_of_month,
        creation_mode: body.creation_mode,
        skip_weekends: body.skip_weekends,
        days_of_week: body.days_of_week,
        max_occurrences: body.max_occurrences,
        end_date,
    };

    let config = create_template_config(
        &state.db,
        project_id,
        tenant.user_id,
        tenant.tenant_id,
        input,
    )
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
        // Project-scoped recurring routes
        .route(
            "/projects/{board_id}/recurring",
            get(list_configs_handler).post(create_template_config_handler),
        )
        // Task-scoped recurring routes
        .route("/tasks/{task_id}/recurring", get(get_config_handler))
        .route("/tasks/{task_id}/recurring", post(create_config_handler))
        // Recurring-specific routes
        .route("/recurring/{id}", put(update_config_handler))
        .route("/recurring/{id}", delete(delete_config_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
