use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskReminder;

use super::tasks::TaskQueryError;

/// Reminder info for API responses
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReminderInfo {
    pub id: Uuid,
    pub task_id: Uuid,
    pub remind_before_minutes: i32,
    pub is_sent: bool,
    pub created_at: DateTime<Utc>,
}

/// Pending reminder with task/user info for the deadline scanner
#[derive(Debug, sqlx::FromRow)]
pub struct PendingReminder {
    pub id: Uuid,
    pub task_id: Uuid,
    pub task_title: String,
    pub project_id: Uuid,
    pub project_name: String,
    pub user_id: Uuid,
    pub due_date: DateTime<Utc>,
    pub remind_before_minutes: i32,
}

/// Set (upsert) a reminder for the current user on a task
pub async fn set_reminder(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
    remind_before_minutes: i32,
) -> Result<TaskReminder, TaskQueryError> {
    let reminder = sqlx::query_as::<_, TaskReminder>(
        r"
        INSERT INTO task_reminders (id, task_id, user_id, remind_before_minutes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (task_id, user_id, remind_before_minutes)
        DO UPDATE SET is_sent = FALSE, sent_at = NULL
        RETURNING id, task_id, user_id, remind_before_minutes, is_sent, sent_at, created_at
        ",
    )
    .bind(Uuid::new_v4())
    .bind(task_id)
    .bind(user_id)
    .bind(remind_before_minutes)
    .fetch_one(pool)
    .await?;

    Ok(reminder)
}

/// Remove a specific reminder
pub async fn remove_reminder(
    pool: &PgPool,
    reminder_id: Uuid,
    user_id: Uuid,
) -> Result<(), TaskQueryError> {
    let rows_affected = sqlx::query(
        r"
        DELETE FROM task_reminders
        WHERE id = $1 AND user_id = $2
        ",
    )
    .bind(reminder_id)
    .bind(user_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(TaskQueryError::NotFound);
    }

    Ok(())
}

/// List reminders for a task for a specific user
pub async fn list_reminders_for_task(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<ReminderInfo>, sqlx::Error> {
    sqlx::query_as::<_, ReminderInfo>(
        r"
        SELECT id, task_id, remind_before_minutes, is_sent, created_at
        FROM task_reminders
        WHERE task_id = $1 AND user_id = $2
        ORDER BY remind_before_minutes ASC
        ",
    )
    .bind(task_id)
    .bind(user_id)
    .fetch_all(pool)
    .await
}

/// Get pending reminders that should fire now
/// A reminder is pending when: due_date - remind_before_minutes <= now AND is_sent = FALSE
pub async fn get_pending_reminders(
    pool: &PgPool,
    now: DateTime<Utc>,
) -> Result<Vec<PendingReminder>, sqlx::Error> {
    sqlx::query_as::<_, PendingReminder>(
        r"
        SELECT
            tr.id,
            tr.task_id,
            t.title as task_title,
            t.project_id,
            p.name as project_name,
            tr.user_id,
            t.due_date,
            tr.remind_before_minutes
        FROM task_reminders tr
        JOIN tasks t ON t.id = tr.task_id
        JOIN projects p ON p.id = t.project_id AND p.deleted_at IS NULL
        WHERE tr.is_sent = FALSE
          AND t.due_date IS NOT NULL
          AND t.deleted_at IS NULL
          AND t.due_date - (tr.remind_before_minutes || ' minutes')::interval <= $1
          AND t.due_date > $1
          AND NOT EXISTS (
              SELECT 1 FROM project_statuses ps
              WHERE ps.id = t.status_id
              AND ps.type = 'done'
          )
        ORDER BY t.due_date ASC
        LIMIT 500
        ",
    )
    .bind(now)
    .fetch_all(pool)
    .await
}

/// Mark a reminder as sent
pub async fn mark_reminder_sent(pool: &PgPool, reminder_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r"
        UPDATE task_reminders
        SET is_sent = TRUE, sent_at = NOW()
        WHERE id = $1
        ",
    )
    .bind(reminder_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Reset all reminders for a task (when due_date changes)
pub async fn reset_reminders_for_task(pool: &PgPool, task_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query(
        r"
        UPDATE task_reminders
        SET is_sent = FALSE, sent_at = NULL
        WHERE task_id = $1
        ",
    )
    .bind(task_id)
    .execute(pool)
    .await?;

    Ok(())
}
