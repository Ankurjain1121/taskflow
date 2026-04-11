//! Task ↔ Issue linking queries.
//!
//! Link a task to a related issue (or multiple). The relationship is
//! bidirectional — given a task_id you get its issues, given an issue_id you
//! get its tasks. Scope is enforced at the route level: both entities must
//! belong to the same project.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum TaskIssueLinkError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Task or issue not found")]
    NotFound,
    #[error("Task and issue must belong to the same project")]
    ProjectMismatch,
    #[error("Link already exists")]
    AlreadyExists,
}

/// An issue linked to a task, joined with reporter and status for display.
#[derive(Debug, Serialize, FromRow)]
pub struct LinkedIssueRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub issue_number: i32,
    pub title: String,
    pub status: String,
    pub severity: String,
    pub assignee_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub linked_at: DateTime<Utc>,
}

/// A task linked to an issue, joined with current status + assignee name.
#[derive(Debug, Serialize, FromRow)]
pub struct LinkedTaskRow {
    pub id: Uuid,
    pub project_id: Uuid,
    pub task_number: Option<i32>,
    pub title: String,
    pub status_name: Option<String>,
    pub status_type: Option<String>,
    pub priority: String,
    pub due_date: Option<DateTime<Utc>>,
    pub linked_at: DateTime<Utc>,
}

/// Create a link. Errors if the task and issue are in different projects,
/// or if the pair already exists.
pub async fn create_link(
    pool: &PgPool,
    task_id: Uuid,
    issue_id: Uuid,
    created_by_id: Uuid,
) -> Result<(), TaskIssueLinkError> {
    // Verify both exist and pull project ids in one round trip
    let row = sqlx::query_as::<_, (Option<Uuid>, Option<Uuid>)>(
        r"
        SELECT
            (SELECT project_id FROM tasks  WHERE id = $1 AND deleted_at IS NULL),
            (SELECT project_id FROM issues WHERE id = $2 AND deleted_at IS NULL)
        ",
    )
    .bind(task_id)
    .bind(issue_id)
    .fetch_one(pool)
    .await?;

    let (task_proj, issue_proj) = row;
    let task_proj = task_proj.ok_or(TaskIssueLinkError::NotFound)?;
    let issue_proj = issue_proj.ok_or(TaskIssueLinkError::NotFound)?;
    if task_proj != issue_proj {
        return Err(TaskIssueLinkError::ProjectMismatch);
    }

    let result = sqlx::query(
        r"
        INSERT INTO task_issues (task_id, issue_id, created_by_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (task_id, issue_id) DO NOTHING
        ",
    )
    .bind(task_id)
    .bind(issue_id)
    .bind(created_by_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(TaskIssueLinkError::AlreadyExists);
    }
    Ok(())
}

/// Delete a link. No-op if it doesn't exist.
pub async fn delete_link(
    pool: &PgPool,
    task_id: Uuid,
    issue_id: Uuid,
) -> Result<(), TaskIssueLinkError> {
    sqlx::query("DELETE FROM task_issues WHERE task_id = $1 AND issue_id = $2")
        .bind(task_id)
        .bind(issue_id)
        .execute(pool)
        .await?;
    Ok(())
}

/// List all issues linked to a task with enough detail to render in the UI.
pub async fn list_linked_issues(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<LinkedIssueRow>, sqlx::Error> {
    sqlx::query_as::<_, LinkedIssueRow>(
        r"
        SELECT
            i.id,
            i.project_id,
            i.issue_number,
            i.title,
            i.status::text AS status,
            i.severity::text AS severity,
            a.name AS assignee_name,
            i.created_at,
            ti.created_at AS linked_at
        FROM task_issues ti
        JOIN issues i ON i.id = ti.issue_id AND i.deleted_at IS NULL
        LEFT JOIN users a ON a.id = i.assignee_id
        WHERE ti.task_id = $1
        ORDER BY ti.created_at DESC
        ",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
}

/// List all tasks linked to an issue with enough detail to render in the UI.
pub async fn list_linked_tasks(
    pool: &PgPool,
    issue_id: Uuid,
) -> Result<Vec<LinkedTaskRow>, sqlx::Error> {
    sqlx::query_as::<_, LinkedTaskRow>(
        r"
        SELECT
            t.id,
            t.project_id,
            t.task_number,
            t.title,
            ps.name AS status_name,
            ps.type AS status_type,
            t.priority::text AS priority,
            t.due_date,
            ti.created_at AS linked_at
        FROM task_issues ti
        JOIN tasks t ON t.id = ti.task_id AND t.deleted_at IS NULL
        LEFT JOIN project_statuses ps ON ps.id = t.status_id
        WHERE ti.issue_id = $1
        ORDER BY ti.created_at DESC
        ",
    )
    .bind(issue_id)
    .fetch_all(pool)
    .await
}
