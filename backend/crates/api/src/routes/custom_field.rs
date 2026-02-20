use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::models::{BoardCustomField, CustomFieldType, TaskCustomFieldValue};
use taskflow_db::queries::custom_fields::{
    create_custom_field, delete_custom_field, get_task_custom_field_values,
    list_board_custom_fields, set_task_custom_field_values, update_custom_field,
    CreateCustomFieldInput, CustomFieldQueryError, SetFieldValue, TaskCustomFieldValueWithField,
    UpdateCustomFieldInput,
};

/// Map CustomFieldQueryError to AppError
fn map_cf_error(e: CustomFieldQueryError) -> AppError {
    match e {
        CustomFieldQueryError::NotFound => AppError::NotFound("Custom field not found".into()),
        CustomFieldQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
        CustomFieldQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// Request body for creating a custom field
#[derive(Debug, Deserialize)]
pub struct CreateCustomFieldRequest {
    pub name: String,
    pub field_type: CustomFieldType,
    pub options: Option<serde_json::Value>,
    #[serde(default)]
    pub is_required: bool,
}

/// Request body for updating a custom field
#[derive(Debug, Deserialize)]
pub struct UpdateCustomFieldRequest {
    pub name: Option<String>,
    pub options: Option<serde_json::Value>,
    pub is_required: Option<bool>,
    pub position: Option<i32>,
}

/// Request body for setting task custom field values
#[derive(Debug, Deserialize)]
pub struct SetTaskFieldValuesRequest {
    pub values: Vec<SetFieldValue>,
}

/// GET /api/boards/{board_id}/custom-fields
/// List all custom fields for a board
async fn list_custom_fields_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<BoardCustomField>>> {
    let fields = list_board_custom_fields(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_cf_error)?;

    Ok(Json(fields))
}

/// POST /api/boards/{board_id}/custom-fields
/// Create a new custom field on a board
async fn create_custom_field_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateCustomFieldRequest>,
) -> Result<Json<BoardCustomField>> {
    let input = CreateCustomFieldInput {
        board_id,
        name: body.name,
        field_type: body.field_type,
        options: body.options,
        is_required: body.is_required,
        tenant_id: tenant.tenant_id,
        created_by_id: tenant.user_id,
    };

    let field = create_custom_field(&state.db, input)
        .await
        .map_err(map_cf_error)?;

    Ok(Json(field))
}

/// PUT /api/custom-fields/{id}
/// Update an existing custom field
async fn update_custom_field_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(field_id): Path<Uuid>,
    Json(body): Json<UpdateCustomFieldRequest>,
) -> Result<Json<BoardCustomField>> {
    let input = UpdateCustomFieldInput {
        name: body.name,
        options: body.options,
        is_required: body.is_required,
        position: body.position,
    };

    let field = update_custom_field(&state.db, field_id, input, tenant.user_id)
        .await
        .map_err(map_cf_error)?;

    Ok(Json(field))
}

/// DELETE /api/custom-fields/{id}
/// Delete a custom field
async fn delete_custom_field_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(field_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_custom_field(&state.db, field_id, tenant.user_id)
        .await
        .map_err(map_cf_error)?;

    Ok(Json(json!({ "success": true })))
}

/// GET /api/tasks/{task_id}/custom-fields
/// Get all custom field values for a task
async fn get_task_field_values_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<TaskCustomFieldValueWithField>>> {
    let values = get_task_custom_field_values(&state.db, task_id, tenant.user_id)
        .await
        .map_err(map_cf_error)?;

    Ok(Json(values))
}

/// PUT /api/tasks/{task_id}/custom-fields
/// Set custom field values for a task
async fn set_task_field_values_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<SetTaskFieldValuesRequest>,
) -> Result<Json<Vec<TaskCustomFieldValue>>> {
    let values = set_task_custom_field_values(&state.db, task_id, tenant.user_id, body.values)
        .await
        .map_err(map_cf_error)?;

    Ok(Json(values))
}

/// Create the custom field router
pub fn custom_field_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Board-scoped custom field routes
        .route(
            "/boards/{board_id}/custom-fields",
            get(list_custom_fields_handler),
        )
        .route(
            "/boards/{board_id}/custom-fields",
            axum::routing::post(create_custom_field_handler),
        )
        // Custom field-specific routes
        .route("/custom-fields/{id}", put(update_custom_field_handler))
        .route("/custom-fields/{id}", delete(delete_custom_field_handler))
        // Task-scoped custom field value routes
        .route(
            "/tasks/{task_id}/custom-fields",
            get(get_task_field_values_handler),
        )
        .route(
            "/tasks/{task_id}/custom-fields",
            put(set_task_field_values_handler),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
