//! Activity Log REST routes
//!
//! Provides endpoints for reading task activity history with cursor-based pagination.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskbolt_db::queries::activity_log::{
    list_activity_by_project, list_activity_by_task, PaginatedActivityLog,
};
use taskbolt_db::queries::get_task_project_id;

use super::common::verify_project_membership;

/// Query parameters for activity log listing
#[derive(Debug, Deserialize)]
pub struct ListActivityQuery {
    /// Cursor for pagination (activity log entry ID)
    pub cursor: Option<String>,
    /// Number of entries to return (default 20, max 50)
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    20
}

/// GET /api/tasks/:task_id/activity
///
/// List activity log entries for a task with cursor-based pagination
///
/// Query parameters:
/// - cursor: Optional activity log entry ID for pagination
/// - limit: Number of entries to return (default 20, max 50)
///
/// Returns entries ordered by created_at DESC (newest first)
async fn list_activity_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Query(query): Query<ListActivityQuery>,
) -> Result<Json<PaginatedActivityLog>> {
    // Verify user has access to the task's board
    let board_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    // Parse cursor if provided
    let cursor = query.cursor.as_ref().and_then(|c| Uuid::parse_str(c).ok());

    // Clamp limit to max 50
    let limit = query.limit.clamp(1, 50);

    let activity = list_activity_by_task(&state.db, task_id, cursor, limit)
        .await
        .map_err(AppError::SqlxError)?;

    Ok(Json(activity))
}

/// Query parameters for project activity log listing
#[derive(Debug, Deserialize)]
pub struct ListProjectActivityQuery {
    /// Cursor for pagination (activity log entry ID)
    pub cursor: Option<String>,
    /// Number of entries to return (default 50, max 100)
    #[serde(default = "default_project_limit")]
    pub limit: i64,
}

fn default_project_limit() -> i64 {
    50
}

/// GET /api/projects/:board_id/activity
///
/// List activity log entries for a project with cursor-based pagination.
/// Returns activity for tasks in the project, the board itself, and columns.
///
/// Query parameters:
/// - cursor: Optional activity log entry ID for pagination
/// - limit: Number of entries to return (default 50, max 100)
///
/// Returns entries ordered by created_at DESC (newest first).
/// Requires project membership.
async fn list_project_activity_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Query(query): Query<ListProjectActivityQuery>,
) -> Result<Json<PaginatedActivityLog>> {
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    let cursor = query.cursor.as_ref().and_then(|c| Uuid::parse_str(c).ok());
    let limit = query.limit.clamp(1, 100);

    let activity = list_activity_by_project(&state.db, board_id, cursor, limit)
        .await
        .map_err(AppError::SqlxError)?;

    Ok(Json(activity))
}

/// Create the activity log router
pub fn activity_log_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/tasks/{task_id}/activity", get(list_activity_handler))
        .route(
            "/projects/{board_id}/activity",
            get(list_project_activity_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_limit() {
        assert_eq!(default_limit(), 20);
    }

    #[test]
    fn test_query_params_deserialize() {
        let json = r#"{"cursor": "550e8400-e29b-41d4-a716-446655440000", "limit": 30}"#;
        let query: ListActivityQuery = serde_json::from_str(json).unwrap();
        assert_eq!(
            query.cursor,
            Some("550e8400-e29b-41d4-a716-446655440000".to_string())
        );
        assert_eq!(query.limit, 30);
    }

    #[test]
    fn test_query_params_defaults() {
        let json = r#"{}"#;
        let query: ListActivityQuery = serde_json::from_str(json).unwrap();
        assert!(query.cursor.is_none());
        assert_eq!(query.limit, 20);
    }
}
