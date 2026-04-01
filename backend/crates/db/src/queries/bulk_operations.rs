//! Bulk operations with preview, execute, undo, and audit trail.
//! Pure SQL operations — Redis snapshot logic lives in the API layer.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::bulk_operation::BulkOperation;
use crate::models::TaskPriority;

use super::tasks::TaskQueryError;

/// Hard cap on number of tasks per bulk operation.
pub const MAX_BULK_TASKS: usize = 500;

/// Supported bulk action types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BulkAction {
    UpdatePriority { priority: TaskPriority },
    UpdateStatus { status_id: Uuid },
    AssignUser { user_id: Uuid },
    UnassignUser { user_id: Uuid },
    SetMilestone { milestone_id: Uuid },
    ClearMilestone,
    UpdateTaskList { task_list_id: Uuid },
    ClearTaskList,
    Delete,
}

/// Preview summary for a bulk operation (no side effects).
#[derive(Debug, Serialize)]
pub struct PreviewSummary {
    pub action_type: String,
    pub task_count: usize,
    pub description: String,
    pub affected_task_ids: Vec<Uuid>,
}

/// Result of executing a bulk operation.
#[derive(Debug, Serialize)]
pub struct BulkOperationResult {
    pub operation_id: Uuid,
    pub action_type: String,
    pub tasks_affected: u64,
    pub can_undo: bool,
}

/// Snapshot of a task's key fields for undo.
#[derive(Debug, Serialize, Deserialize)]
pub struct TaskSnapshot {
    pub id: Uuid,
    pub status_id: Option<Uuid>,
    pub priority: TaskPriority,
    pub milestone_id: Option<Uuid>,
    pub task_list_id: Option<Uuid>,
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// Preview a bulk operation without executing it.
pub async fn preview_bulk_operation(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    action: &BulkAction,
    task_ids: &[Uuid],
) -> Result<PreviewSummary, TaskQueryError> {
    verify_board_membership(pool, board_id, user_id).await?;
    enforce_task_cap(task_ids.len())?;

    let existing_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM tasks WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL",
    )
    .bind(task_ids)
    .bind(board_id)
    .fetch_one(pool)
    .await? as usize;

    let (action_type, description) = describe_action(action, existing_count);

    Ok(PreviewSummary {
        action_type,
        task_count: existing_count,
        description,
        affected_task_ids: task_ids.to_vec(),
    })
}

/// Snapshot tasks for later undo (returns serializable data for Redis storage).
pub async fn snapshot_tasks(
    pool: &PgPool,
    task_ids: &[Uuid],
    board_id: Uuid,
) -> Result<Vec<TaskSnapshot>, TaskQueryError> {
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Option<Uuid>,
            TaskPriority,
            Option<Uuid>,
            Option<Uuid>,
            Option<chrono::DateTime<chrono::Utc>>,
        ),
    >(
        r"
        SELECT id, status_id, priority, milestone_id, task_list_id, deleted_at
        FROM tasks
        WHERE id = ANY($1) AND project_id = $2
        ",
    )
    .bind(task_ids)
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    let snapshots = rows
        .into_iter()
        .map(
            |(id, status_id, priority, milestone_id, task_list_id, deleted_at)| TaskSnapshot {
                id,
                status_id,
                priority,
                milestone_id,
                task_list_id,
                deleted_at,
            },
        )
        .collect();

    Ok(snapshots)
}

/// Execute a bulk operation: apply action + create audit row.
/// Returns (BulkOperation, action_type) — caller stores snapshot in Redis.
pub async fn execute_bulk_operation(
    pool: &PgPool,
    board_id: Uuid,
    workspace_id: Uuid,
    user_id: Uuid,
    action: &BulkAction,
    task_ids: &[Uuid],
) -> Result<BulkOperation, TaskQueryError> {
    verify_board_membership(pool, board_id, user_id).await?;
    enforce_task_cap(task_ids.len())?;

    if task_ids.is_empty() {
        return Err(TaskQueryError::Other("No task IDs provided".to_string()));
    }

    let rows_affected = apply_action(pool, board_id, action, task_ids).await?;

    let (action_type, description) = describe_action(action, rows_affected as usize);
    let action_config = serde_json::to_value(action).unwrap_or_default();
    let changes_summary = serde_json::json!({
        "description": description,
        "tasks_affected": rows_affected,
    });

    let op = sqlx::query_as::<_, BulkOperation>(
        r"
        INSERT INTO bulk_operations (workspace_id, project_id, user_id, action_type, action_config, affected_task_ids, changes_summary, task_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        ",
    )
    .bind(workspace_id)
    .bind(board_id)
    .bind(user_id)
    .bind(&action_type)
    .bind(&action_config)
    .bind(task_ids)
    .bind(&changes_summary)
    .bind(rows_affected as i32)
    .fetch_one(pool)
    .await?;

    Ok(op)
}

/// Undo a bulk operation by restoring task snapshots.
pub async fn undo_bulk_operation(
    pool: &PgPool,
    operation_id: Uuid,
    user_id: Uuid,
    snapshots: &[TaskSnapshot],
) -> Result<u64, TaskQueryError> {
    let op = sqlx::query_as::<_, BulkOperation>(
        "SELECT * FROM bulk_operations WHERE id = $1 AND user_id = $2",
    )
    .bind(operation_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| TaskQueryError::Other("Bulk operation not found".to_string()))?;

    if op.expires_at < chrono::Utc::now() {
        return Err(TaskQueryError::Other(
            "Undo window has expired (1 hour limit)".to_string(),
        ));
    }

    let mut restored: u64 = 0;
    for snap in snapshots {
        let result = sqlx::query(
            r"
            UPDATE tasks
            SET status_id = $1, priority = $2, milestone_id = $3,
                task_list_id = $4, deleted_at = $5, updated_at = now()
            WHERE id = $6 AND project_id = $7
            ",
        )
        .bind(snap.status_id)
        .bind(&snap.priority)
        .bind(snap.milestone_id)
        .bind(snap.task_list_id)
        .bind(snap.deleted_at)
        .bind(snap.id)
        .bind(op.project_id)
        .execute(pool)
        .await?;
        restored += result.rows_affected();
    }

    // Delete the audit row so it can't be undone again
    sqlx::query("DELETE FROM bulk_operations WHERE id = $1")
        .bind(operation_id)
        .execute(pool)
        .await?;

    Ok(restored)
}

/// List recent bulk operations for a user on a board.
pub async fn list_bulk_operations(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<BulkOperation>, TaskQueryError> {
    let ops = sqlx::query_as::<_, BulkOperation>(
        r"
        SELECT * FROM bulk_operations
        WHERE project_id = $1 AND user_id = $2 AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 10
        ",
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(ops)
}

// ─── Internal helpers ────────────────────────────────────────────

fn enforce_task_cap(count: usize) -> Result<(), TaskQueryError> {
    if count > MAX_BULK_TASKS {
        return Err(TaskQueryError::Other(format!(
            "Bulk operations are limited to {} tasks (requested {})",
            MAX_BULK_TASKS, count
        )));
    }
    Ok(())
}

async fn verify_board_membership(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<(), TaskQueryError> {
    if !super::membership::verify_project_membership(pool, board_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }
    Ok(())
}

async fn apply_action(
    pool: &PgPool,
    board_id: Uuid,
    action: &BulkAction,
    task_ids: &[Uuid],
) -> Result<u64, TaskQueryError> {
    let result = match action {
        BulkAction::UpdatePriority { priority } => {
            sqlx::query(
                "UPDATE tasks SET priority = $1, updated_at = now() WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL",
            )
            .bind(priority)
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::UpdateStatus { status_id } => {
            sqlx::query(
                "UPDATE tasks SET status_id = $1, updated_at = now() WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL",
            )
            .bind(status_id)
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::AssignUser { user_id } => {
            sqlx::query(
                r"
                INSERT INTO task_assignees (task_id, user_id)
                SELECT t.id, $1
                FROM tasks t
                WHERE t.id = ANY($2) AND t.project_id = $3 AND t.deleted_at IS NULL
                ON CONFLICT (task_id, user_id) DO NOTHING
                ",
            )
            .bind(user_id)
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::UnassignUser { user_id } => {
            sqlx::query(
                r"
                DELETE FROM task_assignees
                WHERE user_id = $1 AND task_id = ANY(
                    SELECT id FROM tasks WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL
                )
                ",
            )
            .bind(user_id)
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::SetMilestone { milestone_id } => {
            sqlx::query(
                "UPDATE tasks SET milestone_id = $1, updated_at = now() WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL",
            )
            .bind(milestone_id)
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::ClearMilestone => {
            sqlx::query(
                "UPDATE tasks SET milestone_id = NULL, updated_at = now() WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL",
            )
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::UpdateTaskList { task_list_id } => {
            sqlx::query(
                "UPDATE tasks SET task_list_id = $1, updated_at = now() WHERE id = ANY($2) AND project_id = $3 AND deleted_at IS NULL",
            )
            .bind(task_list_id)
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::ClearTaskList => {
            sqlx::query(
                "UPDATE tasks SET task_list_id = NULL, updated_at = now() WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL",
            )
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
        BulkAction::Delete => {
            sqlx::query(
                "UPDATE tasks SET deleted_at = now(), updated_at = now() WHERE id = ANY($1) AND project_id = $2 AND deleted_at IS NULL",
            )
            .bind(task_ids)
            .bind(board_id)
            .execute(pool)
            .await?
        }
    };
    Ok(result.rows_affected())
}

fn describe_action(action: &BulkAction, count: usize) -> (String, String) {
    match action {
        BulkAction::UpdatePriority { priority } => (
            "update_priority".to_string(),
            format!("Set priority to {:?} on {} tasks", priority, count),
        ),
        BulkAction::UpdateStatus { .. } => (
            "update_status".to_string(),
            format!("Update status on {} tasks", count),
        ),
        BulkAction::AssignUser { .. } => (
            "assign_user".to_string(),
            format!("Assign user to {} tasks", count),
        ),
        BulkAction::UnassignUser { .. } => (
            "unassign_user".to_string(),
            format!("Unassign user from {} tasks", count),
        ),
        BulkAction::SetMilestone { .. } => (
            "set_milestone".to_string(),
            format!("Set milestone on {} tasks", count),
        ),
        BulkAction::ClearMilestone => (
            "clear_milestone".to_string(),
            format!("Clear milestone on {} tasks", count),
        ),
        BulkAction::UpdateTaskList { .. } => (
            "update_task_list".to_string(),
            format!("Set task list on {} tasks", count),
        ),
        BulkAction::ClearTaskList => (
            "clear_task_list".to_string(),
            format!("Clear task list on {} tasks", count),
        ),
        BulkAction::Delete => ("delete".to_string(), format!("Delete {} tasks", count)),
    }
}
