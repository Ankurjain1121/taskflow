use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Label, Task, TaskPriority};
use crate::utils::generate_key_between;

// Re-export read-only/validation helpers so consumers don't need import changes
pub use super::tasks_helpers::*;

/// Error type for task query operations
#[derive(Debug, thiserror::Error)]
pub enum TaskQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("User is not a member of this project")]
    NotProjectMember,
    #[error("Task not found")]
    NotFound,
    #[error("Version conflict: task was modified by another user")]
    VersionConflict(Box<Task>),
    #[error("{0}")]
    Other(String),
}

// Backward-compat alias
pub use TaskQueryError::NotProjectMember as NotBoardMember;

/// Input for creating a new task
#[derive(Debug, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub estimated_hours: Option<f64>,
    pub status_id: Option<Uuid>,
    pub task_list_id: Option<Uuid>,
    pub milestone_id: Option<Uuid>,
    pub assignee_ids: Option<Vec<Uuid>>,
    pub label_ids: Option<Vec<Uuid>>,
    pub parent_task_id: Option<Uuid>,
    pub reporting_person_id: Option<Uuid>,
}

/// Input for updating an existing task
#[derive(Debug, Deserialize)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub due_date: Option<DateTime<Utc>>,
    pub start_date: Option<DateTime<Utc>>,
    pub estimated_hours: Option<f64>,
    pub milestone_id: Option<Uuid>,
    /// Explicit clear flags — when true, set the field to NULL even if the value is None
    #[serde(default)]
    pub clear_description: Option<bool>,
    #[serde(default)]
    pub clear_due_date: Option<bool>,
    #[serde(default)]
    pub clear_start_date: Option<bool>,
    #[serde(default)]
    pub clear_estimated_hours: Option<bool>,
    #[serde(default)]
    pub clear_milestone: Option<bool>,
    /// Expected version for optimistic concurrency control.
    /// When set, the update will only succeed if the task's current version matches.
    #[serde(default)]
    pub expected_version: Option<i32>,
}

/// Task with all associated details
#[derive(Debug, Serialize)]
pub struct TaskWithDetails {
    #[serde(flatten)]
    pub task: Task,
    pub assignees: Vec<AssigneeInfo>,
    pub labels: Vec<Label>,
    pub watchers: Vec<super::task_watchers::WatcherInfo>,
    pub comment_count: i64,
    pub attachment_count: i64,
}

/// Basic assignee information
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AssigneeInfo {
    pub user_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub assigned_at: DateTime<Utc>,
}

/// Create a new task
pub async fn create_task(
    pool: &PgPool,
    project_id: Uuid,
    input: CreateTaskInput,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<Task, TaskQueryError> {
    let mut tx = pool.begin().await?;

    // Resolve status_id: use provided or look up default
    let status_id = match input.status_id {
        Some(sid) => Some(sid),
        None => {
            sqlx::query_scalar::<_, Uuid>(
                r#"
                SELECT id FROM project_statuses
                WHERE project_id = $1 AND is_default = true
                LIMIT 1
                "#,
            )
            .bind(project_id)
            .fetch_optional(&mut *tx)
            .await?
        }
    };

    // Resolve task_list_id: use provided or look up default
    let task_list_id = match input.task_list_id {
        Some(tlid) => Some(tlid),
        None => {
            sqlx::query_scalar::<_, Uuid>(
                r#"
                SELECT id FROM task_lists
                WHERE project_id = $1 AND is_default = true AND deleted_at IS NULL
                LIMIT 1
                "#,
            )
            .bind(project_id)
            .fetch_optional(&mut *tx)
            .await?
        }
    };

    // Get the last position in the project to calculate new position
    let last_position = sqlx::query_scalar::<_, String>(
        r#"
        SELECT position
        FROM tasks
        WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY position DESC
        LIMIT 1
        "#,
    )
    .bind(project_id)
    .fetch_optional(&mut *tx)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);

    let task_id = Uuid::new_v4();

    // Compute depth from parent if provided
    let (parent_task_id, depth) = if let Some(pid) = input.parent_task_id {
        let parent_depth = sqlx::query_scalar::<_, i16>(
            "SELECT depth FROM tasks WHERE id = $1 AND deleted_at IS NULL",
        )
        .bind(pid)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| TaskQueryError::Other("Parent task not found".to_string()))?;
        let child_depth = parent_depth + 1;
        if child_depth > 5 {
            return Err(TaskQueryError::Other(
                "Maximum subtask depth of 5 levels exceeded".to_string(),
            ));
        }
        (Some(pid), child_depth)
    } else {
        (None, 0i16)
    };

    // Insert the task with auto-assigned task_number.
    // Lock the project row (FOR UPDATE) to serialize task_number generation
    // and prevent race conditions from concurrent inserts.
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (id, title, description, priority, due_date, start_date,
                          estimated_hours, project_id, status_id, task_list_id, position,
                          milestone_id, task_number, tenant_id, created_by_id, parent_task_id, depth,
                          reporting_person_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                COALESCE((SELECT MAX(task_number) FROM tasks WHERE project_id = (SELECT id FROM projects WHERE id = $8 FOR UPDATE)), 0) + 1,
                $13, $14, $15, $16, $17)
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        "#,
    )
    .bind(task_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.priority)
    .bind(input.due_date)
    .bind(input.start_date)
    .bind(input.estimated_hours)
    .bind(project_id)
    .bind(status_id)
    .bind(task_list_id)
    .bind(&position)
    .bind(input.milestone_id)
    .bind(tenant_id)
    .bind(created_by_id)
    .bind(parent_task_id)
    .bind(depth)
    .bind(input.reporting_person_id)
    .fetch_one(&mut *tx)
    .await?;

    // Insert assignees if provided — batch insert
    if let Some(ref assignee_ids) = input.assignee_ids {
        if !assignee_ids.is_empty() {
            sqlx::query(
                r#"
                INSERT INTO task_assignees (id, task_id, user_id)
                SELECT gen_random_uuid(), $1, unnest($2::uuid[])
                ON CONFLICT (task_id, user_id) DO NOTHING
                "#,
            )
            .bind(task_id)
            .bind(assignee_ids)
            .execute(&mut *tx)
            .await?;
        }
    }

    // Insert labels if provided — batch insert
    if let Some(ref label_ids) = input.label_ids {
        if !label_ids.is_empty() {
            sqlx::query(
                r#"
                INSERT INTO task_labels (id, task_id, label_id)
                SELECT gen_random_uuid(), $1, unnest($2::uuid[])
                ON CONFLICT (task_id, label_id) DO NOTHING
                "#,
            )
            .bind(task_id)
            .bind(label_ids)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(task)
}

/// Update an existing task.
/// If `expected_version` is set, uses optimistic concurrency control:
/// the update only succeeds when the current DB version matches.
/// Returns `VersionConflict(current_task)` on mismatch.
pub async fn update_task(
    pool: &PgPool,
    task_id: Uuid,
    input: UpdateTaskInput,
) -> Result<Task, TaskQueryError> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET
            title = COALESCE($2, title),
            description = CASE WHEN $9 = true THEN NULL WHEN $3 IS NOT NULL THEN $3 ELSE description END,
            priority = COALESCE($4, priority),
            due_date = CASE WHEN $10 = true THEN NULL WHEN $5 IS NOT NULL THEN $5 ELSE due_date END,
            start_date = CASE WHEN $11 = true THEN NULL WHEN $6 IS NOT NULL THEN $6 ELSE start_date END,
            estimated_hours = CASE WHEN $12 = true THEN NULL WHEN $7 IS NOT NULL THEN $7 ELSE estimated_hours END,
            milestone_id = CASE WHEN $13 = true THEN NULL WHEN $8 IS NOT NULL THEN $8 ELSE milestone_id END,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
            AND ($14::int IS NULL OR version = $14)
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        "#,
    )
    .bind(task_id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.priority)
    .bind(input.due_date)
    .bind(input.start_date)
    .bind(input.estimated_hours)
    .bind(input.milestone_id)
    .bind(input.clear_description.unwrap_or(false))
    .bind(input.clear_due_date.unwrap_or(false))
    .bind(input.clear_start_date.unwrap_or(false))
    .bind(input.clear_estimated_hours.unwrap_or(false))
    .bind(input.clear_milestone.unwrap_or(false))
    .bind(input.expected_version)
    .fetch_optional(pool)
    .await?;

    match task {
        Some(t) => Ok(t),
        None => {
            // Row not found — either deleted or version mismatch.
            // Check if the task still exists (version conflict) or is truly gone.
            if input.expected_version.is_some() {
                let current = sqlx::query_as::<_, Task>(
                    r#"
                    SELECT id, title, description, priority, due_date, start_date,
                           estimated_hours, project_id, task_list_id, status_id, position,
                           milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
                           tenant_id, created_by_id, deleted_at, created_at, updated_at,
                           version, parent_task_id, depth, reporting_person_id
                    FROM tasks WHERE id = $1 AND deleted_at IS NULL
                    "#,
                )
                .bind(task_id)
                .fetch_optional(pool)
                .await?;

                if let Some(current_task) = current {
                    return Err(TaskQueryError::VersionConflict(Box::new(current_task)));
                }
            }
            Err(TaskQueryError::NotFound)
        }
    }
}

/// Update a task's status
pub async fn update_task_status(
    pool: &PgPool,
    task_id: Uuid,
    status_id: Uuid,
) -> Result<Task, TaskQueryError> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET status_id = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        "#,
    )
    .bind(task_id)
    .bind(status_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    Ok(task)
}

/// Update a task's task list
pub async fn update_task_list(
    pool: &PgPool,
    task_id: Uuid,
    task_list_id: Uuid,
) -> Result<Task, TaskQueryError> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET task_list_id = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        "#,
    )
    .bind(task_id)
    .bind(task_list_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    Ok(task)
}

/// Soft delete a task and its children (cascade)
pub async fn soft_delete_task(pool: &PgPool, task_id: Uuid) -> Result<(), TaskQueryError> {
    let rows_affected = sqlx::query(
        r#"
        WITH RECURSIVE task_tree AS (
            SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL
            UNION ALL
            SELECT t.id FROM tasks t
            INNER JOIN task_tree tt ON t.parent_task_id = tt.id
            WHERE t.deleted_at IS NULL
        )
        UPDATE tasks
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id IN (SELECT id FROM task_tree)
        "#,
    )
    .bind(task_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(TaskQueryError::NotFound);
    }

    Ok(())
}

/// Move a task to a different status and/or position
pub async fn move_task(
    pool: &PgPool,
    task_id: Uuid,
    target_status_id: Uuid,
    new_position: String,
) -> Result<Task, TaskQueryError> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET
            status_id = $2,
            position = $3,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        "#,
    )
    .bind(task_id)
    .bind(target_status_id)
    .bind(&new_position)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    Ok(task)
}

/// Duplicate a task including assignees and labels
pub async fn duplicate_task(
    pool: &PgPool,
    source_task_id: Uuid,
    created_by_id: Uuid,
) -> Result<Task, TaskQueryError> {
    // Get the source task
    let source = sqlx::query_as::<_, Task>(
        r#"
        SELECT
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(source_task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    // Get position after the source task
    let last_position = sqlx::query_scalar::<_, String>(
        r#"
        SELECT position
        FROM tasks
        WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY position DESC
        LIMIT 1
        "#,
    )
    .bind(source.project_id)
    .fetch_optional(pool)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);

    let new_id = Uuid::new_v4();
    let new_title = format!("Copy of {}", source.title);

    // Insert the duplicate task with auto-assigned task_number.
    // Lock the project row (FOR UPDATE) to serialize task_number generation.
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (id, title, description, priority, due_date, start_date,
                          estimated_hours, project_id, status_id, task_list_id, position,
                          milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
                          tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                COALESCE((SELECT MAX(task_number) FROM tasks WHERE project_id = (SELECT id FROM projects WHERE id = $8 FOR UPDATE)), 0) + 1,
                $13, $14, $15, $16)
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        "#,
    )
    .bind(new_id)
    .bind(&new_title)
    .bind(&source.description)
    .bind(&source.priority)
    .bind(source.due_date)
    .bind(source.start_date)
    .bind(source.estimated_hours)
    .bind(source.project_id)
    .bind(source.status_id)
    .bind(source.task_list_id)
    .bind(&position)
    .bind(source.milestone_id)
    .bind(source.eisenhower_urgency)
    .bind(source.eisenhower_importance)
    .bind(source.tenant_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await?;

    // Copy assignees
    sqlx::query(
        r#"
        INSERT INTO task_assignees (id, task_id, user_id)
        SELECT gen_random_uuid(), $2, user_id
        FROM task_assignees
        WHERE task_id = $1
        ON CONFLICT (task_id, user_id) DO NOTHING
        "#,
    )
    .bind(source_task_id)
    .bind(new_id)
    .execute(pool)
    .await?;

    // Copy labels
    sqlx::query(
        r#"
        INSERT INTO task_labels (id, task_id, label_id)
        SELECT gen_random_uuid(), $2, label_id
        FROM task_labels
        WHERE task_id = $1
        ON CONFLICT (task_id, label_id) DO NOTHING
        "#,
    )
    .bind(source_task_id)
    .bind(new_id)
    .execute(pool)
    .await?;

    // Copy child tasks (preserving parent_task_id pointing to new parent, and depth)
    sqlx::query(
        r#"
        INSERT INTO tasks (id, title, description, priority, project_id, status_id,
                          task_list_id, position, tenant_id, created_by_id, parent_task_id, depth)
        SELECT gen_random_uuid(), title, description, priority, project_id, status_id,
               task_list_id, position, tenant_id, $3, $2, depth
        FROM tasks
        WHERE parent_task_id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(source_task_id)
    .bind(new_id)
    .bind(created_by_id)
    .execute(pool)
    .await
    .ok(); // Child task copy is best-effort

    Ok(task)
}

/// Move a task to a different project, status, and position
pub async fn move_task_to_project(
    pool: &PgPool,
    task_id: Uuid,
    target_project_id: Uuid,
    target_status_id: Uuid,
    new_position: String,
) -> Result<Task, TaskQueryError> {
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET
            project_id = $2,
            status_id = $3,
            position = $4,
            updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING
            id, title, description, priority, due_date, start_date,
            estimated_hours, project_id, task_list_id, status_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at,
            version, parent_task_id, depth, reporting_person_id
        "#,
    )
    .bind(task_id)
    .bind(target_project_id)
    .bind(target_status_id)
    .bind(&new_position)
    .fetch_optional(pool)
    .await?
    .ok_or(TaskQueryError::NotFound)?;

    Ok(task)
}

/// Strip project-scoped labels from a task when moving it to another project
pub async fn strip_task_labels_for_project(
    pool: &PgPool,
    task_id: Uuid,
    source_project_id: Uuid,
) -> Result<u64, TaskQueryError> {
    let rows = sqlx::query(
        r#"
        DELETE FROM task_labels
        WHERE task_id = $1
          AND label_id IN (SELECT id FROM labels WHERE project_id = $2)
        "#,
    )
    .bind(task_id)
    .bind(source_project_id)
    .execute(pool)
    .await?
    .rows_affected();

    Ok(rows)
}

/// Move subtasks to a different project and status
pub async fn move_subtasks_to_project(
    pool: &PgPool,
    parent_task_id: Uuid,
    target_project_id: Uuid,
    target_status_id: Uuid,
) -> Result<Vec<Uuid>, TaskQueryError> {
    let subtask_ids = sqlx::query_scalar::<_, Uuid>(
        r#"
        UPDATE tasks
        SET
            project_id = $2,
            status_id = $3,
            updated_at = NOW()
        WHERE parent_task_id = $1 AND deleted_at IS NULL
        RETURNING id
        "#,
    )
    .bind(parent_task_id)
    .bind(target_project_id)
    .bind(target_status_id)
    .fetch_all(pool)
    .await?;

    Ok(subtask_ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_task_input_deserialize() {
        let json = r#"{
            "title": "Test Task",
            "description": "A test description",
            "priority": "high"
        }"#;

        let input: CreateTaskInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.title, "Test Task");
        assert_eq!(input.priority, TaskPriority::High);
        assert!(input.status_id.is_none());
        assert!(input.task_list_id.is_none());
    }
}
