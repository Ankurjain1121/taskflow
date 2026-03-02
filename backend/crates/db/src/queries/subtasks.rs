use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Subtask, SubtaskWithAssignee, Task, TaskPriority};
use crate::utils::generate_key_between;

/// Error type for subtask query operations
#[derive(Debug, thiserror::Error)]
pub enum SubtaskQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Subtask not found")]
    NotFound,
}

/// Progress info for subtask completion
#[derive(Debug, Serialize, Deserialize)]
pub struct SubtaskProgress {
    pub completed: i64,
    pub total: i64,
}

/// List all subtasks for a task, ordered by position, with assignee info
pub async fn list_subtasks_by_task(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<SubtaskWithAssignee>, SubtaskQueryError> {
    let subtasks = sqlx::query_as::<_, SubtaskWithAssignee>(
        r#"
        SELECT
            s.id,
            s.title,
            s.is_completed,
            s.position,
            s.task_id,
            s.created_by_id,
            s.assigned_to_id,
            s.due_date,
            s.completed_at,
            s.created_at,
            s.updated_at,
            u.name as assignee_name,
            u.avatar_url as assignee_avatar_url
        FROM subtasks s
        LEFT JOIN users u ON u.id = s.assigned_to_id
        WHERE s.task_id = $1
        ORDER BY s.position ASC
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(subtasks)
}

/// Create a new subtask with auto-generated position
pub async fn create_subtask(
    pool: &PgPool,
    task_id: Uuid,
    title: &str,
    created_by_id: Uuid,
    assigned_to_id: Option<Uuid>,
    due_date: Option<NaiveDate>,
) -> Result<Subtask, SubtaskQueryError> {
    // Get the last position to calculate the new one
    let last_position = sqlx::query_scalar::<_, String>(
        r#"
        SELECT position
        FROM subtasks
        WHERE task_id = $1
        ORDER BY position DESC
        LIMIT 1
        "#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);

    let subtask_id = Uuid::new_v4();

    let subtask = sqlx::query_as::<_, Subtask>(
        r#"
        INSERT INTO subtasks (id, title, position, task_id, created_by_id, assigned_to_id, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            assigned_to_id,
            due_date,
            completed_at,
            created_at,
            updated_at
        "#,
    )
    .bind(subtask_id)
    .bind(title)
    .bind(&position)
    .bind(task_id)
    .bind(created_by_id)
    .bind(assigned_to_id)
    .bind(due_date)
    .fetch_one(pool)
    .await?;

    Ok(subtask)
}

/// Update a subtask's title, assignee, and due date
pub async fn update_subtask(
    pool: &PgPool,
    subtask_id: Uuid,
    title: Option<&str>,
    assigned_to_id: Option<Option<Uuid>>,
    due_date: Option<Option<NaiveDate>>,
) -> Result<Subtask, SubtaskQueryError> {
    // Build SET clause dynamically based on which fields are provided
    let mut set_parts = vec!["updated_at = NOW()".to_string()];
    let mut param_idx = 2u32; // $1 is subtask_id

    if title.is_some() {
        set_parts.push(format!("title = ${param_idx}"));
        param_idx += 1;
    }
    if assigned_to_id.is_some() {
        set_parts.push(format!("assigned_to_id = ${param_idx}"));
        param_idx += 1;
    }
    if due_date.is_some() {
        set_parts.push(format!("due_date = ${param_idx}"));
        // param_idx not needed after last use
    }

    let query = format!(
        r#"
        UPDATE subtasks
        SET {}
        WHERE id = $1
        RETURNING
            id, title, is_completed, position, task_id, created_by_id,
            assigned_to_id, due_date, completed_at, created_at, updated_at
        "#,
        set_parts.join(", ")
    );

    let mut q = sqlx::query_as::<_, Subtask>(&query).bind(subtask_id);

    if let Some(t) = title {
        q = q.bind(t);
    }
    if let Some(a) = assigned_to_id {
        q = q.bind(a);
    }
    if let Some(d) = due_date {
        q = q.bind(d);
    }

    let subtask = q
        .fetch_optional(pool)
        .await?
        .ok_or(SubtaskQueryError::NotFound)?;

    Ok(subtask)
}

/// Toggle a subtask's completion status
pub async fn toggle_subtask(pool: &PgPool, subtask_id: Uuid) -> Result<Subtask, SubtaskQueryError> {
    let subtask = sqlx::query_as::<_, Subtask>(
        r#"
        UPDATE subtasks
        SET
            is_completed = NOT is_completed,
            completed_at = CASE WHEN is_completed THEN NULL ELSE NOW() END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            assigned_to_id,
            due_date,
            completed_at,
            created_at,
            updated_at
        "#,
    )
    .bind(subtask_id)
    .fetch_optional(pool)
    .await?
    .ok_or(SubtaskQueryError::NotFound)?;

    Ok(subtask)
}

/// Delete a subtask
pub async fn delete_subtask(pool: &PgPool, subtask_id: Uuid) -> Result<(), SubtaskQueryError> {
    let rows_affected = sqlx::query(
        r#"
        DELETE FROM subtasks
        WHERE id = $1
        "#,
    )
    .bind(subtask_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(SubtaskQueryError::NotFound);
    }

    Ok(())
}

/// Reorder a subtask by updating its position
pub async fn reorder_subtask(
    pool: &PgPool,
    subtask_id: Uuid,
    new_position: &str,
) -> Result<Subtask, SubtaskQueryError> {
    let subtask = sqlx::query_as::<_, Subtask>(
        r#"
        UPDATE subtasks
        SET position = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING
            id,
            title,
            is_completed,
            position,
            task_id,
            created_by_id,
            assigned_to_id,
            due_date,
            completed_at,
            created_at,
            updated_at
        "#,
    )
    .bind(subtask_id)
    .bind(new_position)
    .fetch_optional(pool)
    .await?
    .ok_or(SubtaskQueryError::NotFound)?;

    Ok(subtask)
}

/// Get subtask completion progress for a task
pub async fn get_subtask_progress(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<SubtaskProgress, SubtaskQueryError> {
    let total: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM subtasks
        WHERE task_id = $1
        "#,
    )
    .bind(task_id)
    .fetch_one(pool)
    .await?;

    let completed: i64 = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM subtasks
        WHERE task_id = $1 AND is_completed = true
        "#,
    )
    .bind(task_id)
    .fetch_one(pool)
    .await?;

    Ok(SubtaskProgress { completed, total })
}

/// Get the task_id for a subtask (for authorization checks)
pub async fn get_subtask_task_id(
    pool: &PgPool,
    subtask_id: Uuid,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT task_id FROM subtasks WHERE id = $1
        "#,
    )
    .bind(subtask_id)
    .fetch_optional(pool)
    .await
}

/// Promote a subtask to a full task in the same board/column
/// Returns the newly created Task and deletes the subtask in a transaction
pub async fn promote_subtask_to_task(
    pool: &PgPool,
    subtask_id: Uuid,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<Task, SubtaskQueryError> {
    // Get the subtask and its parent task info
    let row = sqlx::query_as::<_, SubtaskPromoteRow>(
        r#"
        SELECT s.id, s.title, s.assigned_to_id, s.due_date,
               t.board_id, t.column_id, t.id as parent_task_id
        FROM subtasks s
        INNER JOIN tasks t ON t.id = s.task_id
        WHERE s.id = $1
        "#,
    )
    .bind(subtask_id)
    .fetch_optional(pool)
    .await?
    .ok_or(SubtaskQueryError::NotFound)?;

    // Get the last position in the column
    let last_position = sqlx::query_scalar::<_, String>(
        r#"
        SELECT position FROM tasks
        WHERE column_id = $1 AND deleted_at IS NULL
        ORDER BY position DESC
        LIMIT 1
        "#,
    )
    .bind(row.column_id)
    .fetch_optional(pool)
    .await?;

    let position = generate_key_between(last_position.as_deref(), None);
    let task_id = Uuid::new_v4();

    // Create the new task
    let task = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (id, title, priority, column_id, board_id, position, tenant_id, created_by_id, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, title, description, priority, due_date, start_date, estimated_hours,
                  board_id, column_id, group_id, position, milestone_id, task_number,
                  eisenhower_urgency, eisenhower_importance,
                  tenant_id, created_by_id, deleted_at, created_at, updated_at, version
        "#,
    )
    .bind(task_id)
    .bind(&row.title)
    .bind(TaskPriority::Medium)
    .bind(row.column_id)
    .bind(row.board_id)
    .bind(&position)
    .bind(tenant_id)
    .bind(user_id)
    .bind(row.due_date)
    .fetch_one(pool)
    .await?;

    // Assign the subtask's assignee to the new task if one existed
    if let Some(assignee_id) = row.assigned_to_id {
        sqlx::query(
            r#"
            INSERT INTO task_assignees (task_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            "#,
        )
        .bind(task_id)
        .bind(assignee_id)
        .execute(pool)
        .await?;
    }

    // Delete the subtask
    sqlx::query("DELETE FROM subtasks WHERE id = $1")
        .bind(subtask_id)
        .execute(pool)
        .await?;

    Ok(task)
}

/// Internal row for promote operation
#[derive(sqlx::FromRow)]
struct SubtaskPromoteRow {
    #[allow(dead_code)]
    id: Uuid,
    title: String,
    assigned_to_id: Option<Uuid>,
    due_date: Option<NaiveDate>,
    board_id: Uuid,
    column_id: Uuid,
    #[allow(dead_code)]
    parent_task_id: Uuid,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::queries::{auth, boards, tasks, workspaces};

    const FAKE_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$fake_salt$fake_hash_for_test";

    async fn test_pool() -> sqlx::PgPool {
        sqlx::PgPool::connect(
            "postgresql://taskflow:189015388bb0f90c999ea6b975d7e494@localhost:5433/taskflow",
        )
        .await
        .expect("Failed to connect to test database")
    }

    fn unique_email() -> String {
        format!("inttest-st-{}@example.com", Uuid::new_v4())
    }

    async fn setup_user(pool: &sqlx::PgPool) -> (Uuid, Uuid) {
        let user = auth::create_user_with_tenant(pool, &unique_email(), "ST Test User", FAKE_HASH)
            .await
            .expect("create_user_with_tenant");
        (user.tenant_id, user.id)
    }

    async fn setup_user_and_workspace(pool: &sqlx::PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id) = setup_user(pool).await;
        let ws = workspaces::create_workspace(pool, "ST Test WS", None, tenant_id, user_id)
            .await
            .expect("create_workspace");
        (tenant_id, user_id, ws.id)
    }

    async fn setup_full(pool: &sqlx::PgPool) -> (Uuid, Uuid, Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, ws_id) = setup_user_and_workspace(pool).await;
        let bwc = boards::create_board(pool, "ST Test Board", None, ws_id, tenant_id, user_id)
            .await
            .expect("create_board");
        let first_col_id = bwc.columns[0].id;
        (tenant_id, user_id, ws_id, bwc.board.id, first_col_id)
    }

    async fn setup_with_task(pool: &sqlx::PgPool) -> (Uuid, Uuid, Uuid) {
        let (tenant_id, user_id, _ws_id, board_id, col_id) = setup_full(pool).await;
        let input = tasks::CreateTaskInput {
            title: "Subtask Parent".to_string(),
            description: None,
            priority: TaskPriority::Medium,
            due_date: None,
            start_date: None,
            estimated_hours: None,
            column_id: col_id,
            group_id: None,
            milestone_id: None,
            assignee_ids: None,
            label_ids: None,
        };
        let task = tasks::create_task(pool, board_id, input, tenant_id, user_id)
            .await
            .expect("create parent task for subtask tests");
        (task.id, user_id, tenant_id)
    }

    #[tokio::test]
    async fn test_create_subtask() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        let subtask = create_subtask(&pool, task_id, "Write unit tests", user_id, None, None)
            .await
            .expect("create_subtask");

        assert_eq!(subtask.title, "Write unit tests");
        assert_eq!(subtask.task_id, task_id);
        assert_eq!(subtask.created_by_id, user_id);
        assert!(!subtask.is_completed);
        assert!(subtask.completed_at.is_none());
        assert!(!subtask.position.is_empty());
        assert!(subtask.assigned_to_id.is_none());
        assert!(subtask.due_date.is_none());
    }

    #[tokio::test]
    async fn test_create_subtask_with_assignee_and_due_date() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;
        let due = NaiveDate::from_ymd_opt(2026, 3, 15).expect("valid date");

        let subtask = create_subtask(
            &pool,
            task_id,
            "With extras",
            user_id,
            Some(user_id),
            Some(due),
        )
        .await
        .expect("create_subtask with extras");

        assert_eq!(subtask.assigned_to_id, Some(user_id));
        assert_eq!(subtask.due_date, Some(due));
    }

    #[tokio::test]
    async fn test_list_subtasks_by_task() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        create_subtask(&pool, task_id, "Subtask A", user_id, None, None)
            .await
            .expect("create subtask A");
        create_subtask(&pool, task_id, "Subtask B", user_id, None, None)
            .await
            .expect("create subtask B");

        let subtasks = list_subtasks_by_task(&pool, task_id)
            .await
            .expect("list_subtasks_by_task");

        assert!(subtasks.len() >= 2);
        let titles: Vec<&str> = subtasks.iter().map(|s| s.title.as_str()).collect();
        assert!(titles.contains(&"Subtask A"));
        assert!(titles.contains(&"Subtask B"));
    }

    #[tokio::test]
    async fn test_toggle_subtask() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        let subtask = create_subtask(&pool, task_id, "Toggle me", user_id, None, None)
            .await
            .expect("create subtask");

        assert!(!subtask.is_completed);

        // Toggle to completed
        let toggled = toggle_subtask(&pool, subtask.id)
            .await
            .expect("toggle_subtask to completed");
        assert!(toggled.is_completed);
        assert!(toggled.completed_at.is_some());

        // Toggle back to not completed
        let toggled_back = toggle_subtask(&pool, toggled.id)
            .await
            .expect("toggle_subtask back");
        assert!(!toggled_back.is_completed);
        assert!(toggled_back.completed_at.is_none());
    }

    #[tokio::test]
    async fn test_update_subtask() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        let subtask = create_subtask(&pool, task_id, "Old Title", user_id, None, None)
            .await
            .expect("create subtask");

        let updated = update_subtask(&pool, subtask.id, Some("New Title"), None, None)
            .await
            .expect("update_subtask");

        assert_eq!(updated.title, "New Title");
        assert_eq!(updated.id, subtask.id);
    }

    #[tokio::test]
    async fn test_delete_subtask() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        let subtask = create_subtask(&pool, task_id, "Delete me", user_id, None, None)
            .await
            .expect("create subtask");

        delete_subtask(&pool, subtask.id)
            .await
            .expect("delete_subtask");

        // Verify it is gone from the list
        let subtasks = list_subtasks_by_task(&pool, task_id)
            .await
            .expect("list after delete");
        assert!(
            !subtasks.iter().any(|s| s.id == subtask.id),
            "deleted subtask should not appear in list"
        );
    }

    #[tokio::test]
    async fn test_delete_subtask_not_found() {
        let pool = test_pool().await;
        let random_id = Uuid::new_v4();

        let result = delete_subtask(&pool, random_id).await;
        assert!(result.is_err(), "deleting non-existent subtask should fail");
    }

    #[tokio::test]
    async fn test_get_subtask_progress() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        // Initially no subtasks
        let progress = get_subtask_progress(&pool, task_id)
            .await
            .expect("get_subtask_progress empty");
        assert_eq!(progress.total, 0);
        assert_eq!(progress.completed, 0);

        // Add two subtasks, complete one
        let s1 = create_subtask(&pool, task_id, "Progress A", user_id, None, None)
            .await
            .expect("create subtask A");
        create_subtask(&pool, task_id, "Progress B", user_id, None, None)
            .await
            .expect("create subtask B");

        toggle_subtask(&pool, s1.id)
            .await
            .expect("toggle subtask A");

        let progress = get_subtask_progress(&pool, task_id)
            .await
            .expect("get_subtask_progress with data");
        assert_eq!(progress.total, 2);
        assert_eq!(progress.completed, 1);
    }

    #[tokio::test]
    async fn test_reorder_subtask() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        let subtask = create_subtask(&pool, task_id, "Reorder me", user_id, None, None)
            .await
            .expect("create subtask");

        let reordered = reorder_subtask(&pool, subtask.id, "zzz")
            .await
            .expect("reorder_subtask");

        assert_eq!(reordered.position, "zzz");
    }

    #[tokio::test]
    async fn test_get_subtask_task_id() {
        let pool = test_pool().await;
        let (task_id, user_id, _tenant_id) = setup_with_task(&pool).await;

        let subtask = create_subtask(&pool, task_id, "Task ID lookup", user_id, None, None)
            .await
            .expect("create subtask");

        let found_task_id = get_subtask_task_id(&pool, subtask.id)
            .await
            .expect("get_subtask_task_id")
            .expect("should find task_id");

        assert_eq!(found_task_id, task_id);

        // Non-existent subtask
        let not_found = get_subtask_task_id(&pool, Uuid::new_v4())
            .await
            .expect("get_subtask_task_id for nonexistent");
        assert!(not_found.is_none());
    }
}
