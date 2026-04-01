//! Read-only and validation helpers for tasks.
//!
//! Split from `tasks.rs` to keep that file focused on mutation operations.
//! All functions here are pure reads or validations — no INSERT/UPDATE/DELETE.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use super::membership::verify_project_membership;
use super::tasks::{AssigneeInfo, TaskQueryError, TaskWithDetails};
use crate::models::{Label, Task};

/// Validate that a status transition is allowed by the blueprint.
/// Returns Ok(()) if the transition is allowed, Err if blocked.
/// NULL allowed_transitions = allow all (backward compat).
/// Empty array = terminal status (no outgoing transitions).
pub async fn validate_transition(
    pool: &PgPool,
    from_status_id: Uuid,
    to_status_id: Uuid,
) -> Result<(), TaskQueryError> {
    if from_status_id == to_status_id {
        return Ok(());
    }

    let allowed: Option<Option<Vec<Uuid>>> = sqlx::query_scalar::<_, Option<Vec<Uuid>>>(
        "SELECT allowed_transitions FROM project_statuses WHERE id = $1",
    )
    .bind(from_status_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        // Catch stale FK — status was deleted between reads
        TaskQueryError::Other(format!("Status configuration changed: {e}"))
    })?;

    match allowed {
        None => {
            // Status not found
            Err(TaskQueryError::NotFound)
        }
        Some(None) => {
            // NULL = allow all transitions
            Ok(())
        }
        Some(Some(ref transitions)) if transitions.contains(&to_status_id) => Ok(()),
        Some(Some(_)) => Err(TaskQueryError::Other(
            "Transition not allowed by blueprint".to_string(),
        )),
    }
}

/// Fetch a full Task row by ID (non-deleted).
/// Used when callers need the complete task for broadcasting or diffing.
pub async fn get_task_row(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Option<crate::models::Task>, sqlx::Error> {
    sqlx::query_as::<_, crate::models::Task>(
        r"
        SELECT
            id, title, description, priority,
            due_date, start_date, estimated_hours,
            project_id, status_id, task_list_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
}

/// Fetch the current status_id for a task (non-deleted).
pub async fn get_task_status_id(pool: &PgPool, task_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT status_id FROM tasks WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
}

/// Check whether a project status has type = 'done'.
pub async fn is_done_status(pool: &PgPool, status_id: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar::<_, bool>(
        r"
        SELECT type = 'done'
        FROM project_statuses WHERE id = $1
        ",
    )
    .bind(status_id)
    .fetch_optional(pool)
    .await
    .map(|opt| opt.unwrap_or(false))
}

/// Find the first status with type = 'done' for a project.
pub async fn find_done_status(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar(
        r"
        SELECT id FROM project_statuses
        WHERE project_id = $1 AND type = 'done'
        ORDER BY position ASC
        LIMIT 1
        ",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}

/// Find the first status with type != 'done' for a project.
pub async fn find_non_done_status(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar(
        r"
        SELECT id FROM project_statuses
        WHERE project_id = $1 AND type != 'done'
        ORDER BY position ASC
        LIMIT 1
        ",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}

/// Get a user's display_name by ID.
pub async fn get_user_display_name(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar("SELECT display_name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await
}

/// Get task's project_id (for authorization checks)
pub async fn get_task_project_id(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT project_id FROM tasks WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await
}

/// Alias for backward compat
pub async fn get_task_board_id(pool: &PgPool, task_id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    get_task_project_id(pool, task_id).await
}

/// List tasks for a project, grouped by status_id (capped at 1000 rows).
/// Returns HashMap<status_id, Vec<Task>>
pub async fn list_tasks_by_board(
    pool: &PgPool,
    project_id: Uuid,
    user_id: Uuid,
) -> Result<HashMap<Uuid, Vec<Task>>, TaskQueryError> {
    // First verify user is a project member
    if !verify_project_membership(pool, project_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    // Fetch tasks for the project with safety limit (respects visibility filtering)
    let tasks = sqlx::query_as::<_, Task>(
        r"
        SELECT
            t.id, t.title, t.description, t.priority, t.due_date, t.start_date,
            t.estimated_hours, t.project_id, t.task_list_id, t.status_id, t.position,
            t.milestone_id, t.task_number, t.eisenhower_urgency, t.eisenhower_importance,
            t.tenant_id, t.created_by_id, t.deleted_at, t.created_at, t.updated_at,
            t.version, t.parent_task_id, t.depth, t.reporting_person_id
        FROM tasks t
        LEFT JOIN task_lists tl ON tl.id = t.task_list_id
        WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
          AND (
            -- No role assigned yet (pre-migration) = full access
            NOT EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $2 AND pm.role_id IS NOT NULL)
            OR
            -- Role has can_view_all_tasks capability
            (SELECT wr.capabilities->>'can_view_all_tasks' = 'true'
             FROM workspace_roles wr
             JOIN project_members pm ON pm.role_id = wr.id
             WHERE pm.project_id = t.project_id AND pm.user_id = $2)
            OR
            -- Effective visibility is public (default)
            COALESCE(tl.effective_visibility, 'public') = 'public'
            OR
            -- User is assigned to this task
            EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2)
          )
        ORDER BY t.position ASC
        LIMIT 1000
        ",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    // Group tasks by status_id
    let mut grouped: HashMap<Uuid, Vec<Task>> = HashMap::new();
    for task in tasks {
        if let Some(sid) = task.status_id {
            grouped.entry(sid).or_default().push(task);
        }
    }

    Ok(grouped)
}

/// Get a task by ID with all details (assignees, labels, counts)
pub async fn get_task_by_id(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Option<TaskWithDetails>, TaskQueryError> {
    // Fetch the task first
    let task = sqlx::query_as::<_, Task>(
        r"
        SELECT
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?;

    let task = match task {
        Some(t) => t,
        None => return Ok(None),
    };

    // Verify user is a project member
    if !verify_project_membership(pool, task.project_id, user_id).await? {
        return Err(TaskQueryError::NotProjectMember);
    }

    // Fetch assignees, labels, counts, and watchers in parallel
    let (assignees, labels, comment_count, attachment_count, watchers) = tokio::try_join!(
        sqlx::query_as::<_, AssigneeInfo>(
            r"
            SELECT
                ta.user_id,
                u.name,
                u.avatar_url,
                ta.assigned_at
            FROM task_assignees ta
            JOIN users u ON u.id = ta.user_id
            WHERE ta.task_id = $1
            ",
        )
        .bind(task_id)
        .fetch_all(pool),
        sqlx::query_as::<_, Label>(
            r"
            SELECT l.id, l.name, l.color, l.project_id
            FROM labels l
            JOIN task_labels tl ON tl.label_id = l.id
            WHERE tl.task_id = $1
            ",
        )
        .bind(task_id)
        .fetch_all(pool),
        sqlx::query_scalar::<_, i64>(
            r"
            SELECT COUNT(*)
            FROM comments
            WHERE task_id = $1 AND deleted_at IS NULL
            ",
        )
        .bind(task_id)
        .fetch_one(pool),
        sqlx::query_scalar::<_, i64>(
            r"
            SELECT COUNT(*)
            FROM attachments
            WHERE task_id = $1 AND deleted_at IS NULL
            ",
        )
        .bind(task_id)
        .fetch_one(pool),
        super::task_watchers::get_watcher_info(pool, task_id),
    )?;

    Ok(Some(TaskWithDetails {
        task,
        assignees,
        labels,
        watchers,
        comment_count,
        attachment_count,
    }))
}

/// Child task with assignees and labels (enriched for subtask list UI)
#[derive(Debug, Serialize)]
pub struct ChildTaskWithDetails {
    #[serde(flatten)]
    pub task: Task,
    pub assignees: Vec<AssigneeInfo>,
    pub labels: Vec<Label>,
}

/// List child tasks for a parent task
pub async fn list_child_tasks(
    pool: &PgPool,
    parent_task_id: Uuid,
) -> Result<Vec<Task>, TaskQueryError> {
    let children = sqlx::query_as::<_, Task>(
        r"SELECT id, title, description, priority, due_date, start_date,
           estimated_hours, project_id, task_list_id, status_id, position,
           milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
           tenant_id, created_by_id, deleted_at,
           created_at, updated_at, version, parent_task_id, depth, reporting_person_id
        FROM tasks
        WHERE parent_task_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC",
    )
    .bind(parent_task_id)
    .fetch_all(pool)
    .await?;
    Ok(children)
}

/// List child tasks with assignees and labels (enriched for subtask list UI)
pub async fn list_child_tasks_with_details(
    pool: &PgPool,
    parent_task_id: Uuid,
) -> Result<Vec<ChildTaskWithDetails>, TaskQueryError> {
    // 1. Fetch child tasks
    let children = list_child_tasks(pool, parent_task_id).await?;
    if children.is_empty() {
        return Ok(vec![]);
    }

    let child_ids: Vec<Uuid> = children.iter().map(|c| c.id).collect();

    // 2. Batch fetch assignees for all children
    let assignee_rows = sqlx::query_as::<_, ChildAssigneeRow>(
        r"
        SELECT ta.task_id, ta.user_id, u.name, u.avatar_url, ta.assigned_at
        FROM task_assignees ta
        JOIN users u ON u.id = ta.user_id
        WHERE ta.task_id = ANY($1)
        ",
    )
    .bind(&child_ids)
    .fetch_all(pool)
    .await?;

    // 3. Batch fetch labels for all children
    let label_rows = sqlx::query_as::<_, ChildLabelRow>(
        r"
        SELECT tl.task_id, l.id, l.name, l.color, l.project_id
        FROM task_labels tl
        JOIN labels l ON l.id = tl.label_id
        WHERE tl.task_id = ANY($1)
        ",
    )
    .bind(&child_ids)
    .fetch_all(pool)
    .await?;

    // 4. Group by task_id
    let mut assignee_map: HashMap<Uuid, Vec<AssigneeInfo>> = HashMap::new();
    for row in assignee_rows {
        assignee_map
            .entry(row.task_id)
            .or_default()
            .push(AssigneeInfo {
                user_id: row.user_id,
                name: row.name,
                avatar_url: row.avatar_url,
                assigned_at: row.assigned_at,
            });
    }

    let mut label_map: HashMap<Uuid, Vec<Label>> = HashMap::new();
    for row in label_rows {
        label_map.entry(row.task_id).or_default().push(Label {
            id: row.id,
            name: row.name,
            color: row.color,
            project_id: row.project_id,
        });
    }

    // 5. Assemble enriched children
    let enriched = children
        .into_iter()
        .map(|task| {
            let assignees = assignee_map.remove(&task.id).unwrap_or_default();
            let labels = label_map.remove(&task.id).unwrap_or_default();
            ChildTaskWithDetails {
                task,
                assignees,
                labels,
            }
        })
        .collect();

    Ok(enriched)
}

/// Internal row for batch assignee fetch
#[derive(Debug, sqlx::FromRow)]
struct ChildAssigneeRow {
    task_id: Uuid,
    user_id: Uuid,
    name: String,
    avatar_url: Option<String>,
    assigned_at: DateTime<Utc>,
}

/// Internal row for batch label fetch
#[derive(Debug, sqlx::FromRow)]
struct ChildLabelRow {
    task_id: Uuid,
    id: Uuid,
    name: String,
    color: String,
    project_id: Uuid,
}
