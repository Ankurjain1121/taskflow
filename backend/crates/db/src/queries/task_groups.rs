//! Task group query functions

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{TaskGroup, TaskGroupWithStats};

/// List task groups for a board ordered by position
pub async fn list_task_groups_by_board(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<TaskGroup>, sqlx::Error> {
    sqlx::query_as!(
        TaskGroup,
        r#"
        SELECT id, board_id, name, color, position, collapsed,
               tenant_id, created_by_id, created_at, updated_at, deleted_at
        FROM task_groups
        WHERE board_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC
        "#,
        board_id
    )
    .fetch_all(pool)
    .await
}

/// List task groups with statistics (task count, completion, estimated hours)
pub async fn list_task_groups_with_stats(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<TaskGroupWithStats>, sqlx::Error> {
    struct Row {
        id: Uuid,
        board_id: Uuid,
        name: String,
        color: String,
        position: String,
        collapsed: bool,
        tenant_id: Uuid,
        created_by_id: Uuid,
        created_at: chrono::DateTime<chrono::Utc>,
        updated_at: chrono::DateTime<chrono::Utc>,
        deleted_at: Option<chrono::DateTime<chrono::Utc>>,
        task_count: Option<i64>,
        completed_count: Option<i64>,
        estimated_hours: Option<f64>,
    }

    let rows = sqlx::query_as!(
        Row,
        r#"
        SELECT
            tg.id, tg.board_id, tg.name, tg.color, tg.position, tg.collapsed,
            tg.tenant_id, tg.created_by_id, tg.created_at, tg.updated_at, tg.deleted_at,
            COUNT(t.id) as task_count,
            COUNT(CASE WHEN bc.status_mapping->>'done' = 'true' THEN 1 END) as completed_count,
            SUM(t.estimated_hours) as estimated_hours
        FROM task_groups tg
        LEFT JOIN tasks t ON t.group_id = tg.id AND t.deleted_at IS NULL
        LEFT JOIN board_columns bc ON t.column_id = bc.id
        WHERE tg.board_id = $1 AND tg.deleted_at IS NULL
        GROUP BY tg.id
        ORDER BY tg.position ASC
        "#,
        board_id
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| TaskGroupWithStats {
            group: TaskGroup {
                id: row.id,
                board_id: row.board_id,
                name: row.name,
                color: row.color,
                position: row.position,
                collapsed: row.collapsed,
                tenant_id: row.tenant_id,
                created_by_id: row.created_by_id,
                created_at: row.created_at,
                updated_at: row.updated_at,
                deleted_at: row.deleted_at,
            },
            task_count: row.task_count.unwrap_or(0),
            completed_count: row.completed_count.unwrap_or(0),
            estimated_hours: row.estimated_hours,
        })
        .collect())
}

/// Get a task group by ID
pub async fn get_task_group_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as!(
        TaskGroup,
        r#"
        SELECT id, board_id, name, color, position, collapsed,
               tenant_id, created_by_id, created_at, updated_at, deleted_at
        FROM task_groups
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}

/// Create a new task group
pub async fn create_task_group(
    pool: &PgPool,
    board_id: Uuid,
    name: &str,
    color: &str,
    position: &str,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<TaskGroup, sqlx::Error> {
    sqlx::query_as!(
        TaskGroup,
        r#"
        INSERT INTO task_groups (board_id, name, color, position, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, board_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
        board_id,
        name,
        color,
        position,
        tenant_id,
        created_by_id
    )
    .fetch_one(pool)
    .await
}

/// Update task group name
pub async fn update_task_group_name(
    pool: &PgPool,
    id: Uuid,
    name: &str,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as!(
        TaskGroup,
        r#"
        UPDATE task_groups
        SET name = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, board_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
        id,
        name
    )
    .fetch_optional(pool)
    .await
}

/// Update task group color
pub async fn update_task_group_color(
    pool: &PgPool,
    id: Uuid,
    color: &str,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as!(
        TaskGroup,
        r#"
        UPDATE task_groups
        SET color = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, board_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
        id,
        color
    )
    .fetch_optional(pool)
    .await
}

/// Update task group position (for reordering)
pub async fn update_task_group_position(
    pool: &PgPool,
    id: Uuid,
    position: &str,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as!(
        TaskGroup,
        r#"
        UPDATE task_groups
        SET position = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, board_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
        id,
        position
    )
    .fetch_optional(pool)
    .await
}

/// Toggle task group collapsed state
pub async fn toggle_task_group_collapse(
    pool: &PgPool,
    id: Uuid,
    collapsed: bool,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    sqlx::query_as!(
        TaskGroup,
        r#"
        UPDATE task_groups
        SET collapsed = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, board_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
        id,
        collapsed
    )
    .fetch_optional(pool)
    .await
}

/// Soft delete a task group (moves tasks to "Ungrouped")
pub async fn soft_delete_task_group(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TaskGroup>, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Move all tasks in this group to the "Ungrouped" group
    let board_id = sqlx::query_scalar!(
        r#"
        SELECT board_id FROM task_groups WHERE id = $1
        "#,
        id
    )
    .fetch_one(&mut *tx)
    .await?;

    let ungrouped_id = sqlx::query_scalar!(
        r#"
        SELECT id FROM task_groups
        WHERE board_id = $1 AND name = 'Ungrouped' AND deleted_at IS NULL
        "#,
        board_id
    )
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query!(
        r#"
        UPDATE tasks
        SET group_id = $2
        WHERE group_id = $1 AND deleted_at IS NULL
        "#,
        id,
        ungrouped_id
    )
    .execute(&mut *tx)
    .await?;

    // Soft delete the group
    let group = sqlx::query_as!(
        TaskGroup,
        r#"
        UPDATE task_groups
        SET deleted_at = NOW()
        WHERE id = $1
        RETURNING id, board_id, name, color, position, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        "#,
        id
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(group)
}
