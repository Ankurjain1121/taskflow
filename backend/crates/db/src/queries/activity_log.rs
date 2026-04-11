//! Activity log database queries
//!
//! Provides queries for reading activity log entries with cursor-based pagination.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::ActivityAction;

/// Activity log entry with actor information for API responses
#[derive(Debug, sqlx::FromRow, Serialize, Clone)]
pub struct ActivityLogWithActor {
    pub id: Uuid,
    pub action: ActivityAction,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub user_id: Uuid,
    pub metadata: Option<serde_json::Value>,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub actor_name: String,
    pub actor_avatar_url: Option<String>,
}

/// Paginated response for activity log entries
#[derive(Debug, Serialize)]
pub struct PaginatedActivityLog {
    pub items: Vec<ActivityLogWithActor>,
    pub next_cursor: Option<String>,
}

/// List activity log entries for a task with cursor-based pagination
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `task_id` - The task's UUID (entity_id where entity_type = 'task')
/// * `cursor` - Optional cursor (activity log entry ID) for pagination
/// * `limit` - Number of entries to return (default 20, max 50)
///
/// Returns entries ordered by created_at DESC (newest first)
pub async fn list_activity_by_task(
    pool: &PgPool,
    task_id: Uuid,
    cursor: Option<Uuid>,
    limit: i64,
) -> Result<PaginatedActivityLog, sqlx::Error> {
    // Clamp limit to max 50
    let limit = limit.clamp(1, 50);
    // Fetch one extra to determine if there are more results
    let fetch_limit = limit + 1;

    let items = if let Some(cursor_id) = cursor {
        // Get the created_at of the cursor entry to use for pagination
        let cursor_created_at: Option<DateTime<Utc>> = sqlx::query_scalar(
            r"
            SELECT created_at FROM activity_log WHERE id = $1
            ",
        )
        .bind(cursor_id)
        .fetch_optional(pool)
        .await?;

        if let Some(cursor_time) = cursor_created_at {
            sqlx::query_as::<_, ActivityLogWithActor>(
                r"
                SELECT
                    al.id,
                    al.action,
                    al.entity_type,
                    al.entity_id,
                    al.user_id,
                    al.metadata,
                    al.tenant_id,
                    al.created_at,
                    u.name as actor_name,
                    u.avatar_url as actor_avatar_url
                FROM activity_log al
                JOIN users u ON u.id = al.user_id
                WHERE al.entity_type = 'task'
                  AND al.entity_id = $1
                  AND (al.created_at, al.id) < ($2, $3)
                ORDER BY al.created_at DESC, al.id DESC
                LIMIT $4
                ",
            )
            .bind(task_id)
            .bind(cursor_time)
            .bind(cursor_id)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await?
        } else {
            // Invalid cursor, return first page
            sqlx::query_as::<_, ActivityLogWithActor>(
                r"
                SELECT
                    al.id,
                    al.action,
                    al.entity_type,
                    al.entity_id,
                    al.user_id,
                    al.metadata,
                    al.tenant_id,
                    al.created_at,
                    u.name as actor_name,
                    u.avatar_url as actor_avatar_url
                FROM activity_log al
                JOIN users u ON u.id = al.user_id
                WHERE al.entity_type = 'task' AND al.entity_id = $1
                ORDER BY al.created_at DESC, al.id DESC
                LIMIT $2
                ",
            )
            .bind(task_id)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await?
        }
    } else {
        sqlx::query_as::<_, ActivityLogWithActor>(
            r"
            SELECT
                al.id,
                al.action,
                al.entity_type,
                al.entity_id,
                al.user_id,
                al.metadata,
                al.tenant_id,
                al.created_at,
                u.name as actor_name,
                u.avatar_url as actor_avatar_url
            FROM activity_log al
            JOIN users u ON u.id = al.user_id
            WHERE al.entity_type = 'task' AND al.entity_id = $1
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT $2
            ",
        )
        .bind(task_id)
        .bind(fetch_limit)
        .fetch_all(pool)
        .await?
    };

    // Determine if there are more results
    let has_more = items.len() > limit as usize;
    let items: Vec<_> = items.into_iter().take(limit as usize).collect();

    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedActivityLog { items, next_cursor })
}

/// List activity log entries for a project with cursor-based pagination
///
/// Returns activity for:
/// - Tasks belonging to the project (entity_type = 'task', entity_id IN project tasks)
/// - The project itself (entity_type = 'board', entity_id = project_id)
/// - Statuses in the project (entity_type = 'column')
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `board_id` - The project/board UUID
/// * `cursor` - Optional cursor (activity log entry ID) for pagination
/// * `limit` - Number of entries to return (default 50, max 100)
///
/// Returns entries ordered by created_at DESC (newest first)
pub async fn list_activity_by_project(
    pool: &PgPool,
    board_id: Uuid,
    cursor: Option<Uuid>,
    limit: i64,
) -> Result<PaginatedActivityLog, sqlx::Error> {
    let limit = limit.clamp(1, 100);
    let fetch_limit = limit + 1;

    let base_query = r"
        SELECT
            al.id,
            al.action,
            al.entity_type,
            al.entity_id,
            al.user_id,
            al.metadata,
            al.tenant_id,
            al.created_at,
            u.name as actor_name,
            u.avatar_url as actor_avatar_url
        FROM activity_log al
        JOIN users u ON u.id = al.user_id
        WHERE (
            (al.entity_type = 'task' AND al.entity_id IN (
                SELECT id FROM tasks WHERE project_id = $1 AND deleted_at IS NULL
            ))
            OR (al.entity_type = 'board' AND al.entity_id = $1)
            OR (al.entity_type = 'column' AND al.entity_id IN (
                SELECT id FROM project_statuses WHERE project_id = $1
            ))
        )
    ";

    let items = if let Some(cursor_id) = cursor {
        let cursor_created_at: Option<DateTime<Utc>> =
            sqlx::query_scalar("SELECT created_at FROM activity_log WHERE id = $1")
                .bind(cursor_id)
                .fetch_optional(pool)
                .await?;

        if let Some(cursor_time) = cursor_created_at {
            let query = format!(
                "{} AND (al.created_at, al.id) < ($2, $3) ORDER BY al.created_at DESC, al.id DESC LIMIT $4",
                base_query
            );
            sqlx::query_as::<_, ActivityLogWithActor>(&query)
                .bind(board_id)
                .bind(cursor_time)
                .bind(cursor_id)
                .bind(fetch_limit)
                .fetch_all(pool)
                .await?
        } else {
            let query = format!(
                "{} ORDER BY al.created_at DESC, al.id DESC LIMIT $2",
                base_query
            );
            sqlx::query_as::<_, ActivityLogWithActor>(&query)
                .bind(board_id)
                .bind(fetch_limit)
                .fetch_all(pool)
                .await?
        }
    } else {
        let query = format!(
            "{} ORDER BY al.created_at DESC, al.id DESC LIMIT $2",
            base_query
        );
        sqlx::query_as::<_, ActivityLogWithActor>(&query)
            .bind(board_id)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await?
    };

    let has_more = items.len() > limit as usize;
    let items: Vec<_> = items.into_iter().take(limit as usize).collect();

    let next_cursor = if has_more {
        items.last().map(|item| item.id.to_string())
    } else {
        None
    };

    Ok(PaginatedActivityLog { items, next_cursor })
}

/// Record a new activity log entry
///
/// This is a low-level function. Prefer using ActivityLogService convenience methods.
pub async fn insert_activity_log(
    pool: &PgPool,
    task_id: Uuid,
    actor_id: Uuid,
    action: ActivityAction,
    metadata: Option<serde_json::Value>,
    tenant_id: Uuid,
) -> Result<ActivityLogWithActor, sqlx::Error> {
    let entry_id = Uuid::new_v4();

    let entry = sqlx::query_as::<_, ActivityLogWithActor>(
        r"
        WITH inserted AS (
            INSERT INTO activity_log (id, action, entity_type, entity_id, user_id, metadata, tenant_id)
            VALUES ($1, $2, 'task', $3, $4, $5, $6)
            RETURNING id, action, entity_type, entity_id, user_id, metadata, tenant_id, created_at
        )
        SELECT
            i.id,
            i.action,
            i.entity_type,
            i.entity_id,
            i.user_id,
            i.metadata,
            i.tenant_id,
            i.created_at,
            u.name as actor_name,
            u.avatar_url as actor_avatar_url
        FROM inserted i
        JOIN users u ON u.id = i.user_id
        ",
    )
    .bind(entry_id)
    .bind(action as ActivityAction)
    .bind(task_id)
    .bind(actor_id)
    .bind(metadata)
    .bind(tenant_id)
    .fetch_one(pool)
    .await?;

    Ok(entry)
}

/// A single status transition entry for the task Status Timeline view.
///
/// Produced by `list_task_status_timeline`. Status names come directly from
/// the activity log's metadata JSONB (`from_status`, `to_status`). Colors are
/// resolved by LEFT JOINing `project_statuses` on `(project_id, name)` so
/// renamed or deleted statuses simply return `NULL` for color.
#[derive(Debug, sqlx::FromRow, Serialize, Clone)]
pub struct StatusTimelineEntry {
    pub id: Uuid,
    pub task_id: Uuid,
    pub actor_id: Uuid,
    pub actor_name: Option<String>,
    pub actor_avatar_url: Option<String>,
    pub from_status_name: Option<String>,
    pub from_status_color: Option<String>,
    pub to_status_name: Option<String>,
    pub to_status_color: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// List every `status_changed` activity entry for a task in chronological order.
///
/// Returns an empty vector if no status changes have been recorded.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `task_id` - The task's UUID (entity_id where entity_type = 'task')
///
/// Caller is responsible for authorizing the request (project membership).
pub async fn list_task_status_timeline(
    pool: &PgPool,
    task_id: Uuid,
) -> Result<Vec<StatusTimelineEntry>, sqlx::Error> {
    let rows = sqlx::query_as::<_, StatusTimelineEntry>(
        r"
        SELECT
            al.id,
            al.entity_id AS task_id,
            al.user_id AS actor_id,
            u.name AS actor_name,
            u.avatar_url AS actor_avatar_url,
            (al.metadata ->> 'from_status') AS from_status_name,
            ps_from.color AS from_status_color,
            (al.metadata ->> 'to_status') AS to_status_name,
            ps_to.color AS to_status_color,
            al.created_at
        FROM activity_log al
        JOIN users u ON u.id = al.user_id
        JOIN tasks t ON t.id = al.entity_id
        LEFT JOIN project_statuses ps_from
          ON ps_from.project_id = t.project_id
         AND ps_from.name = (al.metadata ->> 'from_status')
        LEFT JOIN project_statuses ps_to
          ON ps_to.project_id = t.project_id
         AND ps_to.name = (al.metadata ->> 'to_status')
        WHERE al.entity_type = 'task'
          AND al.entity_id = $1
          AND al.action = $2
        ORDER BY al.created_at ASC, al.id ASC
        ",
    )
    .bind(task_id)
    .bind(ActivityAction::StatusChanged)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paginated_response_serializes() {
        let response = PaginatedActivityLog {
            items: vec![],
            next_cursor: Some("test-cursor".to_string()),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("next_cursor"));
    }

    #[test]
    fn test_status_timeline_entry_serializes() {
        let entry = StatusTimelineEntry {
            id: Uuid::nil(),
            task_id: Uuid::nil(),
            actor_id: Uuid::nil(),
            actor_name: Some("Alice".to_string()),
            actor_avatar_url: None,
            from_status_name: Some("Open".to_string()),
            from_status_color: Some("#6B7280".to_string()),
            to_status_name: Some("In Progress".to_string()),
            to_status_color: Some("#3B82F6".to_string()),
            created_at: Utc::now(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("from_status_name"));
        assert!(json.contains("to_status_color"));
    }
}
