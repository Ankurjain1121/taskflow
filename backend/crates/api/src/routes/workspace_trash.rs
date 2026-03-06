//! Workspace Trash REST endpoints
//!
//! Provides workspace-scoped trash operations. Unlike admin_trash which is
//! tenant-wide and admin-only, these endpoints are workspace-scoped and
//! available to workspace managers+.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct TrashListQuery {
    pub entity_type: Option<String>,
    pub cursor: Option<String>,
    #[serde(default = "default_page_size")]
    pub page_size: i64,
}

fn default_page_size() -> i64 {
    20
}

#[derive(Debug, Serialize)]
pub struct TrashItemResponse {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub name: String,
    pub deleted_at: DateTime<Utc>,
    pub deleted_by_name: Option<String>,
    pub days_remaining: i32,
}

#[derive(Debug, Serialize)]
pub struct PaginatedTrashResponse {
    pub items: Vec<TrashItemResponse>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RestoreRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct TrashOpResponse {
    pub success: bool,
    pub message: String,
}

// Internal query row types
#[derive(Debug, sqlx::FromRow)]
struct TrashRow {
    entity_type: String,
    entity_id: Uuid,
    name: String,
    deleted_at: DateTime<Utc>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/trash
///
/// List soft-deleted items in this workspace (projects, tasks) from last 30 days.
async fn list_workspace_trash(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Query(query): Query<TrashListQuery>,
) -> Result<Json<PaginatedTrashResponse>> {
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let page_size = query.page_size.clamp(1, 100);
    let fetch_limit = page_size + 1;
    let thirty_days_ago = Utc::now() - chrono::Duration::days(30);

    let cursor_time: Option<DateTime<Utc>> = query
        .cursor
        .as_ref()
        .and_then(|c| DateTime::parse_from_rfc3339(c).ok())
        .map(|dt| dt.with_timezone(&Utc));

    let entity_filter = query.entity_type.as_deref();

    // Union query: projects and tasks in this workspace that are soft-deleted
    let rows: Vec<TrashRow> = sqlx::query_as(
        r#"
        (
            SELECT 'board' as entity_type, b.id as entity_id, b.name, b.deleted_at
            FROM projects b
            WHERE b.workspace_id = $1
              AND b.deleted_at IS NOT NULL
              AND b.deleted_at > $2
              AND ($3::text IS NULL OR $3 = 'board')
              AND ($4::timestamptz IS NULL OR b.deleted_at < $4)
        )
        UNION ALL
        (
            SELECT 'task' as entity_type, t.id as entity_id, t.title as name, t.deleted_at
            FROM tasks t
            JOIN projects bo ON bo.id = t.project_id
            WHERE bo.workspace_id = $1
              AND t.deleted_at IS NOT NULL
              AND t.deleted_at > $2
              AND ($3::text IS NULL OR $3 = 'task')
              AND ($4::timestamptz IS NULL OR t.deleted_at < $4)
        )
        ORDER BY deleted_at DESC
        LIMIT $5
        "#,
    )
    .bind(workspace_id)
    .bind(thirty_days_ago)
    .bind(entity_filter)
    .bind(cursor_time)
    .bind(fetch_limit)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    let has_more = rows.len() > page_size as usize;
    let rows: Vec<_> = rows.into_iter().take(page_size as usize).collect();

    let now = Utc::now();
    let items: Vec<TrashItemResponse> = rows
        .iter()
        .map(|r| {
            let days_since = (now - r.deleted_at).num_days();
            TrashItemResponse {
                entity_type: r.entity_type.clone(),
                entity_id: r.entity_id,
                name: r.name.clone(),
                deleted_at: r.deleted_at,
                deleted_by_name: None,
                days_remaining: (30 - days_since as i32).max(0),
            }
        })
        .collect();

    let next_cursor = if has_more {
        rows.last().map(|r| r.deleted_at.to_rfc3339())
    } else {
        None
    };

    Ok(Json(PaginatedTrashResponse { items, next_cursor }))
}

/// POST /api/workspaces/:workspace_id/trash/restore
///
/// Restore a soft-deleted item. Requires workspace membership.
async fn restore_workspace_trash(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Json(body): Json<RestoreRequest>,
) -> Result<Json<TrashOpResponse>> {
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    match body.entity_type.as_str() {
        "project" => {
            let result = sqlx::query(
                "UPDATE projects SET deleted_at = NULL WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NOT NULL",
            )
            .bind(body.entity_id)
            .bind(workspace_id)
            .execute(&state.db)
            .await
            .map_err(AppError::from)?;

            if result.rows_affected() == 0 {
                return Err(AppError::NotFound("Project not found in trash".into()));
            }
        }
        "task" => {
            // Verify task belongs to this workspace
            let exists: bool = sqlx::query_scalar(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM tasks t
                    JOIN projects b ON b.id = t.project_id
                    WHERE t.id = $1 AND b.workspace_id = $2 AND t.deleted_at IS NOT NULL
                )
                "#,
            )
            .bind(body.entity_id)
            .bind(workspace_id)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

            if !exists {
                return Err(AppError::NotFound("Task not found in trash".into()));
            }

            sqlx::query("UPDATE tasks SET deleted_at = NULL WHERE id = $1")
                .bind(body.entity_id)
                .execute(&state.db)
                .await
                .map_err(AppError::from)?;
        }
        _ => {
            return Err(AppError::BadRequest(
                "Invalid entity type. Use 'board' or 'task'.".into(),
            ));
        }
    }

    Ok(Json(TrashOpResponse {
        success: true,
        message: format!("{} restored successfully", body.entity_type),
    }))
}

/// DELETE /api/workspaces/:workspace_id/trash/:entity_type/:entity_id
///
/// Permanently delete a trashed item. Requires workspace membership.
async fn delete_workspace_trash(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, entity_type, entity_id)): Path<(Uuid, String, Uuid)>,
) -> Result<Json<TrashOpResponse>> {
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    match entity_type.as_str() {
        "project" => {
            let result = sqlx::query(
                "DELETE FROM projects WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NOT NULL",
            )
            .bind(entity_id)
            .bind(workspace_id)
            .execute(&state.db)
            .await
            .map_err(AppError::from)?;

            if result.rows_affected() == 0 {
                return Err(AppError::NotFound("Project not found in trash".into()));
            }
        }
        "task" => {
            let exists: bool = sqlx::query_scalar(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM tasks t
                    JOIN projects b ON b.id = t.project_id
                    WHERE t.id = $1 AND b.workspace_id = $2 AND t.deleted_at IS NOT NULL
                )
                "#,
            )
            .bind(entity_id)
            .bind(workspace_id)
            .fetch_one(&state.db)
            .await
            .map_err(AppError::from)?;

            if !exists {
                return Err(AppError::NotFound("Task not found in trash".into()));
            }

            sqlx::query("DELETE FROM tasks WHERE id = $1 AND deleted_at IS NOT NULL")
                .bind(entity_id)
                .execute(&state.db)
                .await
                .map_err(AppError::from)?;
        }
        _ => {
            return Err(AppError::BadRequest(
                "Invalid entity type. Use 'board' or 'task'.".into(),
            ));
        }
    }

    Ok(Json(TrashOpResponse {
        success: true,
        message: format!("{} permanently deleted", entity_type),
    }))
}

// ============================================================================
// Router
// ============================================================================

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
