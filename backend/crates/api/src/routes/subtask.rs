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
use taskflow_db::queries::get_task_project_id;
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

/// Helper: verify project membership through task -> project chain
async fn verify_task_project_membership(
    state: &AppState,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM project_members
            WHERE project_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        project_id,
        user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    Ok(project_id)
}

/// Helper: verify project membership for a subtask through subtask -> task -> project chain
async fn verify_subtask_project_membership(
    state: &AppState,
    subtask_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid> {
    let task_id = get_subtask_task_id(&state.db, subtask_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Subtask not found".into()))?;

    verify_task_project_membership(state, task_id, user_id).await
}

/// GET /api/tasks/{task_id}/subtasks
/// List all subtasks for a task with progress
async fn list_subtasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<SubtaskListResponse>> {
    // Verify project membership through task
    verify_task_project_membership(&state, task_id, tenant.user_id).await?;

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
    // Verify project membership through task
    verify_task_project_membership(&state, task_id, tenant.user_id).await?;

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
    // Verify project membership through subtask -> task -> project
    verify_subtask_project_membership(&state, subtask_id, tenant.user_id).await?;

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
    // Verify project membership through subtask -> task -> project
    verify_subtask_project_membership(&state, subtask_id, tenant.user_id).await?;

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
    // Verify project membership through subtask -> task -> project
    verify_subtask_project_membership(&state, subtask_id, tenant.user_id).await?;

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
    // Verify project membership through subtask -> task -> project
    verify_subtask_project_membership(&state, subtask_id, tenant.user_id).await?;

    delete_subtask(&state.db, subtask_id)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Subtask not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(json!({ "success": true })))
}

/// POST /api/subtasks/{id}/promote
/// Promote a subtask to a full task in the same project/column
async fn promote_subtask_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(subtask_id): Path<Uuid>,
) -> Result<Json<Task>> {
    // Verify project membership through subtask -> task -> project
    verify_subtask_project_membership(&state, subtask_id, tenant.user_id).await?;

    let task = promote_subtask_to_task(&state.db, subtask_id, tenant.tenant_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            SubtaskQueryError::NotFound => AppError::NotFound("Subtask not found".into()),
            SubtaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(task))
}

/// Response for child task list with progress
#[derive(serde::Serialize)]
pub struct ChildTaskListResponse {
    pub children: Vec<Task>,
    pub progress: ChildTaskProgress,
}

#[derive(serde::Serialize)]
pub struct ChildTaskProgress {
    pub completed: i64,
    pub total: i64,
}

/// GET /api/tasks/{task_id}/children
/// List child tasks (tasks with parent_task_id = task_id) with progress
async fn list_children_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<ChildTaskListResponse>> {
    // Verify project membership through task
    let project_id = verify_task_project_membership(&state, task_id, tenant.user_id).await?;

    let children = taskflow_db::queries::list_child_tasks(&state.db, task_id)
        .await
        .map_err(|e| match e {
            taskflow_db::queries::TaskQueryError::NotProjectMember => {
                AppError::Forbidden("Not a project member".into())
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

    // Count completed children (those in done columns)
    let completed = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM tasks t
        JOIN project_columns bc ON bc.id = t.column_id
        WHERE t.parent_task_id = $1
          AND t.deleted_at IS NULL
          AND bc.project_id = $2
          AND (bc.status_mapping->>'done')::boolean = true
        "#,
    )
    .bind(task_id)
    .bind(project_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let total = children.len() as i64;

    Ok(Json(ChildTaskListResponse {
        children,
        progress: ChildTaskProgress { completed, total },
    }))
}

/// Request body for creating a child task
#[derive(Deserialize)]
pub struct CreateChildTaskRequest {
    pub title: String,
    pub priority: Option<String>,
    pub description: Option<String>,
    pub column_id: Option<Uuid>,
    pub assignee_ids: Option<Vec<Uuid>>,
}

/// POST /api/tasks/{task_id}/children
/// Create a child task (a real task with parent_task_id set)
async fn create_child_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<CreateChildTaskRequest>,
) -> Result<Json<Task>> {
    // Verify project membership
    verify_task_project_membership(&state, task_id, tenant.user_id).await?;

    if body.title.trim().is_empty() {
        return Err(AppError::BadRequest("Title cannot be empty".into()));
    }

    // Get parent task to inherit project_id, column_id, and validate depth
    let parent = sqlx::query_as::<_, Task>(
        r#"
        SELECT id, title, description, priority, due_date, start_date,
               estimated_hours, project_id, column_id, group_id, position,
               milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
               tenant_id, created_by_id, deleted_at, column_entered_at,
               created_at, updated_at, version, parent_task_id, depth
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Parent task not found".into()))?;

    let child_depth = parent.depth + 1;
    if child_depth > 2 {
        return Err(AppError::BadRequest(
            "Maximum nesting depth (2) exceeded".into(),
        ));
    }

    let column_id = body.column_id.unwrap_or(parent.column_id);

    // Get a position at the end
    let last_pos = sqlx::query_scalar::<_, String>(
        "SELECT position FROM tasks WHERE column_id = $1 AND deleted_at IS NULL ORDER BY position DESC LIMIT 1",
    )
    .bind(column_id)
    .fetch_optional(&state.db)
    .await?;

    let position = match last_pos {
        Some(p) => format!("{}0", p),
        None => "a".to_string(),
    };

    let priority = body.priority.as_deref().unwrap_or("none");

    let child = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (
            title, description, priority, project_id, column_id, position,
            tenant_id, created_by_id, parent_task_id, depth
        )
        VALUES ($1, $2, $3::task_priority, $4, $5, $6, $7, $8, $9, $10)
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, column_entered_at,
            created_at, updated_at, version, parent_task_id, depth
        "#,
    )
    .bind(&body.title)
    .bind(body.description.as_deref())
    .bind(priority)
    .bind(parent.project_id)
    .bind(column_id)
    .bind(&position)
    .bind(tenant.tenant_id)
    .bind(tenant.user_id)
    .bind(task_id)
    .bind(child_depth)
    .fetch_one(&state.db)
    .await?;

    // Assign users if provided
    if let Some(ref assignee_ids) = body.assignee_ids {
        for aid in assignee_ids {
            sqlx::query(
                "INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(child.id)
            .bind(aid)
            .execute(&state.db)
            .await
            .ok();
        }
    }

    Ok(Json(child))
}

/// Create the subtask router
pub fn subtask_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Task-scoped subtask routes (legacy)
        .route("/tasks/{task_id}/subtasks", get(list_subtasks_handler))
        .route("/tasks/{task_id}/subtasks", post(create_subtask_handler))
        // Child task routes (first-class child tasks)
        .route(
            "/tasks/{task_id}/children",
            get(list_children_handler).post(create_child_task_handler),
        )
        // Subtask-specific routes (legacy)
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
