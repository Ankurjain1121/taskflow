use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::models::TimeEntry;

/// Error type for time entry query operations
#[derive(Debug, thiserror::Error)]
pub enum TimeEntryQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Time entry not found")]
    NotFound,
    #[error("Not a board member")]
    NotBoardMember,
    #[error("A timer is already running")]
    AlreadyRunning,
    #[error("Not the owner of this time entry")]
    NotOwner,
}

/// Input for starting a timer
#[derive(Debug, Deserialize)]
pub struct StartTimerInput {
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
}

/// Input for creating a manual time entry
#[derive(Debug, Deserialize)]
pub struct ManualEntryInput {
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: DateTime<Utc>,
    pub duration_minutes: i32,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
}

/// Input for updating a time entry
#[derive(Debug, Deserialize)]
pub struct UpdateEntryInput {
    pub description: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
}

/// Aggregated time report per task
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct TaskTimeReport {
    pub task_id: Uuid,
    pub task_title: String,
    pub total_minutes: i64,
    pub entries_count: i64,
}

/// Time entry with associated task title
#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct TimeEntryWithTask {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub is_running: bool,
    pub board_id: Uuid,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub task_title: String,
}

/// List all time entries for a task (verifies board membership)
pub async fn list_task_time_entries(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<TimeEntry>, TimeEntryQueryError> {
    // Verify board membership via task's board_id
    let board_id = sqlx::query_scalar::<_, Uuid>(
        r#"SELECT board_id FROM tasks WHERE id = $1 AND deleted_at IS NULL"#,
    )
    .bind(task_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TimeEntryQueryError::NotFound)?;

    let is_member = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)"#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    let entries = sqlx::query_as::<_, TimeEntry>(
        r#"
        SELECT
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, board_id, tenant_id,
            created_at, updated_at
        FROM time_entries
        WHERE task_id = $1
        ORDER BY started_at DESC
        "#,
    )
    .bind(task_id)
    .fetch_all(pool)
    .await?;

    Ok(entries)
}

/// Start a timer for a task. Stops any running timer for this user first.
pub async fn start_timer(
    pool: &PgPool,
    input: StartTimerInput,
) -> Result<TimeEntry, TimeEntryQueryError> {
    // Verify board membership
    let is_member = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)"#,
    )
    .bind(input.board_id)
    .bind(input.user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    // Stop any currently running timer for this user
    sqlx::query(
        r#"
        UPDATE time_entries
        SET
            ended_at = NOW(),
            duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at))::int / 60,
            is_running = false,
            updated_at = NOW()
        WHERE user_id = $1 AND is_running = true
        "#,
    )
    .bind(input.user_id)
    .execute(pool)
    .await?;

    // Create new running timer
    let id = Uuid::new_v4();
    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        INSERT INTO time_entries (id, task_id, user_id, description, started_at, is_running, board_id, tenant_id)
        VALUES ($1, $2, $3, $4, NOW(), true, $5, $6)
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, board_id, tenant_id,
            created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(input.task_id)
    .bind(input.user_id)
    .bind(&input.description)
    .bind(input.board_id)
    .bind(input.tenant_id)
    .fetch_one(pool)
    .await?;

    Ok(entry)
}

/// Stop a running timer
pub async fn stop_timer(
    pool: &PgPool,
    entry_id: Uuid,
    user_id: Uuid,
) -> Result<TimeEntry, TimeEntryQueryError> {
    // Verify ownership
    let owner_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT user_id FROM time_entries WHERE id = $1"#)
            .bind(entry_id)
            .fetch_optional(pool)
            .await?
            .ok_or(TimeEntryQueryError::NotFound)?;

    if owner_id != user_id {
        return Err(TimeEntryQueryError::NotOwner);
    }

    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        UPDATE time_entries
        SET
            ended_at = NOW(),
            duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at))::int / 60,
            is_running = false,
            updated_at = NOW()
        WHERE id = $1 AND is_running = true
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, board_id, tenant_id,
            created_at, updated_at
        "#,
    )
    .bind(entry_id)
    .fetch_optional(pool)
    .await?
    .ok_or(TimeEntryQueryError::NotFound)?;

    Ok(entry)
}

/// Create a manual time entry (for logging time retroactively)
pub async fn create_manual_entry(
    pool: &PgPool,
    input: ManualEntryInput,
) -> Result<TimeEntry, TimeEntryQueryError> {
    // Verify board membership
    let is_member = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)"#,
    )
    .bind(input.board_id)
    .bind(input.user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    let id = Uuid::new_v4();
    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        INSERT INTO time_entries (id, task_id, user_id, description, started_at, ended_at, duration_minutes, is_running, board_id, tenant_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9)
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, board_id, tenant_id,
            created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(input.task_id)
    .bind(input.user_id)
    .bind(&input.description)
    .bind(input.started_at)
    .bind(input.ended_at)
    .bind(input.duration_minutes)
    .bind(input.board_id)
    .bind(input.tenant_id)
    .fetch_one(pool)
    .await?;

    Ok(entry)
}

/// Update a time entry
pub async fn update_entry(
    pool: &PgPool,
    id: Uuid,
    input: UpdateEntryInput,
    user_id: Uuid,
) -> Result<TimeEntry, TimeEntryQueryError> {
    // Verify ownership
    let owner_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT user_id FROM time_entries WHERE id = $1"#)
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or(TimeEntryQueryError::NotFound)?;

    if owner_id != user_id {
        return Err(TimeEntryQueryError::NotOwner);
    }

    let entry = sqlx::query_as::<_, TimeEntry>(
        r#"
        UPDATE time_entries
        SET
            description = COALESCE($2, description),
            started_at = COALESCE($3, started_at),
            ended_at = COALESCE($4, ended_at),
            duration_minutes = COALESCE($5, duration_minutes),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
            id, task_id, user_id, description, started_at, ended_at,
            duration_minutes, is_running, board_id, tenant_id,
            created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&input.description)
    .bind(input.started_at)
    .bind(input.ended_at)
    .bind(input.duration_minutes)
    .fetch_optional(pool)
    .await?
    .ok_or(TimeEntryQueryError::NotFound)?;

    Ok(entry)
}

/// Delete a time entry
pub async fn delete_entry(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
) -> Result<(), TimeEntryQueryError> {
    // Verify ownership
    let owner_id =
        sqlx::query_scalar::<_, Uuid>(r#"SELECT user_id FROM time_entries WHERE id = $1"#)
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or(TimeEntryQueryError::NotFound)?;

    if owner_id != user_id {
        return Err(TimeEntryQueryError::NotOwner);
    }

    let rows_affected = sqlx::query(r#"DELETE FROM time_entries WHERE id = $1"#)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();

    if rows_affected == 0 {
        return Err(TimeEntryQueryError::NotFound);
    }

    Ok(())
}

/// Get aggregated time report for a board
pub async fn get_board_time_report(
    pool: &PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<TaskTimeReport>, TimeEntryQueryError> {
    // Verify board membership
    let is_member = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2)"#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(TimeEntryQueryError::NotBoardMember);
    }

    let report = sqlx::query_as::<_, TaskTimeReport>(
        r#"
        SELECT
            t.id as task_id,
            t.title as task_title,
            COALESCE(SUM(te.duration_minutes)::bigint, 0) as total_minutes,
            COUNT(te.id)::bigint as entries_count
        FROM tasks t
        LEFT JOIN time_entries te ON te.task_id = t.id
        WHERE t.board_id = $1 AND t.deleted_at IS NULL
            AND (te.id IS NOT NULL)
        GROUP BY t.id, t.title
        ORDER BY total_minutes DESC
        "#,
    )
    .bind(board_id)
    .fetch_all(pool)
    .await?;

    Ok(report)
}

/// Get the currently running timer for a user (with task info)
pub async fn get_running_timer(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<TimeEntryWithTask>, TimeEntryQueryError> {
    let entry = sqlx::query_as::<_, TimeEntryWithTask>(
        r#"
        SELECT
            te.id, te.task_id, te.user_id, te.description, te.started_at, te.ended_at,
            te.duration_minutes, te.is_running, te.board_id, te.tenant_id,
            te.created_at, te.updated_at,
            t.title as task_title
        FROM time_entries te
        JOIN tasks t ON t.id = te.task_id
        WHERE te.user_id = $1 AND te.is_running = true
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(entry)
}
