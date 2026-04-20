//! Personal Work Board database queries
//!
//! Manages the user's personal kanban board state (backlog, today, in_progress, done).

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskPriority;

/// A personal board entry with task details
#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct PersonalBoardItem {
    pub id: Uuid,
    pub task_id: Uuid,
    pub column_name: String,
    pub position: i32,
    pub task_title: String,
    pub task_priority: TaskPriority,
    pub task_due_date: Option<DateTime<Utc>>,
    pub project_id: Uuid,
    pub project_name: String,
    pub status_name: Option<String>,
    pub status_type: Option<String>,
}

/// Full personal board response grouped by columns
#[derive(Debug, Serialize)]
pub struct PersonalBoardResponse {
    pub backlog: Vec<PersonalBoardItem>,
    pub today: Vec<PersonalBoardItem>,
    pub in_progress: Vec<PersonalBoardItem>,
    pub done: Vec<PersonalBoardItem>,
}

/// Get the user's personal board state
pub async fn get_personal_board(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<PersonalBoardResponse, sqlx::Error> {
    let items = sqlx::query_as::<_, PersonalBoardItem>(
        r"
        SELECT
            ptb.id,
            ptb.task_id,
            ptb.column_name,
            ptb.position,
            t.title AS task_title,
            t.priority AS task_priority,
            t.due_date AS task_due_date,
            t.project_id,
            p.name AS project_name,
            ps.name AS status_name,
            ps.type AS status_type
        FROM personal_task_board ptb
        INNER JOIN tasks t ON t.id = ptb.task_id AND t.deleted_at IS NULL
        INNER JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE ptb.user_id = $1
          AND t.parent_task_id IS NULL
        ORDER BY ptb.column_name, ptb.position
        ",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let mut response = PersonalBoardResponse {
        backlog: Vec::new(),
        today: Vec::new(),
        in_progress: Vec::new(),
        done: Vec::new(),
    };

    for item in items {
        match item.column_name.as_str() {
            "today" => response.today.push(item),
            "in_progress" => response.in_progress.push(item),
            "done" => response.done.push(item),
            _ => response.backlog.push(item),
        }
    }

    Ok(response)
}

/// Input for moving a task on the personal board
#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct MovePersonalTaskInput {
    pub column_name: String,
    pub position: i32,
}

/// Move a task to a column/position on the personal board (upsert)
pub async fn move_personal_task(
    pool: &PgPool,
    user_id: Uuid,
    task_id: Uuid,
    input: &MovePersonalTaskInput,
) -> Result<(), PersonalBoardError> {
    // Validate column name
    let valid_columns = ["backlog", "today", "in_progress", "done"];
    if !valid_columns.contains(&input.column_name.as_str()) {
        return Err(PersonalBoardError::InvalidColumn(input.column_name.clone()));
    }

    // Verify task exists and user has access (is assigned or is project member)
    let has_access = sqlx::query_scalar::<_, bool>(
        r"
        SELECT EXISTS(
            SELECT 1 FROM tasks t
            INNER JOIN projects p ON p.id = t.project_id
            INNER JOIN workspaces w ON w.id = p.workspace_id
            WHERE t.id = $2 AND t.deleted_at IS NULL
              AND (
                  EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = t.project_id AND pm.user_id = $1)
                  OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $1)
                  OR (EXISTS (SELECT 1 FROM users u WHERE u.id = $1 AND u.role IN ('admin', 'super_admin') AND u.deleted_at IS NULL)
                      AND w.visibility != 'private')
              )
        )
        ",
    )
    .bind(user_id)
    .bind(task_id)
    .fetch_one(pool)
    .await
    .map_err(PersonalBoardError::Database)?;

    if !has_access {
        return Err(PersonalBoardError::TaskNotAccessible);
    }

    sqlx::query(
        r"
        INSERT INTO personal_task_board (user_id, task_id, column_name, position)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, task_id)
        DO UPDATE SET column_name = $3, position = $4, updated_at = NOW()
        ",
    )
    .bind(user_id)
    .bind(task_id)
    .bind(&input.column_name)
    .bind(input.position)
    .execute(pool)
    .await
    .map_err(PersonalBoardError::Database)?;

    Ok(())
}

/// Error type for personal board operations
#[derive(Debug, thiserror::Error)]
pub enum PersonalBoardError {
    #[error("Invalid column: {0}")]
    InvalidColumn(String),
    #[error("Task not accessible")]
    TaskNotAccessible,
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}
