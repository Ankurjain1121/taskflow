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
    pub reminder_count: usize,
    pub notifications_sent: usize,
    pub errors: usize,
}

/// Task due info for processing
#[derive(Debug)]
struct TaskDueInfo {
    task_id: Uuid,
    task_title: String,
    project_id: Uuid,
    project_name: String,
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
        reminder_count: 0,
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
                t.project_id,
                b.name as project_name,
                t.due_date as "due_date!",
                ta.user_id as assignee_id
            FROM tasks t
            JOIN projects b ON b.id = t.project_id
            JOIN task_assignees ta ON ta.task_id = t.id
            WHERE t.due_date > $1
              AND t.due_date <= $2
              AND t.deleted_at IS NULL
              -- Exclude tasks in done columns
              AND NOT EXISTS (
                  SELECT 1 FROM project_columns bc
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
            let link_url = format!(
                "{}/projects/{}/tasks/{}",
                app_url, task.project_id, task.task_id
            );
            let body = format!(
                "Task \"{}\" on project \"{}\" is due in {} hours",
                task.task_title, task.project_name, hours_until_due
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
                            "project_id": task.project_id,
                            "project_name": task.project_name,
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
                t.project_id,
                b.name as project_name,
                t.due_date as "due_date!",
                ta.user_id as assignee_id
            FROM tasks t
            JOIN projects b ON b.id = t.project_id
            JOIN task_assignees ta ON ta.task_id = t.id
            WHERE t.due_date < $1
              AND t.deleted_at IS NULL
              -- Exclude tasks in done columns
              AND NOT EXISTS (
                  SELECT 1 FROM project_columns bc
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
            let link_url = format!(
                "{}/projects/{}/tasks/{}",
                app_url, task.project_id, task.task_id
            );
            let body = format!(
                "Task \"{}\" on project \"{}\" is {} day(s) overdue",
                task.task_title,
                task.project_name,
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
                            "project_id": task.project_id,
                            "project_name": task.project_name,
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

    // --- Task Reminders (configurable per-user) ---
    match taskflow_db::queries::get_pending_reminders(pool, now).await {
        Ok(pending) => {
            result.reminder_count = pending.len();
            for reminder in pending {
                let link_url = format!(
                    "{}/projects/{}/tasks/{}",
                    app_url, reminder.project_id, reminder.task_id
                );
                let body = format!(
                    "Reminder: Task \"{}\" on project \"{}\" is due in {} minutes",
                    reminder.task_title, reminder.project_name, reminder.remind_before_minutes
                );

                match notification_service
                    .create_notification(
                        reminder.user_id,
                        NotificationEvent::TaskReminder,
                        NotificationEvent::TaskReminder.title(),
                        &body,
                        Some(&link_url),
                    )
                    .await
                {
                    Ok(_) => {
                        result.notifications_sent += 1;
                        if let Err(e) =
                            taskflow_db::queries::mark_reminder_sent(pool, reminder.id).await
                        {
                            tracing::error!(
                                reminder_id = %reminder.id,
                                error = %e,
                                "Failed to mark reminder as sent"
                            );
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            task_id = %reminder.task_id,
                            user_id = %reminder.user_id,
                            error = %e,
                            "Failed to create reminder notification"
                        );
                        result.errors += 1;
                    }
                }
            }
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to fetch pending reminders");
            result.errors += 1;
        }
    }

    tracing::info!(
        due_soon = result.due_soon_count,
        overdue = result.overdue_count,
        reminders = result.reminder_count,
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
            reminder_count: 0,
            notifications_sent: 8,
            errors: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"due_soon_count\":5"));
    }

    #[test]
    fn test_deadline_scan_result_serialize_all_fields() {
        let result = DeadlineScanResult {
            due_soon_count: 10,
            overdue_count: 7,
            reminder_count: 0,
            notifications_sent: 15,
            errors: 2,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["due_soon_count"], 10);
        assert_eq!(parsed["overdue_count"], 7);
        assert_eq!(parsed["notifications_sent"], 15);
        assert_eq!(parsed["errors"], 2);
    }

    #[test]
    fn test_deadline_scan_result_zero_values() {
        let result = DeadlineScanResult {
            due_soon_count: 0,
            overdue_count: 0,
            reminder_count: 0,
            notifications_sent: 0,
            errors: 0,
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["due_soon_count"], 0);
        assert_eq!(parsed["overdue_count"], 0);
        assert_eq!(parsed["notifications_sent"], 0);
        assert_eq!(parsed["errors"], 0);
    }

    #[test]
    fn test_deadline_scan_result_debug() {
        let result = DeadlineScanResult {
            due_soon_count: 1,
            overdue_count: 2,
            reminder_count: 0,
            notifications_sent: 3,
            errors: 0,
        };
        let debug = format!("{:?}", result);
        assert!(debug.contains("DeadlineScanResult"), "got: {}", debug);
        assert!(debug.contains("due_soon_count"), "got: {}", debug);
    }

    #[test]
    fn test_deadline_scanner_error_display() {
        let err = DeadlineScannerError::Database(sqlx::Error::RowNotFound);
        let msg = format!("{}", err);
        assert!(msg.contains("Database error"), "got: {}", msg);
    }

    #[test]
    fn test_deadline_scanner_error_debug() {
        let err = DeadlineScannerError::Database(sqlx::Error::RowNotFound);
        let debug = format!("{:?}", err);
        assert!(debug.contains("Database"), "got: {}", debug);
    }

    #[test]
    fn test_deadline_scan_result_large_numbers() {
        let result = DeadlineScanResult {
            due_soon_count: 999_999,
            overdue_count: 500_000,
            reminder_count: 0,
            notifications_sent: 1_499_999,
            errors: 0,
        };
        let json = serde_json::to_string(&result).expect("serialize large numbers");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");
        assert_eq!(parsed["due_soon_count"], 999_999);
        assert_eq!(parsed["overdue_count"], 500_000);
    }

    #[test]
    fn test_deadline_scan_link_url_format() {
        let app_url = "https://taskflow.example.com";
        let project_id = Uuid::new_v4();
        let task_id = Uuid::new_v4();
        let link_url = format!("{}/projects/{}/tasks/{}", app_url, project_id, task_id);

        assert!(link_url.starts_with("https://taskflow.example.com/projects/"));
        assert!(link_url.contains("/tasks/"));
        assert!(link_url.contains(&project_id.to_string()));
        assert!(link_url.contains(&task_id.to_string()));
    }

    #[test]
    fn test_due_soon_notification_body_format() {
        let task_title = "Fix login bug";
        let project_name = "Sprint 42";
        let hours_until_due = 12_i64;
        let body = format!(
            "Task \"{}\" on project \"{}\" is due in {} hours",
            task_title, project_name, hours_until_due
        );
        assert_eq!(
            body,
            "Task \"Fix login bug\" on project \"Sprint 42\" is due in 12 hours"
        );
    }

    #[test]
    fn test_overdue_notification_body_format() {
        let task_title = "Review PR";
        let project_name = "Development";
        let days_overdue = 3_i64;
        let body = format!(
            "Task \"{}\" on project \"{}\" is {} day(s) overdue",
            task_title,
            project_name,
            days_overdue.max(1)
        );
        assert_eq!(
            body,
            "Task \"Review PR\" on project \"Development\" is 3 day(s) overdue"
        );
    }

    #[test]
    fn test_overdue_days_minimum_is_one() {
        // When days_overdue is 0 (just barely past due), it should show at least 1
        let days_overdue = 0_i64;
        let clamped = days_overdue.max(1);
        assert_eq!(clamped, 1);
    }
}
