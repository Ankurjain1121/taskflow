use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::TaskWatcher;

use super::tasks::TaskQueryError;

/// Watcher info returned with task details
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WatcherInfo {
    pub user_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub watched_at: DateTime<Utc>,
}

/// Add a watcher to a task
pub async fn add_watcher(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<TaskWatcher, TaskQueryError> {
    let watcher = sqlx::query_as::<_, TaskWatcher>(
        r"
        INSERT INTO task_watchers (id, task_id, user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (task_id, user_id) DO UPDATE SET watched_at = task_watchers.watched_at
        RETURNING id, task_id, user_id, watched_at
        ",
    )
    .bind(Uuid::new_v4())
    .bind(task_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(watcher)
}

/// Remove a watcher from a task
pub async fn remove_watcher(
    pool: &PgPool,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<(), TaskQueryError> {
    let rows_affected = sqlx::query(
        r"
        DELETE FROM task_watchers
        WHERE task_id = $1 AND user_id = $2
        ",
    )
    .bind(task_id)
    .bind(user_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(TaskQueryError::NotFound);
    }

    Ok(())
}

/// Get watcher IDs for a task
pub async fn get_task_watcher_ids(pool: &PgPool, task_id: Uuid) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        r"
        SELECT user_id FROM task_watchers WHERE task_id = $1
        ",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
}

/// Get watcher info (with user details) for a task
pub async fn get_watcher_info(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<WatcherInfo>, sqlx::Error> {
    sqlx::query_as::<_, WatcherInfo>(
        r"
        SELECT
            tw.user_id,
            u.name,
            u.avatar_url,
            tw.watched_at
        FROM task_watchers tw
        JOIN users u ON u.id = tw.user_id
        WHERE tw.task_id = $1
        ",
    )
    .bind(task_id)
    .fetch_all(pool)
    .await
}
