use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::{StrictJson, TenantContext};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::routes::validation::{
    validate_optional_string, validate_required_string, MAX_DESCRIPTION_LEN, MAX_NAME_LEN,
};
use crate::state::AppState;
use taskbolt_db::models::{Task, UserRole};
use taskbolt_db::queries::get_task_project_id;
use taskbolt_db::queries::tasks::ChildTaskWithDetails;

/// Helper: verify board membership through task -> board chain
async fn verify_task_board_membership(
    state: &AppState,
    task_id: Uuid,
    user_id: Uuid,
    role: &UserRole,
) -> Result<Uuid> {
    let board_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    super::common::verify_project_membership(&state.db, board_id, user_id, role).await?;

    Ok(board_id)
}

/// Response for child task list with progress (enriched with assignees + labels)
#[derive(serde::Serialize)]
pub struct ChildTaskListResponse {
    pub children: Vec<ChildTaskWithDetails>,
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
    // Verify board membership through task
    verify_task_board_membership(&state, task_id, tenant.user_id, &tenant.role).await?;

    let children = taskbolt_db::queries::list_child_tasks_with_details(&state.db, task_id)
        .await
        .map_err(|e| match e {
            taskbolt_db::queries::TaskQueryError::NotProjectMember => {
                AppError::Forbidden("Not a project member".into())
            }
            taskbolt_db::queries::TaskQueryError::NotFound => {
                AppError::NotFound("Task not found".into())
            }
            taskbolt_db::queries::TaskQueryError::Database(e) => AppError::SqlxError(e),
            taskbolt_db::queries::TaskQueryError::VersionConflict(_) => {
                AppError::Conflict("Version conflict".into())
            }
            taskbolt_db::queries::TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?;

    // Count completed children (those with done statuses)
    let completed = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM tasks t
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE t.parent_task_id = $1
          AND t.deleted_at IS NULL
          AND ps.type = 'done'
        "#,
    )
    .bind(task_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let total = i64::try_from(children.len()).unwrap_or(i64::MAX);

    Ok(Json(ChildTaskListResponse {
        children,
        progress: ChildTaskProgress { completed, total },
    }))
}

/// Request body for creating a child task
#[strict_dto_derive::strict_dto]
pub struct CreateChildTaskRequest {
    pub title: String,
    pub priority: Option<String>,
    pub description: Option<String>,
    pub status_id: Option<Uuid>,
    pub assignee_ids: Option<Vec<Uuid>>,
}

/// POST /api/tasks/{task_id}/children
/// Create a child task (a real task with parent_task_id set)
async fn create_child_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    StrictJson(body): StrictJson<CreateChildTaskRequest>,
) -> Result<Json<Task>> {
    // Verify board membership
    verify_task_board_membership(&state, task_id, tenant.user_id, &tenant.role).await?;

    validate_required_string("Title", &body.title, MAX_NAME_LEN)?;
    validate_optional_string(
        "Description",
        body.description.as_deref(),
        MAX_DESCRIPTION_LEN,
    )?;

    // Get parent task to inherit project_id, status_id, task_list_id, and validate depth
    let parent = sqlx::query_as::<_, Task>(
        r#"
        SELECT id, title, description, priority, due_date, start_date,
               estimated_hours, project_id, status_id, task_list_id, position,
               milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
               tenant_id, created_by_id, deleted_at,
               created_at, updated_at, version, parent_task_id, depth, reporting_person_id,
               rate_per_hour, budgeted_hours, budgeted_hours_threshold,
               cost_budget, cost_budget_threshold, cost_per_hour, revenue_budget
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Parent task not found".into()))?;

    let child_depth = parent.depth + 1;
    if child_depth > crate::routes::validation::MAX_SUBTASK_DEPTH {
        return Err(AppError::BadRequest(
            "Maximum subtask depth of 5 levels exceeded".into(),
        ));
    }

    // Use provided status_id or inherit from parent
    let status_id = body.status_id.or(parent.status_id);

    // Get a position at the end for this status
    let last_pos = sqlx::query_scalar::<_, String>(
        "SELECT position FROM tasks WHERE task_list_id = $1 AND deleted_at IS NULL ORDER BY position DESC LIMIT 1",
    )
    .bind(parent.task_list_id)
    .fetch_optional(&state.db)
    .await?;

    let position = match last_pos {
        Some(p) => format!("{}0", p),
        None => "a".to_string(),
    };

    // Map "none" to "medium" (DB default) — the task_priority enum doesn't include "none"
    let priority = match body.priority.as_deref() {
        Some("none") | None => "medium",
        Some(p) => p,
    };

    let child = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (
            title, description, priority, project_id, status_id, task_list_id, position,
            tenant_id, created_by_id, parent_task_id, depth
        )
        VALUES ($1, $2, $3::task_priority, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, status_id, task_list_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at,
            created_at, updated_at, version, parent_task_id, depth, reporting_person_id,
            rate_per_hour, budgeted_hours, budgeted_hours_threshold,
            cost_budget, cost_budget_threshold, cost_per_hour, revenue_budget
        "#,
    )
    .bind(&body.title)
    .bind(body.description.as_deref())
    .bind(priority)
    .bind(parent.project_id)
    .bind(status_id)
    .bind(parent.task_list_id)
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

/// Create the subtask router (child tasks only — legacy subtask routes removed)
pub fn subtask_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/tasks/{task_id}/children",
            get(list_children_handler).post(create_child_task_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
