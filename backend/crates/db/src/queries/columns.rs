//! Board column query functions

use sqlx::PgPool;
use uuid::Uuid;

use crate::models::BoardColumn;

/// List columns for a board ordered by position
pub async fn list_columns_by_board(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<BoardColumn>, sqlx::Error> {
    sqlx::query_as!(
        BoardColumn,
        r#"
        SELECT id, name, board_id, position, color, status_mapping, created_at
        FROM board_columns
        WHERE board_id = $1
        ORDER BY position ASC
        "#,
        board_id
    )
    .fetch_all(pool)
    .await
}

/// Add a new column to a board
pub async fn add_column(
    pool: &PgPool,
    board_id: Uuid,
    name: &str,
    color: Option<&str>,
    status_mapping: Option<serde_json::Value>,
    position: &str,
) -> Result<BoardColumn, sqlx::Error> {
    sqlx::query_as!(
        BoardColumn,
        r#"
        INSERT INTO board_columns (board_id, name, color, status_mapping, position)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, board_id, position, color, status_mapping, created_at
        "#,
        board_id,
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
) -> Result<Option<BoardColumn>, sqlx::Error> {
    sqlx::query_as!(
        BoardColumn,
        r#"
        UPDATE board_columns
        SET name = $2
        WHERE id = $1
        RETURNING id, name, board_id, position, color, status_mapping, created_at
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
) -> Result<Option<BoardColumn>, sqlx::Error> {
    sqlx::query_as!(
        BoardColumn,
        r#"
        UPDATE board_columns
        SET position = $2
        WHERE id = $1
        RETURNING id, name, board_id, position, color, status_mapping, created_at
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
) -> Result<Option<BoardColumn>, sqlx::Error> {
    sqlx::query_as!(
        BoardColumn,
        r#"
        UPDATE board_columns
        SET status_mapping = $2
        WHERE id = $1
        RETURNING id, name, board_id, position, color, status_mapping, created_at
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
) -> Result<Option<BoardColumn>, sqlx::Error> {
    sqlx::query_as!(
        BoardColumn,
        r#"
        UPDATE board_columns
        SET color = $2
        WHERE id = $1
        RETURNING id, name, board_id, position, color, status_mapping, created_at
        "#,
        id,
        color
    )
    .fetch_optional(pool)
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
        DELETE FROM board_columns
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
) -> Result<Option<BoardColumn>, sqlx::Error> {
    sqlx::query_as!(
        BoardColumn,
        r#"
        SELECT id, name, board_id, position, color, status_mapping, created_at
        FROM board_columns
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}

/// Force delete a column without checking for tasks.
/// Used internally when replacing default columns with template columns on a freshly created board.
pub async fn force_delete_column(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM board_columns
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
    board_id: Uuid,
    target_index: i32,
) -> Result<(Option<String>, Option<String>), sqlx::Error> {
    let columns = list_columns_by_board(pool, board_id).await?;

    let prev_pos = if target_index > 0 {
        columns.get((target_index - 1) as usize).map(|c| c.position.clone())
    } else {
        None
    };

    let next_pos = columns.get(target_index as usize).map(|c| c.position.clone());

    Ok((prev_pos, next_pos))
}
