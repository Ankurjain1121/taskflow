//! Deadline scanner job
//!
//! Scans for tasks approaching deadlines and tasks that are overdue.
//! Designed to be triggered hourly via cron endpoint.

use chrono::{Duration, Utc};
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::notifications::events::NotificationEvent;
use crate::notifications::service::NotificationService;
use crate::novu::NovuClient;

/// Error type for deadline scanner operations
#[derive(Debug, thiserror::Error)]
pub enum DeadlineScannerError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Notification error: {0}")]
    Notification(#[from] crate::notifications::service::NotificationServiceError),
}

/// Result of a deadline scan
#[derive(Debug, Serialize)]
pub struct DeadlineScanResult {
    pub due_soon_count: usize,
    pub overdue_count: usize,
    pub notifications_sent: usize,
    pub errors: usize,
}

/// Task due info for processing
#[derive(Debug)]
struct TaskDueInfo {
    task_id: Uuid,
    task_title: String,
    board_id: Uuid,
    board_name: String,
    due_date: chrono::DateTime<Utc>,
    assignee_id: Uuid,
}

/// Scan for approaching deadlines and overdue tasks
///
/// This function:
/// 1. Finds tasks due within 24 hours (TASK_DUE_SOON)
/// 2. Finds overdue tasks not in "done" columns (TASK_OVERDUE)
/// 3. Creates in-app notifications for assignees
/// 4. Triggers Novu events for multi-channel delivery
///
/// Deduplication is handled by checking if a notification already exists
/// for the same task/user/event_type within the last 24 hours.
pub async fn scan_deadlines(
    pool: &PgPool,
    notification_service: &NotificationService,
    novu_client: Option<&NovuClient>,
    app_url: &str,
) -> Result<DeadlineScanResult, DeadlineScannerError> {
    let now = Utc::now();
    let in_24_hours = now + Duration::hours(24);

    let mut result = DeadlineScanResult {
        due_soon_count: 0,
        overdue_count: 0,
        notifications_sent: 0,
        errors: 0,
    };

    // Process in batches of 100
    let batch_size = 100i64;
    let mut offset = 0i64;

    // --- Task Due Soon (within 24 hours) ---
    loop {
        let tasks_due_soon: Vec<TaskDueInfo> = sqlx::query_as!(
            TaskDueInfo,
            r#"
            SELECT
                t.id as task_id,
                t.title as task_title,
                t.board_id,
                b.name as board_name,
                t.due_date as "due_date!",
                ta.user_id as assignee_id
            FROM tasks t
            JOIN boards b ON b.id = t.board_id
            JOIN task_assignees ta ON ta.task_id = t.id
            WHERE t.due_date > $1
              AND t.due_date <= $2
              AND t.deleted_at IS NULL
              -- Exclude tasks in done columns
              AND NOT EXISTS (
                  SELECT 1 FROM board_columns bc
                  WHERE bc.id = t.column_id
                  AND (bc.status_mapping->>'done')::boolean = true
              )
              -- Dedup: no due-soon notification in last 24h
              AND NOT EXISTS (
                  SELECT 1 FROM notifications n
                  WHERE n.recipient_id = ta.user_id
                    AND n.event_type = 'task-due-soon'
                    AND n.link_url LIKE '%' || t.id::text || '%'
                    AND n.created_at > $1 - interval '24 hours'
              )
            ORDER BY t.due_date ASC
            LIMIT $3 OFFSET $4
            "#,
            now,
            in_24_hours,
            batch_size,
            offset
        )
        .fetch_all(pool)
        .await?;

        if tasks_due_soon.is_empty() {
            break;
        }

        result.due_soon_count += tasks_due_soon.len();

        for task in tasks_due_soon {
            let hours_until_due = (task.due_date - now).num_hours();
            let link_url = format!("{}/boards/{}/tasks/{}", app_url, task.board_id, task.task_id);
            let body = format!(
                "Task \"{}\" on board \"{}\" is due in {} hours",
                task.task_title, task.board_name, hours_until_due
            );

            match notification_service
                .create_notification(
                    task.assignee_id,
                    NotificationEvent::TaskDueSoon,
                    NotificationEvent::TaskDueSoon.title(),
                    &body,
                    Some(&link_url),
                )
                .await
            {
                Ok(_) => {
                    result.notifications_sent += 1;

                    // Trigger Novu event
                    if let Some(novu) = novu_client {
                        let payload = serde_json::json!({
                            "task_id": task.task_id,
                            "task_title": task.task_title,
                            "board_id": task.board_id,
                            "board_name": task.board_name,
                            "due_date": task.due_date.to_rfc3339(),
                            "hours_until_due": hours_until_due,
                            "link_url": link_url
                        });
                        novu.trigger_event(
                            NotificationEvent::TaskDueSoon.name(),
                            &task.assignee_id.to_string(),
                            payload,
                        )
                        .await;
                    }
                }
                Err(e) => {
                    tracing::error!(
                        task_id = %task.task_id,
                        assignee_id = %task.assignee_id,
                        error = %e,
                        "Failed to create due-soon notification"
                    );
                    result.errors += 1;
                }
            }
        }

        offset += batch_size;
    }

    // --- Task Overdue ---
    offset = 0;
    loop {
        let tasks_overdue: Vec<TaskDueInfo> = sqlx::query_as!(
            TaskDueInfo,
            r#"
            SELECT
                t.id as task_id,
                t.title as task_title,
                t.board_id,
                b.name as board_name,
                t.due_date as "due_date!",
                ta.user_id as assignee_id
            FROM tasks t
            JOIN boards b ON b.id = t.board_id
            JOIN task_assignees ta ON ta.task_id = t.id
            WHERE t.due_date < $1
              AND t.deleted_at IS NULL
              -- Exclude tasks in done columns
              AND NOT EXISTS (
                  SELECT 1 FROM board_columns bc
                  WHERE bc.id = t.column_id
                  AND (bc.status_mapping->>'done')::boolean = true
              )
              -- Dedup: no overdue notification in last 24h
              AND NOT EXISTS (
                  SELECT 1 FROM notifications n
                  WHERE n.recipient_id = ta.user_id
                    AND n.event_type = 'task-overdue'
                    AND n.link_url LIKE '%' || t.id::text || '%'
                    AND n.created_at > $1 - interval '24 hours'
              )
            ORDER BY t.due_date ASC
            LIMIT $2 OFFSET $3
            "#,
            now,
            batch_size,
            offset
        )
        .fetch_all(pool)
        .await?;

        if tasks_overdue.is_empty() {
            break;
        }

        result.overdue_count += tasks_overdue.len();

        for task in tasks_overdue {
            let days_overdue = (now - task.due_date).num_days();
            let link_url = format!("{}/boards/{}/tasks/{}", app_url, task.board_id, task.task_id);
            let body = format!(
                "Task \"{}\" on board \"{}\" is {} day(s) overdue",
                task.task_title,
                task.board_name,
                days_overdue.max(1)
            );

            match notification_service
                .create_notification(
                    task.assignee_id,
                    NotificationEvent::TaskOverdue,
                    NotificationEvent::TaskOverdue.title(),
                    &body,
                    Some(&link_url),
                )
                .await
            {
                Ok(_) => {
                    result.notifications_sent += 1;

                    // Trigger Novu event
                    if let Some(novu) = novu_client {
                        let payload = serde_json::json!({
                            "task_id": task.task_id,
                            "task_title": task.task_title,
                            "board_id": task.board_id,
                            "board_name": task.board_name,
                            "due_date": task.due_date.to_rfc3339(),
                            "days_overdue": days_overdue,
                            "link_url": link_url
                        });
                        novu.trigger_event(
                            NotificationEvent::TaskOverdue.name(),
                            &task.assignee_id.to_string(),
                            payload,
                        )
                        .await;
                    }
                }
                Err(e) => {
                    tracing::error!(
                        task_id = %task.task_id,
                        assignee_id = %task.assignee_id,
                        error = %e,
                        "Failed to create overdue notification"
                    );
                    result.errors += 1;
                }
            }
        }

        offset += batch_size;
    }

    tracing::info!(
        due_soon = result.due_soon_count,
        overdue = result.overdue_count,
        notifications = result.notifications_sent,
        errors = result.errors,
        "Deadline scan completed"
    );

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deadline_scan_result_serialize() {
        let result = DeadlineScanResult {
            due_soon_count: 5,
            overdue_count: 3,
            notifications_sent: 8,
            errors: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"due_soon_count\":5"));
    }
}
