//! Task list query functions (formerly task groups)

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::task_group::{TaskList, TaskListWithStats};

/// List task lists for a project ordered by position
pub async fn list_task_groups_by_board(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<TaskList>, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        SELECT id, project_id, name, color, position, is_default, collapsed,
               tenant_id, created_by_id, created_at, updated_at, deleted_at
        FROM task_lists
        WHERE project_id = $1 AND deleted_at IS NULL
        ORDER BY position ASC
        ",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}

/// Alias
pub async fn list_task_lists_by_project(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<TaskList>, sqlx::Error> {
    list_task_groups_by_board(pool, project_id).await
}

/// Get the default task list for a project
pub async fn get_default_task_list(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Option<TaskList>, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        SELECT id, project_id, name, color, position, is_default, collapsed,
               tenant_id, created_by_id, created_at, updated_at, deleted_at
        FROM task_lists
        WHERE project_id = $1 AND is_default = true
        LIMIT 1
        ",
    )
    .bind(project_id)
    .fetch_optional(pool)
    .await
}

/// List task lists with statistics (task count, completion, estimated hours)
pub async fn list_task_groups_with_stats(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<TaskListWithStats>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id: Uuid,
        project_id: Uuid,
        name: String,
        color: Option<String>,
        position: String,
        is_default: bool,
        collapsed: Option<bool>,
        tenant_id: Uuid,
        created_by_id: Uuid,
        created_at: Option<chrono::DateTime<chrono::Utc>>,
        updated_at: Option<chrono::DateTime<chrono::Utc>>,
        deleted_at: Option<chrono::DateTime<chrono::Utc>>,
        task_count: Option<i64>,
        completed_count: Option<i64>,
        estimated_hours: Option<f64>,
    }

    let rows: Vec<Row> = sqlx::query_as::<_, Row>(
        r"
        SELECT
            tl.id, tl.project_id, tl.name, tl.color, tl.position, tl.is_default, tl.collapsed,
            tl.tenant_id, tl.created_by_id, tl.created_at, tl.updated_at, tl.deleted_at,
            COUNT(t.id) as task_count,
            COUNT(CASE WHEN ps.type = 'done' THEN 1 END) as completed_count,
            SUM(t.estimated_hours) as estimated_hours
        FROM task_lists tl
        LEFT JOIN tasks t ON t.task_list_id = tl.id AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
        LEFT JOIN project_statuses ps ON t.status_id = ps.id
        WHERE tl.project_id = $1 AND tl.deleted_at IS NULL
        GROUP BY tl.id
        ORDER BY tl.position ASC
        ",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|row| TaskListWithStats {
            list: TaskList {
                id: row.id,
                project_id: row.project_id,
                name: row.name,
                color: row.color,
                position: row.position,
                is_default: row.is_default,
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

/// Get a task list by ID
pub async fn get_task_group_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TaskList>, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        SELECT id, project_id, name, color, position, is_default, collapsed,
               tenant_id, created_by_id, created_at, updated_at, deleted_at
        FROM task_lists
        WHERE id = $1 AND deleted_at IS NULL
        ",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

/// Create a new task list
pub async fn create_task_group(
    pool: &PgPool,
    project_id: Uuid,
    name: &str,
    color: &str,
    position: &str,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<TaskList, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        INSERT INTO task_lists (project_id, name, color, position, is_default, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, false, $5, $6)
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(project_id)
    .bind(name)
    .bind(color)
    .bind(position)
    .bind(tenant_id)
    .bind(created_by_id)
    .fetch_one(pool)
    .await
}

/// Update task list name
pub async fn update_task_group_name(
    pool: &PgPool,
    id: Uuid,
    name: &str,
) -> Result<Option<TaskList>, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        UPDATE task_lists
        SET name = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(id)
    .bind(name)
    .fetch_optional(pool)
    .await
}

/// Update task list color
pub async fn update_task_group_color(
    pool: &PgPool,
    id: Uuid,
    color: &str,
) -> Result<Option<TaskList>, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        UPDATE task_lists
        SET color = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(id)
    .bind(color)
    .fetch_optional(pool)
    .await
}

/// Update task list position (for reordering)
pub async fn update_task_group_position(
    pool: &PgPool,
    id: Uuid,
    position: &str,
) -> Result<Option<TaskList>, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        UPDATE task_lists
        SET position = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(id)
    .bind(position)
    .fetch_optional(pool)
    .await
}

/// Toggle task list collapsed state
pub async fn toggle_task_group_collapse(
    pool: &PgPool,
    id: Uuid,
    collapsed: bool,
) -> Result<Option<TaskList>, sqlx::Error> {
    sqlx::query_as::<_, TaskList>(
        r"
        UPDATE task_lists
        SET collapsed = $2, updated_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(id)
    .bind(collapsed)
    .fetch_optional(pool)
    .await
}

/// Soft delete a task list (moves tasks to the default task list)
pub async fn soft_delete_task_group(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<TaskList>, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Get the project_id
    let project_id: Uuid =
        sqlx::query_scalar::<_, Uuid>("SELECT project_id FROM task_lists WHERE id = $1")
            .bind(id)
            .fetch_one(&mut *tx)
            .await?;

    // Find the default task list
    let default_id: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM task_lists WHERE project_id = $1 AND is_default = true AND id != $2 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(project_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(default_list_id) = default_id {
        sqlx::query(
            "UPDATE tasks SET task_list_id = $2 WHERE task_list_id = $1 AND deleted_at IS NULL",
        )
        .bind(id)
        .bind(default_list_id)
        .execute(&mut *tx)
        .await?;
    }

    // Soft delete the list
    let list = sqlx::query_as::<_, TaskList>(
        r"
        UPDATE task_lists
        SET deleted_at = NOW()
        WHERE id = $1
        RETURNING id, project_id, name, color, position, is_default, collapsed,
                  tenant_id, created_by_id, created_at, updated_at, deleted_at
        ",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(list)
}
