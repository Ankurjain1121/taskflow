use sqlx::PgConnection;
use uuid::Uuid;

use crate::models::Label;

/// List all labels for a board.
pub async fn list_labels_by_board(
    conn: &mut PgConnection,
    board_id: Uuid,
) -> Result<Vec<Label>, sqlx::Error> {
    sqlx::query_as::<_, Label>(
        "SELECT id, name, color, board_id \
         FROM labels \
         WHERE board_id = $1 \
         ORDER BY name ASC",
    )
    .bind(board_id)
    .fetch_all(&mut *conn)
    .await
}

/// Backwards-compatible alias.
pub async fn list_labels_by_project(
    conn: &mut PgConnection,
    board_id: Uuid,
) -> Result<Vec<Label>, sqlx::Error> {
    list_labels_by_board(conn, board_id).await
}

/// Create a new label in a board.
pub async fn create_label(
    conn: &mut PgConnection,
    board_id: Uuid,
    name: &str,
    color: &str,
) -> Result<Label, sqlx::Error> {
    sqlx::query_as::<_, Label>(
        "INSERT INTO labels (board_id, name, color) \
         VALUES ($1, $2, $3) \
         RETURNING id, name, color, board_id",
    )
    .bind(board_id)
    .bind(name)
    .bind(color)
    .fetch_one(&mut *conn)
    .await
}

/// Update a label's name and/or color.
pub async fn update_label(
    conn: &mut PgConnection,
    label_id: Uuid,
    name: Option<&str>,
    color: Option<&str>,
) -> Result<Label, sqlx::Error> {
    sqlx::query_as::<_, Label>(
        "UPDATE labels SET \
            name = COALESCE($2, name), \
            color = COALESCE($3, color) \
         WHERE id = $1 \
         RETURNING id, name, color, board_id",
    )
    .bind(label_id)
    .bind(name)
    .bind(color)
    .fetch_one(&mut *conn)
    .await
}

/// Delete a label by ID.
pub async fn delete_label(
    conn: &mut PgConnection,
    label_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM labels WHERE id = $1")
        .bind(label_id)
        .execute(&mut *conn)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Add a label to a task (insert into task_labels junction table).
pub async fn add_label_to_task(
    conn: &mut PgConnection,
    task_id: Uuid,
    label_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO task_labels (task_id, label_id) \
         VALUES ($1, $2) \
         ON CONFLICT (task_id, label_id) DO NOTHING",
    )
    .bind(task_id)
    .bind(label_id)
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// Remove a label from a task.
pub async fn remove_label_from_task(
    conn: &mut PgConnection,
    task_id: Uuid,
    label_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM task_labels WHERE task_id = $1 AND label_id = $2")
        .bind(task_id)
        .bind(label_id)
        .execute(&mut *conn)
        .await?;
    Ok(())
}
