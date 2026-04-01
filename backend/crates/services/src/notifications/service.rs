//! Notification service for creating and broadcasting in-app notifications
//!
//! This module provides SERVER-SIDE functions for creating notifications.
//! These functions are NOT exposed as REST endpoints - they are called
//! from task mutations, comment creation, etc. to prevent privilege escalation.

use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::broadcast::BroadcastService;
use crate::notifications::email::PostalClient;
use crate::notifications::events::NotificationEvent;

/// Error type for notification service operations
#[derive(Debug, thiserror::Error)]
pub enum NotificationServiceError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Broadcast error: {0}")]
    Broadcast(#[from] crate::broadcast::BroadcastError),
}

/// Notification service for creating and broadcasting notifications
#[derive(Clone)]
pub struct NotificationService {
    pool: PgPool,
    broadcast: BroadcastService,
    email_client: Option<PostalClient>,
    app_url: String,
}

impl NotificationService {
    /// Create a new notification service
    pub fn new(
        pool: PgPool,
        broadcast: BroadcastService,
        email_client: Option<PostalClient>,
        app_url: String,
    ) -> Self {
        Self {
            pool,
            broadcast,
            email_client,
            app_url,
        }
    }

    /// Create a notification and broadcast it via WebSocket
    ///
    /// This is a SERVER-SIDE ONLY function. It should never be exposed
    /// as a REST endpoint to prevent users from creating arbitrary notifications.
    ///
    /// # Arguments
    /// * `recipient_id` - The user ID who will receive the notification
    /// * `event_type` - The type of notification event
    /// * `title` - Short notification title
    /// * `body` - Notification body text
    /// * `link_url` - Optional URL to link to when notification is clicked
    ///
    /// # Returns
    /// The created notification ID
    pub async fn create_notification(
        &self,
        recipient_id: Uuid,
        event_type: NotificationEvent,
        title: &str,
        body: &str,
        link_url: Option<&str>,
    ) -> Result<Uuid, NotificationServiceError> {
        let notification_id = Uuid::new_v4();
        let event_type_str = event_type.name();

        // Insert the notification into the database
        let notification = sqlx::query!(
            r#"
            INSERT INTO notifications (id, recipient_id, event_type, title, body, link_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, recipient_id, event_type, title, body, link_url, is_read, created_at
            "#,
            notification_id,
            recipient_id,
            event_type_str,
            title,
            body,
            link_url
        )
        .fetch_one(&self.pool)
        .await?;

        tracing::debug!(
            notification_id = %notification.id,
            recipient_id = %recipient_id,
            event_type = event_type_str,
            "Notification created"
        );

        // Broadcast to user channel via WebSocket
        let payload = json!({
            "id": notification.id,
            "event_type": notification.event_type,
            "title": notification.title,
            "body": notification.body,
            "link_url": notification.link_url,
            "is_read": notification.is_read,
            "created_at": notification.created_at
        });

        if let Err(e) = self
            .broadcast
            .broadcast_user_update(recipient_id, "notification:new", payload)
            .await
        {
            // Log but don't fail - notification was already created in DB
            tracing::error!(
                notification_id = %notification.id,
                recipient_id = %recipient_id,
                error = %e,
                "Failed to broadcast notification via WebSocket"
            );
        }

        // Send email notification asynchronously (fire-and-forget)
        if let Some(ref email_client) = self.email_client {
            let pool = self.pool.clone();
            let email_client = email_client.clone();
            let event_type_owned = event_type_str.to_string();
            let title_owned = title.to_string();
            let body_owned = body.to_string();
            let link_url_owned = link_url.map(std::string::ToString::to_string);
            let app_url = self.app_url.clone();

            tokio::spawn(async move {
                // Check if user wants email notifications for this event type
                let pref_row = sqlx::query_as::<_, (bool,)>(
                    r#"
                    SELECT COALESCE(
                        (SELECT np.email FROM notification_preferences np
                         WHERE np.user_id = $1 AND np.event_type = $2),
                        true
                    )
                    "#,
                )
                .bind(recipient_id)
                .bind(&event_type_owned)
                .fetch_one(&pool)
                .await;

                match pref_row {
                    Ok((true,)) => {
                        // Fetch user email
                        let user_email = sqlx::query_as::<_, (String,)>(
                            r#"SELECT email FROM users WHERE id = $1 AND deleted_at IS NULL"#,
                        )
                        .bind(recipient_id)
                        .fetch_optional(&pool)
                        .await;

                        if let Ok(Some((email,))) = user_email {
                            if let Err(e) = email_client
                                .send_notification_email(
                                    &email,
                                    &event_type_owned,
                                    &title_owned,
                                    &body_owned,
                                    link_url_owned.as_deref(),
                                    &app_url,
                                )
                                .await
                            {
                                tracing::error!(
                                    recipient_id = %recipient_id,
                                    error = %e,
                                    "Failed to send notification email"
                                );
                            }
                        }
                    }
                    Ok((false,)) => {
                        tracing::debug!(
                            recipient_id = %recipient_id,
                            event_type = %event_type_owned,
                            "User has email notifications disabled for this event"
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            recipient_id = %recipient_id,
                            error = %e,
                            "Failed to check email notification preference"
                        );
                    }
                }
            });
        }

        Ok(notification.id)
    }

    /// Create notifications for multiple recipients
    ///
    /// Useful for notifying all assignees of a task.
    pub async fn create_notifications_batch(
        &self,
        recipient_ids: &[Uuid],
        event_type: NotificationEvent,
        title: &str,
        body: &str,
        link_url: Option<&str>,
    ) -> Result<Vec<Uuid>, NotificationServiceError> {
        let mut notification_ids = Vec::with_capacity(recipient_ids.len());

        for recipient_id in recipient_ids {
            match self
                .create_notification(*recipient_id, event_type, title, body, link_url)
                .await
            {
                Ok(id) => notification_ids.push(id),
                Err(e) => {
                    tracing::error!(
                        recipient_id = %recipient_id,
                        event_type = %event_type.name(),
                        error = %e,
                        "Failed to create notification for recipient"
                    );
                }
            }
        }

        Ok(notification_ids)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_event_to_string() {
        assert_eq!(NotificationEvent::TaskAssigned.name(), "task-assigned");
    }

    #[test]
    fn test_notification_service_error_display_broadcast() {
        let err =
            NotificationServiceError::Broadcast(crate::broadcast::BroadcastError::Serialization(
                serde_json::from_str::<serde_json::Value>("invalid").unwrap_err(),
            ));
        let msg = format!("{}", err);
        assert!(msg.contains("Broadcast error"), "got: {}", msg);
    }

    #[test]
    fn test_notification_service_error_debug() {
        let err =
            NotificationServiceError::Broadcast(crate::broadcast::BroadcastError::Serialization(
                serde_json::from_str::<serde_json::Value>("invalid").unwrap_err(),
            ));
        let debug = format!("{:?}", err);
        assert!(debug.contains("Broadcast"), "got: {}", debug);
    }

    #[test]
    fn test_all_notification_event_names_are_kebab_case() {
        for event in NotificationEvent::all() {
            let name = event.name();
            assert!(
                name.chars().all(|c| c.is_ascii_lowercase() || c == '-'),
                "Event name '{}' is not kebab-case",
                name
            );
        }
    }

    #[test]
    fn test_notification_event_title_not_empty() {
        for event in NotificationEvent::all() {
            let title = event.title();
            assert!(!title.is_empty(), "Title for {:?} is empty", event);
        }
    }
}
