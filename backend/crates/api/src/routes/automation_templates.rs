use axum::{
    Json, Router,
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{get, patch, post},
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::ManagerOrAdmin;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use taskbolt_db::models::automation_template::{
    ApplyTemplateRequest, AutomationTemplate, ToggleTemplateRequest,
};
use taskbolt_db::queries::{automation_templates, is_workspace_member};

/// Query params for list endpoint
#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub category: Option<String>,
}

/// GET /api/workspaces/{workspace_id}/automation-templates
/// List all automation templates for a workspace, optionally filtered by category.
async fn list_templates_handler(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<ListTemplatesQuery>,
) -> Result<Json<Vec<AutomationTemplate>>> {
    let is_member = is_workspace_member(&state.db, workspace_id, manager.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    let templates =
        automation_templates::list_templates(&state.db, workspace_id, query.category.as_deref())
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to list templates: {e}")))?;

    Ok(Json(templates))
}

/// PATCH /api/workspaces/{workspace_id}/automation-templates/{template_id}
/// Toggle a template's enabled status.
async fn toggle_template_handler(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path((workspace_id, template_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<ToggleTemplateRequest>,
) -> Result<Json<AutomationTemplate>> {
    let is_member = is_workspace_member(&state.db, workspace_id, manager.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    // Verify template belongs to this workspace
    let template = automation_templates::get_template(&state.db, template_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to get template: {e}")))?
        .ok_or_else(|| AppError::NotFound("Template not found".into()))?;

    if template.workspace_id != workspace_id {
        return Err(AppError::NotFound("Template not found".into()));
    }

    let updated = automation_templates::toggle_template(&state.db, template_id, body.enabled)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to toggle template: {e}")))?
        .ok_or_else(|| AppError::NotFound("Template not found".into()))?;

    Ok(Json(updated))
}

/// POST /api/workspaces/{workspace_id}/automation-templates/{template_id}/apply
/// Apply a template to a specific board, creating an automation rule.
async fn apply_template_handler(
    State(state): State<AppState>,
    manager: ManagerOrAdmin,
    Path((workspace_id, template_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<ApplyTemplateRequest>,
) -> Result<Json<serde_json::Value>> {
    let is_member = is_workspace_member(&state.db, workspace_id, manager.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a workspace member".into()));
    }

    // Verify board belongs to this workspace
    let board_workspace_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT workspace_id FROM boards WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(body.board_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    if board_workspace_id != workspace_id {
        return Err(AppError::Forbidden(
            "Board does not belong to this workspace".into(),
        ));
    }

    let rule_id = automation_templates::apply_template(
        &state.db,
        workspace_id,
        template_id,
        body.board_id,
        manager.0.user_id,
        manager.0.tenant_id,
    )
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => AppError::NotFound("Template not found".into()),
        other => AppError::InternalError(format!("Failed to apply template: {other}")),
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "rule_id": rule_id
    })))
}

/// Create the automation templates router
pub fn automation_templates_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/workspaces/{workspace_id}/automation-templates",
            get(list_templates_handler),
        )
        .route(
            "/workspaces/{workspace_id}/automation-templates/{template_id}",
            patch(toggle_template_handler),
        )
        .route(
            "/workspaces/{workspace_id}/automation-templates/{template_id}/apply",
            post(apply_template_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
