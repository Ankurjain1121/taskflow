//! Cross-project Workspace Tasks API routes
//!
//! Provides endpoints for viewing tasks across all projects in a workspace.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::workspace_tasks::{self, PaginatedWorkspaceTasks, WorkspaceTaskFilters};
use taskflow_db::queries::workspaces;

/// GET /api/workspace/:ws_id/tasks
///
/// List tasks across all projects in a workspace that the user has access to.
/// Supports cursor pagination and filtering by status, priority, assignee, due date.
async fn list_workspace_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(ws_id): Path<Uuid>,
    Query(filters): Query<WorkspaceTaskFilters>,
) -> Result<Json<PaginatedWorkspaceTasks>> {
    // Verify workspace membership
    let is_member = workspaces::is_workspace_member(&state.db, ws_id, tenant.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let result =
        workspace_tasks::list_workspace_tasks(&state.db, ws_id, tenant.user_id, &filters).await?;

    Ok(Json(result))
}

/// Build the workspace tasks router
pub fn workspace_tasks_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/workspace/{ws_id}/tasks",
            get(list_workspace_tasks_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
