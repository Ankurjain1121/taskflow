//! Workspace Trash REST endpoints
//!
//! Provides workspace-scoped trash operations. Unlike admin_trash which is
//! tenant-wide and admin-only, these endpoints are workspace-scoped and
//! available to workspace members.
//!
//! All logic is delegated to `trash_queries` with `TrashScope::Workspace`.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::auth_middleware;
use crate::state::AppState;

use super::trash_queries::{
    self, RestoreRequest, TrashListResponse, TrashOpResponse, TrashQuery, TrashScope,
};

/// Check workspace membership and return the workspace-scoped TrashScope.
async fn workspace_scope(
    state: &AppState,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<TrashScope> {
    let is_member =
        taskflow_db::queries::workspaces::is_workspace_member(&state.db, workspace_id, user_id)
            .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }
    Ok(TrashScope::Workspace(workspace_id))
}

/// GET /api/workspaces/:workspace_id/trash
async fn list_workspace_trash(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<TrashQuery>,
) -> Result<Json<TrashListResponse>> {
    let scope = workspace_scope(&state, workspace_id, auth.0.user_id).await?;
    let response = trash_queries::list_trash(&state.db, &scope, &query).await?;
    Ok(Json(response))
}

/// POST /api/workspaces/:workspace_id/trash/restore
async fn restore_workspace_trash(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Json(body): Json<RestoreRequest>,
) -> Result<Json<TrashOpResponse>> {
    let scope = workspace_scope(&state, workspace_id, auth.0.user_id).await?;
    let response = trash_queries::restore_item(
        &state.db,
        &scope,
        &body.entity_type,
        body.entity_id,
        auth.0.user_id,
    )
    .await?;
    Ok(Json(response))
}

/// DELETE /api/workspaces/:workspace_id/trash/:entity_type/:entity_id
async fn delete_workspace_trash(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, entity_type, entity_id)): Path<(Uuid, String, Uuid)>,
) -> Result<Json<TrashOpResponse>> {
    let scope = workspace_scope(&state, workspace_id, auth.0.user_id).await?;
    let response = trash_queries::delete_item(&state, &scope, &entity_type, entity_id).await?;
    Ok(Json(response))
}

pub fn workspace_trash_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/trash", get(list_workspace_trash))
        .route("/trash/restore", post(restore_workspace_trash))
        .route(
            "/trash/{entity_type}/{entity_id}",
            delete(delete_workspace_trash),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
