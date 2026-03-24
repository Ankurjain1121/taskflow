//! Notification dispatcher — routes notifications to the correct channels
//!
//! The `notify()` function is the single entry point for sending notifications.
//! It checks the recipient's per-event preferences and fans out to:
//! - In-app (always, via DB insert + WebSocket broadcast)
//! - Email (via email queue)
//! - Slack (if enabled + webhook configured)
//! - WhatsApp (if enabled + phone number set + not in quiet hours)

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::jobs::email_queue::{enqueue_email, EmailJob};
use crate::notifications::events::NotificationEvent;
use crate::notifications::service::{NotificationService, NotificationServiceError};
use crate::notifications::whatsapp::WahaClient;
use taskbolt_db::queries::notification_preferences::{
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

/// Bundles all infrastructure dependencies the dispatcher needs.
/// Avoids passing 10+ positional arguments to notify().
pub struct NotifyContext<'a> {
    pub pool: &'a PgPool,
    pub redis: &'a redis::aio::ConnectionManager,
    pub notification_svc: &'a NotificationService,
    pub app_url: &'a str,
    pub slack_webhook_url: Option<&'a str>,
    pub waha_client: Option<&'a WahaClient>,
}

/// Result of a dispatch operation — reports which channels were used.
#[derive(Debug, Default)]
pub struct DispatchResult {
    pub in_app: bool,
    pub email_enqueued: bool,
    pub slack_sent: bool,
    pub whatsapp_sent: bool,
}

/// Dispatch a notification to all channels the user has enabled.
pub async fn notify(
    ctx: &NotifyContext<'_>,
    event: NotificationEvent,
    recipient_id: Uuid,
    title: &str,
    body: &str,
    link_url: Option<&str>,
) -> Result<DispatchResult, DispatchError> {
    let event_name = event.name();
    let mut result = DispatchResult::default();

    // -----------------------------------------------------------------------
    // 1. In-app notification (always created)
    // -----------------------------------------------------------------------
    let in_app_enabled = should_notify(
        ctx.pool,
        recipient_id,
        event_name,
        NotificationChannel::InApp,
    )
    .await
    .unwrap_or(true);

    if in_app_enabled {
        match ctx
            .notification_svc
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
    let email_enabled = should_notify(
        ctx.pool,
        recipient_id,
        event_name,
        NotificationChannel::Email,
    )
    .await
    .unwrap_or(true);

    if email_enabled {
        let user_email: Option<String> =
            sqlx::query_scalar(r#"SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL"#)
                .bind(recipient_id)
                .fetch_optional(ctx.pool)
                .await
                .ok()
                .flatten();

        if let Some(email) = user_email {
            let full_link = link_url.map(|u| {
                if u.starts_with("http") {
                    u.to_string()
                } else {
                    format!("{}{}", ctx.app_url, u)
                }
            });
            let subject = format!("[TaskBolt] {}", title);

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
</html>"#,
                app_url = ctx.app_url
            );

            let job = EmailJob::new(email, subject, html_body, event_name.to_string());

            match enqueue_email(ctx.redis, &job).await {
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
    if let Some(webhook_url) = ctx.slack_webhook_url {
        let slack_enabled = should_notify(
            ctx.pool,
            recipient_id,
            event_name,
            NotificationChannel::Slack,
        )
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

    // -----------------------------------------------------------------------
    // 4. WhatsApp notification
    // -----------------------------------------------------------------------
    if let Some(waha_client) = ctx.waha_client {
        let wa_enabled = should_notify(
            ctx.pool,
            recipient_id,
            event_name,
            NotificationChannel::WhatsApp,
        )
        .await
        .unwrap_or(false);

        if wa_enabled {
            // Check quiet hours
            let in_quiet_hours =
                match taskbolt_db::queries::user_prefs::get_quiet_hours(ctx.pool, recipient_id)
                    .await
                {
                    Ok(Some((start, end))) => {
                        // Use IST (UTC+5:30) for quiet hours check
                        let ist_offset = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60)
                            .expect("valid offset");
                        let now_ist = Utc::now().with_timezone(&ist_offset).time();
                        taskbolt_db::queries::is_in_quiet_hours(now_ist, start, end)
                    }
                    _ => false,
                };

            if in_quiet_hours {
                tracing::debug!(
                    recipient_id = %recipient_id,
                    event = event_name,
                    "Skipping WhatsApp notification: quiet hours active"
                );
            } else {
                // Look up user's phone number
                let phone: Option<String> = sqlx::query_scalar(
                    r#"SELECT phone_number FROM users WHERE id = $1 AND deleted_at IS NULL"#,
                )
                .bind(recipient_id)
                .fetch_optional(ctx.pool)
                .await
                .ok()
                .flatten();

                if let Some(phone_number) = phone {
                    // Format WhatsApp message
                    let emoji = crate::notifications::whatsapp::get_event_emoji(event_name);
                    let mut message = format!("{} *{}*\n\n{}", emoji, title, body);
                    if let Some(url) = link_url {
                        let full_url = if url.starts_with("http") {
                            url.to_string()
                        } else {
                            format!("{}{}", ctx.app_url, url)
                        };
                        message.push_str(&format!("\n\nView details: {}", full_url));
                    }

                    match waha_client.send_message(&phone_number, &message).await {
                        Ok(()) => {
                            result.whatsapp_sent = true;
                            // Log successful delivery
                            let _ = taskbolt_db::queries::log_delivery(
                                ctx.pool,
                                None, // notification_id not easily available here
                                recipient_id,
                                "whatsapp",
                                "sent",
                                None,
                                None,
                            )
                            .await;
                        }
                        Err(e) => {
                            tracing::error!(
                                recipient_id = %recipient_id,
                                event = event_name,
                                phone = %phone_number,
                                error = %e,
                                "Failed to send WhatsApp notification"
                            );
                            // Log failed delivery
                            let _ = taskbolt_db::queries::log_delivery(
                                ctx.pool,
                                None,
                                recipient_id,
                                "whatsapp",
                                "failed",
                                None,
                                Some(&e.to_string()),
                            )
                            .await;
                        }
                    }
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
        assert!(!result.whatsapp_sent);
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
