use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::models::task_template::TaskTemplate;
use taskbolt_db::queries::task_templates::{
    CreateTaskTemplateInput, TaskTemplateQueryError, TaskTemplateWithDetails,
    UpdateTaskTemplateInput, create_task_from_template, create_task_template, delete_task_template,
    get_task_template, list_task_templates, save_task_as_template, update_task_template,
};

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub scope: Option<String>,
    pub board_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct SaveAsTemplateRequest {
    pub name: String,
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFromTemplateRequest {
    pub board_id: Uuid,
    pub column_id: Uuid,
}

/// GET /api/task-templates
async fn list_templates(
    State(state): State<AppState>,
    tenant: TenantContext,
    Query(params): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<TaskTemplate>>> {
    let templates = list_task_templates(
        &state.db,
        tenant.tenant_id,
        params.scope.as_deref(),
        params.board_id,
        tenant.user_id,
    )
    .await
    .map_err(|e| match e {
        TaskTemplateQueryError::Database(e) => AppError::SqlxError(e),
        _ => AppError::InternalError(e.to_string()),
    })?;

    Ok(Json(templates))
}

/// GET /api/task-templates/:id
async fn get_template(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(template_id): Path<Uuid>,
) -> Result<Json<TaskTemplateWithDetails>> {
    let template = get_task_template(&state.db, template_id, tenant.tenant_id)
        .await
        .map_err(|e| match e {
            TaskTemplateQueryError::NotFound => AppError::NotFound("Template not found".into()),
            TaskTemplateQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(e.to_string()),
        })?;

    Ok(Json(template))
}

/// POST /api/task-templates
async fn create_template(
    State(state): State<AppState>,
    tenant: TenantContext,
    Json(input): Json<CreateTaskTemplateInput>,
) -> Result<Json<TaskTemplate>> {
    let template = create_task_template(&state.db, input, tenant.tenant_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskTemplateQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(e.to_string()),
        })?;

    Ok(Json(template))
}

/// PUT /api/task-templates/:id
async fn update_template(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(template_id): Path<Uuid>,
    Json(input): Json<UpdateTaskTemplateInput>,
) -> Result<Json<TaskTemplate>> {
    let template = update_task_template(
        &state.db,
        template_id,
        input,
        tenant.tenant_id,
        tenant.user_id,
    )
    .await
    .map_err(|e| match e {
        TaskTemplateQueryError::NotFound => AppError::NotFound("Template not found".into()),
        TaskTemplateQueryError::NotAuthorized => {
            AppError::Forbidden("Not authorized to update this template".into())
        }
        TaskTemplateQueryError::Database(e) => AppError::SqlxError(e),
        TaskTemplateQueryError::TaskNotFound => AppError::InternalError(e.to_string()),
    })?;

    Ok(Json(template))
}

/// DELETE /api/task-templates/:id
async fn delete_template(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(template_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_task_template(&state.db, template_id, tenant.tenant_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskTemplateQueryError::NotFound => AppError::NotFound("Template not found".into()),
            TaskTemplateQueryError::NotAuthorized => {
                AppError::Forbidden("Not authorized to delete this template".into())
            }
            TaskTemplateQueryError::Database(e) => AppError::SqlxError(e),
            TaskTemplateQueryError::TaskNotFound => AppError::InternalError(e.to_string()),
        })?;

    Ok(Json(serde_json::json!({ "success": true })))
}

/// POST /api/tasks/:task_id/save-as-template
async fn save_as_template(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<SaveAsTemplateRequest>,
) -> Result<Json<TaskTemplate>> {
    let template = save_task_as_template(
        &state.db,
        task_id,
        body.name,
        body.scope,
        tenant.user_id,
        tenant.tenant_id,
    )
    .await
    .map_err(|e| match e {
        TaskTemplateQueryError::TaskNotFound => AppError::NotFound("Task not found".into()),
        TaskTemplateQueryError::Database(e) => AppError::SqlxError(e),
        _ => AppError::InternalError(e.to_string()),
    })?;

    Ok(Json(template))
}

/// POST /api/task-templates/:id/create-task
async fn create_from_template(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(template_id): Path<Uuid>,
    Json(body): Json<CreateFromTemplateRequest>,
) -> Result<Json<serde_json::Value>> {
    let task_id = create_task_from_template(
        &state.db,
        template_id,
        body.board_id,
        body.column_id,
        tenant.tenant_id,
        tenant.user_id,
    )
    .await
    .map_err(|e| match e {
        TaskTemplateQueryError::NotFound => AppError::NotFound("Template not found".into()),
        TaskTemplateQueryError::Database(e) => AppError::SqlxError(e),
        _ => AppError::InternalError(e.to_string()),
    })?;

    Ok(Json(serde_json::json!({ "task_id": task_id })))
}

/// Build the task template router
pub fn task_template_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/task-templates", get(list_templates))
        .route("/task-templates", post(create_template))
        .route("/task-templates/{id}", get(get_template))
        .route("/task-templates/{id}", put(update_template))
        .route("/task-templates/{id}", delete(delete_template))
        .route(
            "/task-templates/{id}/create-task",
            post(create_from_template),
        )
        .route("/tasks/{task_id}/save-as-template", post(save_as_template))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
