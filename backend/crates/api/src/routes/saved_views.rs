//! Saved Views API routes
//!
//! CRUD endpoints for user-created saved views per workspace.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{get, patch, put},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::saved_views::{
    self, CreateSavedViewInput, SavedView, SavedViewError, UpdateSavedViewInput,
};
use taskflow_db::queries::workspaces;

/// GET /api/workspace/:ws_id/saved-views
async fn list_saved_views_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(ws_id): Path<Uuid>,
) -> Result<Json<Vec<SavedView>>> {
    // Verify workspace membership
    let is_member = workspaces::is_workspace_member(&state.db, ws_id, tenant.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let views = saved_views::list_saved_views(&state.db, tenant.user_id, ws_id).await?;

    Ok(Json(views))
}

/// POST /api/workspace/:ws_id/saved-views
async fn create_saved_view_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(ws_id): Path<Uuid>,
    Json(input): Json<CreateSavedViewInput>,
) -> Result<Json<SavedView>> {
    // Verify workspace membership
    let is_member = workspaces::is_workspace_member(&state.db, ws_id, tenant.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Validate view_type
    let valid_types = [
        "kanban",
        "list",
        "table",
        "calendar",
        "gantt",
        "reports",
        "time-report",
        "activity",
    ];
    if !valid_types.contains(&input.view_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid view_type: {}. Must be one of: {}",
            input.view_type,
            valid_types.join(", ")
        )));
    }

    let view = saved_views::create_saved_view(&state.db, tenant.user_id, ws_id, &input)
        .await
        .map_err(map_saved_view_error)?;

    Ok(Json(view))
}

/// PUT /api/saved-views/:id
async fn update_saved_view_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateSavedViewInput>,
) -> Result<Json<SavedView>> {
    let view = saved_views::update_saved_view(&state.db, id, tenant.user_id, &input)
        .await
        .map_err(map_saved_view_error)?;

    Ok(Json(view))
}

/// DELETE /api/saved-views/:id
async fn delete_saved_view_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    saved_views::delete_saved_view(&state.db, id, tenant.user_id)
        .await
        .map_err(map_saved_view_error)?;

    Ok(Json(serde_json::json!({ "message": "Saved view deleted" })))
}

/// Request body for pin/unpin
#[derive(Debug, Deserialize)]
pub struct PinRequest {
    pub pinned: bool,
}

/// PATCH /api/saved-views/:id/pin
async fn toggle_pin_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(id): Path<Uuid>,
    Json(input): Json<PinRequest>,
) -> Result<Json<SavedView>> {
    let view = saved_views::toggle_pin(&state.db, id, tenant.user_id, input.pinned)
        .await
        .map_err(map_saved_view_error)?;

    Ok(Json(view))
}

/// Map SavedViewError to AppError
fn map_saved_view_error(e: SavedViewError) -> AppError {
    match e {
        SavedViewError::NotFound => AppError::NotFound("Saved view not found".into()),
        SavedViewError::NotOwner => AppError::Forbidden("Not the owner of this saved view".into()),
        SavedViewError::DuplicateName => {
            AppError::Conflict("A saved view with this name already exists".into())
        }
        SavedViewError::LimitReached(msg) => AppError::BadRequest(msg),
        SavedViewError::Database(e) => AppError::SqlxError(e),
    }
}

/// Build the saved views router
pub fn saved_views_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/workspace/{ws_id}/saved-views",
            get(list_saved_views_handler).post(create_saved_view_handler),
        )
        .route(
            "/saved-views/{id}",
            put(update_saved_view_handler).delete(delete_saved_view_handler),
        )
        .route("/saved-views/{id}/pin", patch(toggle_pin_handler))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
