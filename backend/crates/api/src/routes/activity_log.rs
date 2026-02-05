//! Activity Log REST routes
//!
//! Provides endpoints for reading task activity history with cursor-based pagination.

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::activity_log::{list_activity_by_task, PaginatedActivityLog};
use taskflow_db::queries::get_task_board_id;

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
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_board_membership(&state, board_id, tenant.user_id).await?;

    // Parse cursor if provided
    let cursor = query
        .cursor
        .as_ref()
        .and_then(|c| Uuid::parse_str(c).ok());

    // Clamp limit to max 50
    let limit = query.limit.min(50).max(1);

    let activity = list_activity_by_task(&state.db, task_id, cursor, limit)
        .await
        .map_err(|e| AppError::SqlxError(e))?;

    Ok(Json(activity))
}

/// Helper to verify board membership
async fn verify_board_membership(state: &AppState, board_id: Uuid, user_id: Uuid) -> Result<()> {
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    Ok(())
}

/// Create the activity log router
pub fn activity_log_router() -> Router<AppState> {
    Router::new()
        .route("/tasks/{task_id}/activity", get(list_activity_handler))
        .layer(axum::middleware::from_fn(auth_middleware))
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
