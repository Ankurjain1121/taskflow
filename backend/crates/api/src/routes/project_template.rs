use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::project_templates::{
    create_board_from_template, create_template, delete_template, get_template, list_templates,
    save_board_as_template, CreateBoardFromTemplateInput, CreateTemplateFromBoardInput,
    CreateTemplateInput, ProjectTemplateQueryError,
};

/// Map ProjectTemplateQueryError to AppError
fn map_error(e: ProjectTemplateQueryError) -> AppError {
    match e {
        ProjectTemplateQueryError::NotFound => {
            AppError::NotFound("Project template not found".into())
        }
        ProjectTemplateQueryError::NotBoardMember => {
            AppError::Forbidden("Not a project member".into())
        }
        ProjectTemplateQueryError::Forbidden => {
            AppError::Forbidden("You do not have permission for this action".into())
        }
        ProjectTemplateQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /project-templates
/// List all templates accessible to the current tenant (own + public)
async fn list_templates_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<Vec<taskflow_db::models::ProjectTemplate>>> {
    let templates = list_templates(&state.db, tenant.tenant_id)
        .await
        .map_err(map_error)?;

    Ok(Json(templates))
}

/// POST /project-templates
/// Create a new empty project template
async fn create_template_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Json(body): Json<CreateTemplateInput>,
) -> Result<Json<taskflow_db::models::ProjectTemplate>> {
    let template = create_template(&state.db, body, tenant.user_id, tenant.tenant_id)
        .await
        .map_err(map_error)?;

    Ok(Json(template))
}

/// GET /project-templates/{id}
/// Get a template with its columns and tasks (requires authentication)
async fn get_template_handler(
    State(state): State<AppState>,
    _tenant: TenantContext,
    Path(template_id): Path<Uuid>,
) -> Result<Json<taskflow_db::queries::project_templates::TemplateWithDetails>> {
    let details = get_template(&state.db, template_id)
        .await
        .map_err(map_error)?;

    Ok(Json(details))
}

/// DELETE /project-templates/{id}
/// Delete a template (only creator or admin)
async fn delete_template_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(template_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    delete_template(
        &state.db,
        template_id,
        tenant.user_id,
        tenant.tenant_id,
        tenant.role,
    )
    .await
    .map_err(map_error)?;

    Ok(Json(json!({ "success": true })))
}

/// POST /project-templates/{id}/create-board
/// Create a new board from a template
async fn create_board_from_template_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(template_id): Path<Uuid>,
    Json(body): Json<CreateBoardFromTemplateInput>,
) -> Result<Json<serde_json::Value>> {
    let board_id = create_board_from_template(
        &state.db,
        template_id,
        body.workspace_id,
        body.board_name,
        tenant.user_id,
        tenant.tenant_id,
    )
    .await
    .map_err(map_error)?;

    Ok(Json(json!({ "board_id": board_id })))
}

/// POST /boards/{board_id}/save-as-template
/// Save an existing board as a project template
async fn save_board_as_template_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateTemplateFromBoardInput>,
) -> Result<Json<taskflow_db::models::ProjectTemplate>> {
    let template =
        save_board_as_template(&state.db, board_id, body, tenant.user_id, tenant.tenant_id)
            .await
            .map_err(map_error)?;

    Ok(Json(template))
}

/// Create the project template router
pub fn project_template_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/project-templates", get(list_templates_handler))
        .route("/project-templates", post(create_template_handler))
        .route("/project-templates/{id}", get(get_template_handler))
        .route("/project-templates/{id}", delete(delete_template_handler))
        .route(
            "/project-templates/{id}/create-board",
            post(create_board_from_template_handler),
        )
        .route(
            "/projects/{board_id}/save-as-template",
            post(save_board_as_template_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
