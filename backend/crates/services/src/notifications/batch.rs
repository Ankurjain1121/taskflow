//! Smart notification batching using Redis
//!
//! Accumulates notifications per user in Redis Hashes with a 60s TTL.
//! A periodic flush task reads all pending batches and either:
//! - Sends a single email for 1 notification
//! - Sends a merged digest email for >1 notifications
//! - Skips if 0 notifications

use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::notifications::email::PostalClient;

/// Error type for batch operations
#[derive(Debug, thiserror::Error)]
pub enum BatchError {
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Email error: {0}")]
    Email(#[from] crate::notifications::email::EmailError),
}

/// A notification payload stored in the batch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPayload {
    pub event_type: String,
    pub title: String,
    pub body: String,
    pub link_url: Option<String>,
}

/// Result of a batch flush cycle
#[derive(Debug, Serialize)]
pub struct BatchFlushResult {
    pub users_flushed: usize,
    pub emails_sent: usize,
    pub errors: usize,
}

/// Redis key prefix for notification batches
const BATCH_KEY_PREFIX: &str = "taskbolt:batch:";

/// TTL for batch keys in seconds
const BATCH_TTL_SECONDS: u64 = 60;

/// Accumulate a notification into a user's batch
///
/// Uses `HSET` to add the notification and `EXPIRE` to set/reset the TTL.
pub async fn accumulate(
    redis: &mut redis::aio::ConnectionManager,
    user_id: Uuid,
    notification_id: Uuid,
    payload: &NotificationPayload,
) -> Result<(), BatchError> {
    let key = format!("{}{}", BATCH_KEY_PREFIX, user_id);
    let json = serde_json::to_string(payload)?;

    redis
        .hset::<_, _, _, ()>(&key, notification_id.to_string(), json)
        .await?;
    redis
        .expire::<_, ()>(&key, BATCH_TTL_SECONDS as i64)
        .await?;

    tracing::debug!(
        user_id = %user_id,
        notification_id = %notification_id,
        "Notification accumulated in batch"
    );

    Ok(())
}

/// Flush all notifications for a single user
///
/// Uses HGETALL + DEL in a Redis pipeline (atomic) to prevent race conditions.
/// Returns the list of payloads that were in the batch.
pub async fn flush_user_batch(
    redis: &mut redis::aio::ConnectionManager,
    user_id: Uuid,
) -> Result<Vec<NotificationPayload>, BatchError> {
    let key = format!("{}{}", BATCH_KEY_PREFIX, user_id);

    // Use a pipeline for atomic HGETALL + DEL
    let mut pipe = redis::pipe();
    pipe.atomic()
        .cmd("HGETALL").arg(&key)
        .cmd("DEL").arg(&key);

    let results: (HashMap<String, String>, ()) = pipe.query_async(redis).await?;
    let entries = results.0;

    let mut payloads = Vec::with_capacity(entries.len());
    for (_notif_id, json) in entries {
        match serde_json::from_str::<NotificationPayload>(&json) {
            Ok(p) => payloads.push(p),
            Err(e) => {
                tracing::error!(
                    user_id = %user_id,
                    error = %e,
                    "Failed to deserialize batch notification payload"
                );
            }
        }
    }

    Ok(payloads)
}

/// Flush all pending batches across all users
///
/// Uses SCAN to find all `taskbolt:batch:*` keys, then flushes each.
pub async fn flush_all_pending(
    redis: &mut redis::aio::ConnectionManager,
) -> Result<HashMap<Uuid, Vec<NotificationPayload>>, BatchError> {
    let pattern = format!("{}*", BATCH_KEY_PREFIX);
    let mut keys: Vec<String> = Vec::new();
    let mut cursor: u64 = 0;
    loop {
        let (new_cursor, batch): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(&pattern)
            .arg("COUNT")
            .arg(100)
            .query_async(redis)
            .await?;
        keys.extend(batch);
        cursor = new_cursor;
        if cursor == 0 {
            break;
        }
    }

    let mut results = HashMap::new();

    for key in keys {
        // Extract user_id from key: "taskbolt:batch:{uuid}"
        let user_id_str = key.trim_start_matches(BATCH_KEY_PREFIX);
        let user_id = match Uuid::parse_str(user_id_str) {
            Ok(id) => id,
            Err(e) => {
                tracing::error!(
                    key = %key,
                    error = %e,
                    "Invalid UUID in batch key, skipping"
                );
                continue;
            }
        };

        match flush_user_batch(redis, user_id).await {
            Ok(payloads) if !payloads.is_empty() => {
                results.insert(user_id, payloads);
            }
            Ok(_) => {} // empty, skip
            Err(e) => {
                tracing::error!(
                    user_id = %user_id,
                    error = %e,
                    "Failed to flush batch for user"
                );
            }
        }
    }

    Ok(results)
}

/// HTML-escape user-provided strings to prevent XSS in email clients
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Generate a merged digest HTML email from multiple notifications
fn generate_merged_email_html(payloads: &[NotificationPayload], app_url: &str) -> String {
    let items_html: String = payloads
        .iter()
        .map(|p| {
            let link = p
                .link_url
                .as_deref()
                .map(|url| {
                    let full_url = if url.starts_with("http") {
                        url.to_string()
                    } else {
                        format!("{}{}", app_url, url)
                    };
                    format!(
                        r#" <a href="{}" style="color: #4F46E5; text-decoration: none;">View</a>"#,
                        full_url
                    )
                })
                .unwrap_or_default();

            format!(
                r#"<tr>
                    <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
                        <div style="font-weight: 600; color: #111827;">{}</div>
                        <div style="color: #6b7280; font-size: 14px;">{}{}</div>
                    </td>
                </tr>"#,
                html_escape(&p.title), html_escape(&p.body), link
            )
        })
        .collect();

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 8px 0;">Notification Summary</h1>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">You have {} new notifications</p>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
            {}
        </table>
        <p style="text-align: center; margin-top: 24px;">
            <a href="{}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open TaskBolt</a>
        </p>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        <a href="{}/settings/notifications" style="color: #6366f1;">Manage your notification preferences</a>
    </p>
</body>
</html>"#,
        payloads.len(),
        items_html,
        app_url,
        app_url
    )
}

/// Run the batch flush cycle: flush all pending batches and send emails
///
/// - 0 notifications: skip
/// - 1 notification: send as individual email
/// - >1 notifications: send merged digest email
pub async fn run_flush_cycle(
    redis: &mut redis::aio::ConnectionManager,
    pool: &sqlx::PgPool,
    postal: &PostalClient,
    app_url: &str,
) -> Result<BatchFlushResult, BatchError> {
    let pending = flush_all_pending(redis).await?;

    let mut result = BatchFlushResult {
        users_flushed: pending.len(),
        emails_sent: 0,
        errors: 0,
    };

    for (user_id, payloads) in &pending {
        // Look up user email
        let user_email: Option<(String,)> = sqlx::query_as(
            r#"SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL"#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await
        .unwrap_or(None);

        let email = match user_email {
            Some((e,)) => e,
            None => {
                tracing::error!(user_id = %user_id, "User not found for batch flush");
                result.errors += 1;
                continue;
            }
        };

        let send_result = if payloads.len() == 1 {
            // Single notification — send as regular email
            let p = &payloads[0];
            let subject = format!("[TaskBolt] {}", p.title);
            let link_html = p
                .link_url
                .as_deref()
                .map(|url| {
                    let full_url = if url.starts_with("http") {
                        url.to_string()
                    } else {
                        format!("{}{}", app_url, url)
                    };
                    format!(
                        r#"<p><a href="{}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Details</a></p>"#,
                        full_url
                    )
                })
                .unwrap_or_default();

            let html = format!(
                r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">{}</h1>
        <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0;">{}</p>
        {}
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        <a href="{}/settings/notifications" style="color: #6366f1;">Manage your notification preferences</a>
    </p>
</body>
</html>"#,
                html_escape(&p.title), html_escape(&p.body), link_html, app_url
            );

            postal.send_email(&email, &subject, &html).await
        } else {
            // Multiple notifications — send merged digest
            let html = generate_merged_email_html(payloads, app_url);
            postal
                .send_email(
                    &email,
                    &format!("[TaskBolt] {} new notifications", payloads.len()),
                    &html,
                )
                .await
        };

        match send_result {
            Ok(()) => {
                result.emails_sent += 1;
                tracing::debug!(
                    user_id = %user_id,
                    notification_count = payloads.len(),
                    "Batch notification email sent"
                );
            }
            Err(e) => {
                tracing::error!(
                    user_id = %user_id,
                    error = %e,
                    "Failed to send batch notification email"
                );
                result.errors += 1;
            }
        }
    }

    if result.users_flushed > 0 {
        tracing::info!(
            users_flushed = result.users_flushed,
            emails_sent = result.emails_sent,
            errors = result.errors,
            "Batch flush cycle completed"
        );
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_payload_serde_roundtrip() {
        let payload = NotificationPayload {
            event_type: "task-assigned".to_string(),
            title: "Task Assigned".to_string(),
            body: "You were assigned to 'Fix bug'".to_string(),
            link_url: Some("/boards/123/tasks/456".to_string()),
        };
        let json = serde_json::to_string(&payload).expect("serialize");
        let deserialized: NotificationPayload =
            serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.event_type, "task-assigned");
        assert_eq!(deserialized.title, "Task Assigned");
        assert_eq!(
            deserialized.link_url.as_deref(),
            Some("/boards/123/tasks/456")
        );
    }

    #[test]
    fn test_notification_payload_without_link() {
        let payload = NotificationPayload {
            event_type: "task-completed".to_string(),
            title: "Task Completed".to_string(),
            body: "Your task was completed".to_string(),
            link_url: None,
        };
        let json = serde_json::to_string(&payload).expect("serialize");
        let deserialized: NotificationPayload =
            serde_json::from_str(&json).expect("deserialize");
        assert!(deserialized.link_url.is_none());
    }

    #[test]
    fn test_batch_flush_result_serialize() {
        let result = BatchFlushResult {
            users_flushed: 10,
            emails_sent: 8,
            errors: 1,
        };
        let json = serde_json::to_string(&result).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");
        assert_eq!(parsed["users_flushed"], 10);
        assert_eq!(parsed["emails_sent"], 8);
        assert_eq!(parsed["errors"], 1);
    }

    #[test]
    fn test_batch_key_prefix() {
        let user_id = Uuid::new_v4();
        let key = format!("{}{}", BATCH_KEY_PREFIX, user_id);
        assert!(key.starts_with("taskbolt:batch:"));
        assert!(key.contains(&user_id.to_string()));
    }

    #[test]
    fn test_batch_ttl_is_60_seconds() {
        assert_eq!(BATCH_TTL_SECONDS, 60);
    }

    #[test]
    fn test_merged_email_html_contains_count() {
        let payloads = vec![
            NotificationPayload {
                event_type: "task-assigned".to_string(),
                title: "Task Assigned".to_string(),
                body: "You were assigned to 'Fix bug'".to_string(),
                link_url: Some("/boards/1/tasks/2".to_string()),
            },
            NotificationPayload {
                event_type: "task-commented".to_string(),
                title: "New Comment".to_string(),
                body: "Someone commented on your task".to_string(),
                link_url: None,
            },
        ];
        let html = generate_merged_email_html(&payloads, "https://app.test.com");
        assert!(html.contains("2 new notifications"));
        assert!(html.contains("Task Assigned"));
        assert!(html.contains("New Comment"));
        assert!(html.contains("https://app.test.com"));
    }

    #[test]
    fn test_merged_email_html_with_links() {
        let payloads = vec![NotificationPayload {
            event_type: "task-assigned".to_string(),
            title: "Task Assigned".to_string(),
            body: "Assigned to you".to_string(),
            link_url: Some("/boards/abc/tasks/def".to_string()),
        }];
        let html = generate_merged_email_html(&payloads, "https://app.test.com");
        assert!(html.contains("https://app.test.com/boards/abc/tasks/def"));
    }

    #[test]
    fn test_merged_email_html_absolute_link() {
        let payloads = vec![NotificationPayload {
            event_type: "test".to_string(),
            title: "Test".to_string(),
            body: "Body".to_string(),
            link_url: Some("https://external.com/page".to_string()),
        }];
        let html = generate_merged_email_html(&payloads, "https://app.test.com");
        assert!(html.contains("https://external.com/page"));
    }

    #[test]
    fn test_batch_error_display() {
        let err = BatchError::Serialization(
            serde_json::from_str::<serde_json::Value>("invalid").unwrap_err(),
        );
        let msg = format!("{}", err);
        assert!(msg.contains("Serialization error"), "got: {}", msg);
    }

    #[test]
    fn test_batch_flush_result_empty() {
        let result = BatchFlushResult {
            users_flushed: 0,
            emails_sent: 0,
            errors: 0,
        };
        assert_eq!(result.users_flushed, 0);
        assert_eq!(result.emails_sent, 0);
        assert_eq!(result.errors, 0);
    }
}
