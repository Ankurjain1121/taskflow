//! Board query functions

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{Board, BoardColumn, BoardMember, BoardMemberRole, TaskPriority};

/// List boards in a workspace that the user has access to
pub async fn list_boards_by_workspace(
    pool: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<Board>, sqlx::Error> {
    sqlx::query_as!(
        Board,
        r#"
        SELECT b.id, b.name, b.description, b.slack_webhook_url, b.prefix,
               b.workspace_id, b.tenant_id, b.created_by_id,
               b.deleted_at, b.created_at, b.updated_at
        FROM boards b
        INNER JOIN board_members bm ON b.id = bm.board_id
        WHERE b.workspace_id = $1
          AND bm.user_id = $2
          AND b.deleted_at IS NULL
        ORDER BY b.created_at DESC
        "#,
        workspace_id,
        user_id
    )
    .fetch_all(pool)
    .await
}

/// Board with columns for detailed view
#[derive(serde::Serialize, Clone, Debug)]
pub struct BoardWithColumns {
    #[serde(flatten)]
    pub board: Board,
    pub columns: Vec<BoardColumn>,
}

/// Get a board by ID with its columns (verify membership)
pub async fn get_board_by_id(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<BoardWithColumns>, sqlx::Error> {
    // First verify membership and get board
    let board = sqlx::query_as!(
        Board,
        r#"
        SELECT b.id, b.name, b.description, b.slack_webhook_url, b.prefix,
               b.workspace_id, b.tenant_id, b.created_by_id,
               b.deleted_at, b.created_at, b.updated_at
        FROM boards b
        INNER JOIN board_members bm ON b.id = bm.board_id
        WHERE b.id = $1
          AND bm.user_id = $2
          AND b.deleted_at IS NULL
        "#,
        id,
        user_id
    )
    .fetch_optional(pool)
    .await?;

    match board {
        Some(b) => {
            let columns = sqlx::query_as!(
                BoardColumn,
                r#"
                SELECT id, name, board_id, position, color, status_mapping, wip_limit, icon, created_at
                FROM board_columns
                WHERE board_id = $1
                ORDER BY position ASC
                "#,
                id
            )
            .fetch_all(pool)
            .await?;

            Ok(Some(BoardWithColumns { board: b, columns }))
        }
        None => Ok(None),
    }
}

/// Create a new board with default columns
pub async fn create_board(
    pool: &PgPool,
    name: &str,
    description: Option<&str>,
    workspace_id: Uuid,
    tenant_id: Uuid,
    created_by_id: Uuid,
) -> Result<BoardWithColumns, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Create board
    let board = sqlx::query_as!(
        Board,
        r#"
        INSERT INTO boards (name, description, workspace_id, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                  created_by_id, deleted_at, created_at, updated_at
        "#,
        name,
        description,
        workspace_id,
        tenant_id,
        created_by_id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Create default columns
    let columns = vec![
        ("To Do", "a0", "#6366f1", None),
        ("In Progress", "a1", "#3b82f6", None),
        (
            "Done",
            "a2",
            "#22c55e",
            Some(serde_json::json!({"done": true})),
        ),
    ];

    let mut created_columns = Vec::new();
    for (col_name, pos, color, status_mapping) in columns {
        let col = sqlx::query_as!(
            BoardColumn,
            r#"
            INSERT INTO board_columns (name, board_id, position, color, status_mapping)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, board_id, position, color, status_mapping, wip_limit, icon, created_at
            "#,
            col_name,
            board.id,
            pos,
            color,
            status_mapping
        )
        .fetch_one(&mut *tx)
        .await?;
        created_columns.push(col);
    }

    // Add creator as board member with editor role
    sqlx::query!(
        r#"
        INSERT INTO board_members (board_id, user_id, role)
        VALUES ($1, $2, 'editor')
        "#,
        board.id,
        created_by_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(BoardWithColumns {
        board,
        columns: created_columns,
    })
}

/// Update board name and description
pub async fn update_board(
    pool: &PgPool,
    id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<Option<Board>, sqlx::Error> {
    sqlx::query_as!(
        Board,
        r#"
        UPDATE boards
        SET name = $2, description = $3
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING id, name, description, slack_webhook_url, prefix, workspace_id, tenant_id,
                  created_by_id, deleted_at, created_at, updated_at
        "#,
        id,
        name,
        description
    )
    .fetch_optional(pool)
    .await
}

/// Soft-delete a board
pub async fn soft_delete_board(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE boards
        SET deleted_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
        id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Add a user to a board
pub async fn add_board_member(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    role: BoardMemberRole,
) -> Result<BoardMember, sqlx::Error> {
    sqlx::query_as!(
        BoardMember,
        r#"
        INSERT INTO board_members (board_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (board_id, user_id) DO UPDATE SET role = $3
        RETURNING id, board_id, user_id, role AS "role: _", joined_at
        "#,
        board_id,
        user_id,
        role as BoardMemberRole
    )
    .fetch_one(pool)
    .await
}

/// Update a board member's role
pub async fn update_board_member_role(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
    role: BoardMemberRole,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        r#"
        UPDATE board_members
        SET role = $3
        WHERE board_id = $1 AND user_id = $2
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .bind(role)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Remove a user from a board
pub async fn remove_board_member(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM board_members
        WHERE board_id = $1 AND user_id = $2
        "#,
        board_id,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Board member with user info
#[derive(sqlx::FromRow, serde::Serialize, Clone, Debug)]
pub struct BoardMemberWithUser {
    pub id: Uuid,
    pub board_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
}

/// List all members of a board with user info
pub async fn list_board_members(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<BoardMemberWithUser>, sqlx::Error> {
    sqlx::query_as::<_, BoardMemberWithUser>(
        r#"
        SELECT bm.id, bm.board_id, bm.user_id, bm.role,
               bm.joined_at, u.name, u.email, u.avatar_url
        FROM board_members bm
        INNER JOIN users u ON bm.user_id = u.id
        WHERE bm.board_id = $1
          AND u.deleted_at IS NULL
        ORDER BY bm.joined_at ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await
}

/// Check if a user is a member of a board
pub async fn is_board_member(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) AS "exists!"
        "#,
        board_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(result)
}

/// Get board member role
pub async fn get_board_member_role(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Option<BoardMemberRole>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT role AS "role: BoardMemberRole"
        FROM board_members
        WHERE board_id = $1 AND user_id = $2
        "#,
        board_id,
        user_id
    )
    .fetch_optional(pool)
    .await
}

/// Get board without membership check (for internal use)
pub async fn get_board_internal(pool: &PgPool, id: Uuid) -> Result<Option<Board>, sqlx::Error> {
    sqlx::query_as!(
        Board,
        r#"
        SELECT id, name, description, slack_webhook_url, prefix,
               workspace_id, tenant_id, created_by_id,
               deleted_at, created_at, updated_at
        FROM boards
        WHERE id = $1
          AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_optional(pool)
    .await
}

// ============================================================================
// Board Full (batch) query types and functions
// ============================================================================

/// A task row enriched with badge counts for the board full response
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TaskWithBadgesRow {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<DateTime<Utc>>,
    pub column_id: Uuid,
    pub position: String,
    pub group_id: Option<Uuid>,
    pub milestone_id: Option<Uuid>,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub subtask_total: i64,
    pub subtask_completed: i64,
    pub has_running_timer: bool,
    pub comment_count: i64,
}

/// Assignee info returned for a board's tasks
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BoardTaskAssignee {
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

/// Label info returned for a board's tasks
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BoardTaskLabel {
    pub task_id: Uuid,
    pub label_id: Uuid,
    pub name: String,
    pub color: String,
}

/// Fetch all tasks for a board with badge counts (subtasks, timers, comments)
/// in a single query using LEFT JOINs and subqueries.
pub async fn list_board_tasks_with_badges(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<TaskWithBadgesRow>, sqlx::Error> {
    sqlx::query_as::<_, TaskWithBadgesRow>(
        r#"
        SELECT
            t.id,
            t.title,
            t.description,
            t.priority,
            t.due_date,
            t.column_id,
            t.position,
            t.group_id,
            t.milestone_id,
            t.created_by_id,
            t.created_at,
            t.updated_at,
            COALESCE(sub.total, 0) AS "subtask_total",
            COALESCE(sub.completed, 0) AS "subtask_completed",
            COALESCE(tmr.has_running, false) AS "has_running_timer",
            COALESCE(cmt.cnt, 0) AS "comment_count"
        FROM tasks t
        LEFT JOIN LATERAL (
            SELECT
                COUNT(*)::bigint AS total,
                COUNT(*) FILTER (WHERE s.is_completed)::bigint AS completed
            FROM subtasks s
            WHERE s.task_id = t.id
        ) sub ON true
        LEFT JOIN LATERAL (
            SELECT EXISTS(
                SELECT 1 FROM time_entries te
                WHERE te.task_id = t.id AND te.is_running = true
            ) AS has_running
        ) tmr ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::bigint AS cnt
            FROM comments c
            WHERE c.task_id = t.id AND c.deleted_at IS NULL
        ) cmt ON true
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
        ORDER BY t.position ASC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await
}

/// Fetch all assignees for tasks in a board
pub async fn list_board_task_assignees(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<BoardTaskAssignee>, sqlx::Error> {
    sqlx::query_as::<_, BoardTaskAssignee>(
        r#"
        SELECT
            ta.task_id,
            ta.user_id,
            u.name AS display_name,
            u.avatar_url
        FROM task_assignees ta
        JOIN tasks t ON t.id = ta.task_id
        JOIN users u ON u.id = ta.user_id
        WHERE t.board_id = $1
          AND t.deleted_at IS NULL
          AND u.deleted_at IS NULL
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await
}

/// Fetch all labels for tasks in a board
pub async fn list_board_task_labels(
    pool: &PgPool,
    board_id: Uuid,
) -> Result<Vec<BoardTaskLabel>, sqlx::Error> {
    sqlx::query_as::<_, BoardTaskLabel>(
        r#"
        SELECT
            tl.task_id,
            l.id AS label_id,
            l.name,
            l.color
        FROM task_labels tl
        JOIN labels l ON l.id = tl.label_id
        JOIN tasks t ON t.id = tl.task_id
        WHERE t.board_id = $1
          AND t.deleted_at IS NULL
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await
}
