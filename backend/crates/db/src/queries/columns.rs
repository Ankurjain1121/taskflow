//! Project column query functions

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ProjectColumn;

/// List columns for a project ordered by position
pub async fn list_columns_by_board(
    pool: &PgPool,
    project_id: Uuid,
) -> Result<Vec<ProjectColumn>, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        SELECT id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        FROM project_columns
        WHERE project_id = $1
        ORDER BY position ASC
        "#,
        project_id
    )
    .fetch_all(pool)
    .await
}

/// Add a new column to a project
pub async fn add_column(
    pool: &PgPool,
    project_id: Uuid,
    name: &str,
    color: Option<&str>,
    status_mapping: Option<serde_json::Value>,
    position: &str,
) -> Result<ProjectColumn, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        INSERT INTO project_columns (project_id, name, color, status_mapping, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        "#,
        project_id,
        name,
        color,
        status_mapping,
        position
    )
    .fetch_one(pool)
    .await
}

/// Rename a column
pub async fn rename_column(
    pool: &PgPool,
    id: Uuid,
    name: &str,
) -> Result<Option<ProjectColumn>, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        UPDATE project_columns
        SET name = $2
        WHERE id = $1
        RETURNING id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        "#,
        id,
        name
    )
    .fetch_optional(pool)
    .await
}

/// Update column position (reorder)
pub async fn reorder_column(
    pool: &PgPool,
    id: Uuid,
    new_position: &str,
) -> Result<Option<ProjectColumn>, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        UPDATE project_columns
        SET position = $2
        WHERE id = $1
        RETURNING id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        "#,
        id,
        new_position
    )
    .fetch_optional(pool)
    .await
}

/// Update column status mapping
pub async fn update_status_mapping(
    pool: &PgPool,
    id: Uuid,
    status_mapping: Option<serde_json::Value>,
) -> Result<Option<ProjectColumn>, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        UPDATE project_columns
        SET status_mapping = $2
        WHERE id = $1
        RETURNING id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        "#,
        id,
        status_mapping
    )
    .fetch_optional(pool)
    .await
}

/// Update column color
pub async fn update_column_color(
    pool: &PgPool,
    id: Uuid,
    color: Option<&str>,
) -> Result<Option<ProjectColumn>, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        UPDATE project_columns
        SET color = $2
        WHERE id = $1
        RETURNING id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        "#,
        id,
        color
    )
    .fetch_optional(pool)
    .await
}

/// Update column WIP limit
pub async fn update_wip_limit(
    pool: &PgPool,
    id: Uuid,
    wip_limit: Option<i32>,
) -> Result<Option<ProjectColumn>, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        UPDATE project_columns
        SET wip_limit = $2
        WHERE id = $1
        RETURNING id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        "#,
        id,
        wip_limit
    )
    .fetch_optional(pool)
    .await
}

/// Update column icon
pub async fn update_icon(
    pool: &PgPool,
    column_id: Uuid,
    icon: Option<&str>,
) -> Result<ProjectColumn, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        UPDATE project_columns
        SET icon = $2
        WHERE id = $1
        RETURNING id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        "#,
        column_id,
        icon,
    )
    .fetch_one(pool)
    .await
}

/// Check if column has tasks
pub async fn column_has_tasks(pool: &PgPool, column_id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM tasks
            WHERE column_id = $1
              AND deleted_at IS NULL
        ) AS "exists!"
        "#,
        column_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Delete a column (fails if tasks exist)
pub async fn delete_column(pool: &PgPool, id: Uuid) -> Result<DeleteColumnResult, sqlx::Error> {
    // First check if column has tasks
    let has_tasks = column_has_tasks(pool, id).await?;
    if has_tasks {
        return Ok(DeleteColumnResult::HasTasks);
    }

    let result = sqlx::query!(
        r#"
        DELETE FROM project_columns
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() > 0 {
        Ok(DeleteColumnResult::Deleted)
    } else {
        Ok(DeleteColumnResult::NotFound)
    }
}

/// Result of column deletion attempt
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeleteColumnResult {
    Deleted,
    NotFound,
    HasTasks,
}

/// Get column by ID
pub async fn get_column_by_id(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<ProjectColumn>, sqlx::Error> {
    sqlx::query_as!(
        ProjectColumn,
        r#"
        SELECT id, name, project_id, position, color, status_mapping, wip_limit, icon, created_at
        FROM project_columns
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}

/// Force delete a column without checking for tasks.
/// Used internally when replacing default columns with template columns on a freshly created project.
pub async fn force_delete_column(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM project_columns
        WHERE id = $1
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Get adjacent columns for position calculation
pub async fn get_adjacent_columns(
    pool: &PgPool,
    project_id: Uuid,
    target_index: i32,
) -> Result<(Option<String>, Option<String>), sqlx::Error> {
    let columns = list_columns_by_board(pool, project_id).await?;

    let prev_pos = if target_index > 0 {
        columns
            .get((target_index - 1) as usize)
            .map(|c| c.position.clone())
    } else {
        None
    };

    let next_pos = columns
        .get(target_index as usize)
        .map(|c| c.position.clone());

    Ok((prev_pos, next_pos))
}
