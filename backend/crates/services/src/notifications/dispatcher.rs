//! Notification dispatcher — routes notifications to the correct channels
//!
//! The `notify()` function is the single entry point for sending notifications.
//! It checks the recipient's per-event preferences and fans out to:
//! - In-app (always, via DB insert + WebSocket broadcast)
//! - Email (via email queue)
//! - Slack (if enabled + webhook configured)

use sqlx::PgPool;
use uuid::Uuid;

use crate::jobs::email_queue::{enqueue_email, EmailJob};
use crate::notifications::events::NotificationEvent;
use crate::notifications::service::{NotificationService, NotificationServiceError};
use taskflow_db::queries::notification_preferences::{
    should_notify, NotificationChannel, NotificationPreferenceError,
};

/// Error type for dispatch operations
#[derive(Debug, thiserror::Error)]
pub enum DispatchError {
    #[error("Notification service error: {0}")]
    Service(#[from] NotificationServiceError),
    #[error("Preference lookup error: {0}")]
    Preference(#[from] NotificationPreferenceError),
    #[error("Email queue error: {0}")]
    EmailQueue(#[from] crate::jobs::email_queue::EmailQueueError),
}

/// Result of a dispatch operation — reports which channels were used.
#[derive(Debug, Default)]
pub struct DispatchResult {
    pub in_app: bool,
    pub email_enqueued: bool,
    pub slack_sent: bool,
}

/// Dispatch a notification to all channels the user has enabled.
///
/// # Arguments
/// * `pool`               - Database connection pool
/// * `redis`              - Redis connection (for email queue)
/// * `notification_svc`   - The in-app notification service (DB + WebSocket)
/// * `event`              - The notification event type
/// * `recipient_id`       - Target user
/// * `title`              - Short title (shown in-app and email subject)
/// * `body`               - Longer body text
/// * `link_url`           - Optional deep-link into the app
/// * `app_url`            - Base app URL for building full links in emails
/// * `slack_webhook_url`  - Optional Slack webhook (from project/workspace settings)
#[allow(clippy::too_many_arguments)]
pub async fn notify(
    pool: &PgPool,
    redis: &redis::aio::ConnectionManager,
    notification_svc: &NotificationService,
    event: NotificationEvent,
    recipient_id: Uuid,
    title: &str,
    body: &str,
    link_url: Option<&str>,
    app_url: &str,
    slack_webhook_url: Option<&str>,
) -> Result<DispatchResult, DispatchError> {
    let event_name = event.name();
    let mut result = DispatchResult::default();

    // -----------------------------------------------------------------------
    // 1. In-app notification (always created)
    // -----------------------------------------------------------------------
    let in_app_enabled = should_notify(pool, recipient_id, event_name, NotificationChannel::InApp)
        .await
        .unwrap_or(true); // default to true on error

    if in_app_enabled {
        match notification_svc
            .create_notification(recipient_id, event, title, body, link_url)
            .await
        {
            Ok(_id) => {
                result.in_app = true;
            }
            Err(e) => {
                tracing::error!(
                    recipient_id = %recipient_id,
                    event = event_name,
                    error = %e,
                    "Failed to create in-app notification"
                );
            }
        }
    }

    // -----------------------------------------------------------------------
    // 2. Email notification (enqueue for background worker)
    // -----------------------------------------------------------------------
    let email_enabled = should_notify(pool, recipient_id, event_name, NotificationChannel::Email)
        .await
        .unwrap_or(true);

    if email_enabled {
        // Look up the user's email address
        let user_email: Option<String> =
            sqlx::query_scalar(r#"SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL"#)
                .bind(recipient_id)
                .fetch_optional(pool)
                .await
                .ok()
                .flatten();

        if let Some(email) = user_email {
            let full_link = link_url.map(|u| {
                if u.starts_with("http") {
                    u.to_string()
                } else {
                    format!("{}{}", app_url, u)
                }
            });
            let subject = format!("[TaskFlow] {}", title);

            // Build simple HTML body (same template as PostalClient::send_notification_email)
            let link_html = full_link
                .as_deref()
                .map(|url| {
                    format!(
                        r#"<p><a href="{}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Details</a></p>"#,
                        url
                    )
                })
                .unwrap_or_default();

            let html_body = format!(
                r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">{title}</h1>
        <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0;">{body}</p>
        {link_html}
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
        <a href="{app_url}/settings/notifications" style="color: #6366f1;">Manage preferences</a>
    </p>
</body>
</html>"#
            );

            let job = EmailJob::new(email, subject, html_body, event_name.to_string());

            match enqueue_email(redis, &job).await {
                Ok(()) => {
                    result.email_enqueued = true;
                }
                Err(e) => {
                    tracing::error!(
                        recipient_id = %recipient_id,
                        event = event_name,
                        error = %e,
                        "Failed to enqueue email job"
                    );
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // 3. Slack notification
    // -----------------------------------------------------------------------
    if let Some(webhook_url) = slack_webhook_url {
        let slack_enabled =
            should_notify(pool, recipient_id, event_name, NotificationChannel::Slack)
                .await
                .unwrap_or(false);

        if slack_enabled {
            match crate::notifications::slack::send_slack_notification(
                webhook_url,
                event_name,
                title,
                body,
                link_url,
            )
            .await
            {
                Ok(()) => {
                    result.slack_sent = true;
                }
                Err(e) => {
                    tracing::error!(
                        recipient_id = %recipient_id,
                        event = event_name,
                        error = %e,
                        "Failed to send Slack notification"
                    );
                }
            }
        }
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatch_result_default() {
        let result = DispatchResult::default();
        assert!(!result.in_app);
        assert!(!result.email_enqueued);
        assert!(!result.slack_sent);
    }

    #[test]
    fn test_dispatch_error_display() {
        let err =
            DispatchError::EmailQueue(crate::jobs::email_queue::EmailQueueError::Serialization(
                serde_json::from_str::<crate::jobs::email_queue::EmailJob>("bad").unwrap_err(),
            ));
        let msg = format!("{}", err);
        assert!(msg.contains("Email queue error"), "got: {}", msg);
    }

    #[test]
    fn test_dispatch_error_from_preference() {
        let err = DispatchError::Preference(NotificationPreferenceError::InvalidEventType(
            "unknown".to_string(),
        ));
        let msg = format!("{}", err);
        assert!(msg.contains("Preference lookup error"), "got: {}", msg);
    }
}
