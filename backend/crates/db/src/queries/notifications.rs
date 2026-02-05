//! Notification query functions
//!
//! Provides database operations for in-app notifications.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::Notification;

/// Error type for notification query operations
#[derive(Debug, thiserror::Error)]
pub enum NotificationQueryError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Notification not found")]
    NotFound,
    #[error("Unauthorized")]
    Unauthorized,
}

/// Response for paginated notification list
#[derive(Debug, Serialize)]
pub struct NotificationListResponse {
    pub items: Vec<Notification>,
    #[serde(rename = "nextCursor")]
    pub next_cursor: Option<String>,
    #[serde(rename = "unreadCount")]
    pub unread_count: i64,
}

/// List notifications for a user with cursor-based pagination
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - The user's ID
/// * `cursor` - Optional cursor (notification ID) for pagination
/// * `limit` - Maximum number of items to return
pub async fn list_notifications(
    pool: &PgPool,
    user_id: Uuid,
    cursor: Option<Uuid>,
    limit: i64,
) -> Result<NotificationListResponse, NotificationQueryError> {
    // Get unread count first
    let unread_count = get_unread_count(pool, user_id).await?;

    // Fetch notifications with cursor-based pagination
    let notifications = if let Some(cursor_id) = cursor {
        // Get the created_at of the cursor notification for comparison
        let cursor_created_at: Option<DateTime<Utc>> = sqlx::query_scalar!(
            r#"SELECT created_at FROM notifications WHERE id = $1"#,
            cursor_id
        )
        .fetch_optional(pool)
        .await?;

        match cursor_created_at {
            Some(created_at) => {
                sqlx::query_as!(
                    Notification,
                    r#"
                    SELECT id, recipient_id, event_type, title, body, link_url, is_read, created_at
                    FROM notifications
                    WHERE recipient_id = $1
                      AND (created_at, id) < ($2, $3)
                    ORDER BY created_at DESC, id DESC
                    LIMIT $4
                    "#,
                    user_id,
                    created_at,
                    cursor_id,
                    limit + 1 // Fetch one extra to determine if there's more
                )
                .fetch_all(pool)
                .await?
            }
            None => {
                // Invalid cursor, start from beginning
                sqlx::query_as!(
                    Notification,
                    r#"
                    SELECT id, recipient_id, event_type, title, body, link_url, is_read, created_at
                    FROM notifications
                    WHERE recipient_id = $1
                    ORDER BY created_at DESC, id DESC
                    LIMIT $2
                    "#,
                    user_id,
                    limit + 1
                )
                .fetch_all(pool)
                .await?
            }
        }
    } else {
        sqlx::query_as!(
            Notification,
            r#"
            SELECT id, recipient_id, event_type, title, body, link_url, is_read, created_at
            FROM notifications
            WHERE recipient_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT $2
            "#,
            user_id,
            limit + 1
        )
        .fetch_all(pool)
        .await?
    };

    // Determine if there are more items
    let has_more = notifications.len() > limit as usize;
    let mut items = notifications;
    if has_more {
        items.pop(); // Remove the extra item
    }

    let next_cursor = if has_more {
        items.last().map(|n| n.id.to_string())
    } else {
        None
    };

    Ok(NotificationListResponse {
        items,
        next_cursor,
        unread_count,
    })
}

/// Get unread notification count for a user
pub async fn get_unread_count(pool: &PgPool, user_id: Uuid) -> Result<i64, NotificationQueryError> {
    let count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM notifications
        WHERE recipient_id = $1 AND is_read = false
        "#,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(count)
}

/// Mark a single notification as read
pub async fn mark_read(
    pool: &PgPool,
    notification_id: Uuid,
    user_id: Uuid,
) -> Result<(), NotificationQueryError> {
    let result = sqlx::query!(
        r#"
        UPDATE notifications
        SET is_read = true
        WHERE id = $1 AND recipient_id = $2
        "#,
        notification_id,
        user_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        // Check if notification exists but belongs to different user
        let exists = sqlx::query_scalar!(
            r#"SELECT EXISTS(SELECT 1 FROM notifications WHERE id = $1) as "exists!""#,
            notification_id
        )
        .fetch_one(pool)
        .await?;

        if exists {
            return Err(NotificationQueryError::Unauthorized);
        } else {
            return Err(NotificationQueryError::NotFound);
        }
    }

    Ok(())
}

/// Mark all notifications as read for a user
pub async fn mark_all_read(pool: &PgPool, user_id: Uuid) -> Result<i64, NotificationQueryError> {
    let result = sqlx::query!(
        r#"
        UPDATE notifications
        SET is_read = true
        WHERE recipient_id = $1 AND is_read = false
        "#,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() as i64)
}

/// Delete old notifications (for cleanup job)
pub async fn delete_old_notifications(
    pool: &PgPool,
    days_to_keep: i64,
) -> Result<i64, NotificationQueryError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM notifications
        WHERE created_at < NOW() - $1 * interval '1 day'
        "#,
        days_to_keep as f64
    )
    .execute(pool)
    .await?;

    Ok(result.rows_affected() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_list_response_serialize() {
        let response = NotificationListResponse {
            items: vec![],
            next_cursor: Some("cursor123".to_string()),
            unread_count: 5,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"nextCursor\":\"cursor123\""));
        assert!(json.contains("\"unreadCount\":5"));
    }
}
