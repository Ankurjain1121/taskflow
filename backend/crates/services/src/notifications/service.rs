//! Notification service for creating and broadcasting in-app notifications
//!
//! This module provides SERVER-SIDE functions for creating notifications.
//! These functions are NOT exposed as REST endpoints - they are called
//! from task mutations, comment creation, etc. to prevent privilege escalation.

use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::broadcast::BroadcastService;
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
}

impl NotificationService {
    /// Create a new notification service
    pub fn new(pool: PgPool, broadcast: BroadcastService) -> Self {
        Self { pool, broadcast }
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
}
