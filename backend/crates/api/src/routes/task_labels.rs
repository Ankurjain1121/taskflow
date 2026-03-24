//! Task Labels REST endpoints
//!
//! Manage label assignments on individual tasks.

use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskbolt_db::queries::get_task_board_id;

use super::common::verify_project_membership;

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskLabelResponse {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    #[sqlx(rename = "board_id")]
    pub project_id: Uuid,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/tasks/:id/labels
///
/// List all labels assigned to a task.
async fn get_labels(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<TaskLabelResponse>>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify project membership
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    let labels: Vec<TaskLabelResponse> = sqlx::query_as(
        r#"
        SELECT l.id, l.name, l.color, l.board_id
        FROM labels l
        INNER JOIN task_labels tl ON tl.label_id = l.id
        WHERE tl.task_id = $1
        ORDER BY l.name ASC
        "#,
    )
    .bind(task_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(labels))
}

/// POST /api/tasks/:id/labels/:label_id
///
/// Add a label to a task. Idempotent (ON CONFLICT DO NOTHING).
async fn add_label(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, label_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify project membership
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    // Verify the label exists and belongs to the same board (or workspace)
    let label_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM labels WHERE id = $1
            AND (board_id = $2 OR board_id IS NULL)
        )
        "#,
    )
    .bind(label_id)
    .bind(board_id)
    .fetch_one(&state.db)
    .await
    .map_err(AppError::from)?;

    if !label_exists {
        return Err(AppError::NotFound("Label not found".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO task_labels (task_id, label_id)
        VALUES ($1, $2)
        ON CONFLICT (task_id, label_id) DO NOTHING
        "#,
    )
    .bind(task_id)
    .bind(label_id)
    .execute(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(
        serde_json::json!({ "message": "Label added to task" }),
    ))
}

/// DELETE /api/tasks/:id/labels/:label_id
///
/// Remove a label from a task.
async fn remove_label(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, label_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify project membership
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    let result = sqlx::query("DELETE FROM task_labels WHERE task_id = $1 AND label_id = $2")
        .bind(task_id)
        .bind(label_id)
        .execute(&state.db)
        .await
        .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Label not assigned to this task".into()));
    }

    Ok(Json(
        serde_json::json!({ "message": "Label removed from task" }),
    ))
}

// ============================================================================
// Router
// ============================================================================

pub fn task_labels_router(_state: AppState) -> Router<AppState> {
    Router::new()
        .route("/tasks/{id}/labels", get(get_labels))
        .route(
            "/tasks/{id}/labels/{label_id}",
            post(add_label).delete(remove_label),
        )
}
