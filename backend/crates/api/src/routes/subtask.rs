use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::models::{Subtask, SubtaskWithAssignee, Task};
use taskflow_db::queries::get_task_board_id;
use taskflow_db::queries::subtasks::{
    create_subtask, delete_subtask, get_subtask_progress, get_subtask_task_id,
    list_subtasks_by_task, promote_subtask_to_task, reorder_subtask, toggle_subtask,
    update_subtask, SubtaskProgress, SubtaskQueryError,
};

/// Request body for creating a subtask
#[derive(Deserialize)]
pub struct CreateSubtaskRequest {
    pub title: String,
    pub assigned_to_id: Option<Uuid>,
    pub due_date: Option<NaiveDate>,
}

/// Request body for updating a subtask
#[derive(Deserialize)]
pub struct UpdateSubtaskRequest {
    pub title: Option<String>,
    pub assigned_to_id: Option<Uuid>,
    pub due_date: Option<NaiveDate>,
    pub clear_assigned_to: Option<bool>,
    pub clear_due_date: Option<bool>,
}

/// Request body for reordering a subtask
#[derive(Deserialize)]
pub struct ReorderSubtaskRequest {
    pub position: String,
}

/// Response for listing subtasks with progress
#[derive(serde::Serialize)]
pub struct SubtaskListResponse {
    pub subtasks: Vec<SubtaskWithAssignee>,
    pub progress: SubtaskProgress,
}

/// Helper: verify board membership through task -> board chain
async fn verify_task_board_membership(
    state: &AppState,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

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

    Ok(board_id)
}

/// Helper: verify board membership for a subtask through subtask -> task -> board chain
async fn verify_subtask_board_membership(
    state: &AppState,
    subtask_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid> {
    let task_id = get_subtask_task_id(&state.db, subtask_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Subtask not found".into()))?;

    verify_task_board_membership(state, task_id, user_id).await
}

/// GET /api/tasks/{task_id}/subtasks
/// List all subtasks for a task with progress
async fn list_subtasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<SubtaskListResponse>> {
    // Verify board membership through task
    verify_task_board_membership(&state, task_id, tenant.user_id).await?;

    let subtasks = list_subtasks_by_task(&state.db, task_id)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    let progress = get_subtask_progress(&state.db, task_id)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(SubtaskListResponse { subtasks, progress }))
}

/// POST /api/tasks/{task_id}/subtasks
/// Create a new subtask
async fn create_subtask_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<CreateSubtaskRequest>,
) -> Result<Json<Subtask>> {
    // Verify board membership through task
    verify_task_board_membership(&state, task_id, tenant.user_id).await?;

    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Title cannot be empty".into()));
    }

    let subtask = create_subtask(
        &state.db,
        task_id,
        &body.title,
        tenant.user_id,
        body.assigned_to_id,
        body.due_date,
    )
    .await
    .map_err(|e| match e {
        SubtaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
        SubtaskQueryError::Database(e) => AppError::SqlxError(e),
    })?;

    Ok(Json(subtask))
}

/// PUT /api/subtasks/{id}
/// Update a subtask
async fn update_subtask_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(subtask_id): Path<Uuid>,
    Json(body): Json<UpdateSubtaskRequest>,
) -> Result<Json<Subtask>> {
    // Verify board membership through subtask -> task -> board
    verify_subtask_board_membership(&state, subtask_id, tenant.user_id).await?;

    if let Some(ref title) = body.title {
        if title.trim().is_empty() {
            return Err(AppError::BadRequest("Title cannot be empty".into()));
        }
    }

    let assigned_to = if body.clear_assigned_to.unwrap_or(false) {
        Some(None) // Explicitly clear
    } else {
        body.assigned_to_id.map(Some) // Set if provided
    };

    let due_date = if body.clear_due_date.unwrap_or(false) {
        Some(None) // Explicitly clear
    } else {
        body.due_date.map(Some) // Set if provided
    };

    let subtask = update_subtask(
        &state.db,
        subtask_id,
        body.title.as_deref(),
        assigned_to,
        due_date,
    )
    .await
    .map_err(|e| match e {
        SubtaskQueryError::NotFound => AppError::NotFound("Subtask not found".into()),
        SubtaskQueryError::Database(e) => AppError::SqlxError(e),
    })?;

    Ok(Json(subtask))
}

/// PATCH /api/subtasks/{id}/toggle
/// Toggle a subtask's completion status
async fn toggle_subtask_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(subtask_id): Path<Uuid>,
) -> Result<Json<Subtask>> {
    // Verify board membership through subtask -> task -> board
    verify_subtask_board_membership(&state, subtask_id, tenant.user_id).await?;

    let subtask = toggle_subtask(&state.db, subtask_id)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Subtask not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(subtask))
}

/// PUT /api/subtasks/{id}/reorder
/// Reorder a subtask
async fn reorder_subtask_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(subtask_id): Path<Uuid>,
    Json(body): Json<ReorderSubtaskRequest>,
) -> Result<Json<Subtask>> {
    // Verify board membership through subtask -> task -> board
    verify_subtask_board_membership(&state, subtask_id, tenant.user_id).await?;

    let subtask = reorder_subtask(&state.db, subtask_id, &body.position)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Subtask not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(subtask))
}

/// DELETE /api/subtasks/{id}
/// Delete a subtask
async fn delete_subtask_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(subtask_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Verify board membership through subtask -> task -> board
    verify_subtask_board_membership(&state, subtask_id, tenant.user_id).await?;

    delete_subtask(&state.db, subtask_id)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Subtask not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(json!({ "success": true })))
}

/// POST /api/subtasks/{id}/promote
/// Promote a subtask to a full task in the same board/column
async fn promote_subtask_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(subtask_id): Path<Uuid>,
) -> Result<Json<Task>> {
    // Verify board membership through subtask -> task -> board
    verify_subtask_board_membership(&state, subtask_id, tenant.user_id).await?;

    let task = promote_subtask_to_task(&state.db, subtask_id, tenant.tenant_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Subtask not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(task))
}

/// GET /api/tasks/{task_id}/children
/// List child tasks (tasks with parent_task_id = task_id)
async fn list_children_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<Task>>> {
    // Verify board membership through task
    verify_task_board_membership(&state, task_id, tenant.user_id).await?;

    let children = taskflow_db::queries::list_child_tasks(&state.db, task_id)
        .await
        .map_err(|e| match e {
            taskflow_db::queries::TaskQueryError::NotBoardMember => {
                AppError::Forbidden("Not a board member".into())
            }
            taskflow_db::queries::TaskQueryError::NotFound => {
                AppError::NotFound("Task not found".into())
            }
            taskflow_db::queries::TaskQueryError::Database(e) => AppError::SqlxError(e),
            taskflow_db::queries::TaskQueryError::VersionConflict(_) => {
                AppError::Conflict("Version conflict".into())
            }
            taskflow_db::queries::TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?;

    Ok(Json(children))
}

/// Create the subtask router
pub fn subtask_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Task-scoped subtask routes
        .route("/tasks/{task_id}/subtasks", get(list_subtasks_handler))
        .route("/tasks/{task_id}/subtasks", post(create_subtask_handler))
        .route("/tasks/{task_id}/children", get(list_children_handler))
        // Subtask-specific routes
        .route("/subtasks/{id}", put(update_subtask_handler))
        .route(
            "/subtasks/{id}/toggle",
            axum::routing::patch(toggle_subtask_handler),
        )
        .route("/subtasks/{id}/reorder", put(reorder_subtask_handler))
        .route("/subtasks/{id}/promote", post(promote_subtask_handler))
        .route("/subtasks/{id}", delete(delete_subtask_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
