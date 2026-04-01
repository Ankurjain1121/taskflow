//! Notification query functions
//!
//! Provides database operations for in-app notifications.

use chrono::{DateTime, Utc};
use serde::Serialize;
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
    let notifications: Vec<Notification> = if let Some(cursor_id) = cursor {
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
                    SELECT id, recipient_id, event_type, title, body, link_url, is_read, archived_at, created_at
                    FROM notifications
                    WHERE recipient_id = $1
                      AND archived_at IS NULL
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
                    SELECT id, recipient_id, event_type, title, body, link_url, is_read, archived_at, created_at
                    FROM notifications
                    WHERE recipient_id = $1
                      AND archived_at IS NULL
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
            SELECT id, recipient_id, event_type, title, body, link_url, is_read, archived_at, created_at
            FROM notifications
            WHERE recipient_id = $1
              AND archived_at IS NULL
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
        WHERE recipient_id = $1 AND is_read = false AND archived_at IS NULL
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
        }
        return Err(NotificationQueryError::NotFound);
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

    Ok(i64::try_from(result.rows_affected()).unwrap_or(0))
}

/// Delete old notifications in bounded batches (for cleanup job).
///
/// Deletes up to `batch_limit` rows per call. Returns the count of deleted rows
/// so the caller can loop until `0` is returned.
pub async fn delete_old_notifications(
    pool: &PgPool,
    days_to_keep: i64,
    batch_limit: i64,
) -> Result<i64, NotificationQueryError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM notifications
        WHERE id IN (
            SELECT id FROM notifications
            WHERE created_at < NOW() - $1 * interval '1 day'
            LIMIT $2
        )
        "#,
        days_to_keep as f64,
        batch_limit
    )
    .execute(pool)
    .await?;

    Ok(i64::try_from(result.rows_affected()).unwrap_or(0))
}

/// Archive (soft-delete) a notification for a user
pub async fn archive_notification(
    pool: &PgPool,
    notification_id: Uuid,
    user_id: Uuid,
) -> Result<(), NotificationQueryError> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        UPDATE notifications
        SET archived_at = NOW()
        WHERE id = $1 AND recipient_id = $2 AND archived_at IS NULL
        "#,
        notification_id,
        user_id
    )
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        let exists = sqlx::query_scalar!(
            r#"SELECT EXISTS(SELECT 1 FROM notifications WHERE id = $1) as "exists!""#,
            notification_id
        )
        .fetch_one(pool)
        .await?;

        if exists {
            return Err(NotificationQueryError::Unauthorized);
        }
        return Err(NotificationQueryError::NotFound);
    }

    Ok(())
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

    #[test]
    fn test_notification_query_error_display() {
        let db_err = NotificationQueryError::NotFound;
        assert_eq!(db_err.to_string(), "Notification not found");

        let unauth = NotificationQueryError::Unauthorized;
        assert_eq!(unauth.to_string(), "Unauthorized");
    }

    // ── Integration test: bounded DELETE ─────────────────────────────
    //
    // `delete_old_notifications` uses a sub-select with LIMIT to cap the
    // number of rows deleted per call:
    //
    //     DELETE FROM notifications
    //     WHERE id IN (
    //         SELECT id FROM notifications
    //         WHERE created_at < NOW() - $1 * interval '1 day'
    //         LIMIT $2             <-- batch_limit
    //     )
    //
    // A full integration test would:
    //   1. Call `setup_user` from `test_helpers` to get a user_id.
    //   2. Insert N old notifications (created_at = NOW() - 100 days).
    //   3. Insert M recent notifications (created_at = NOW()).
    //   4. Call `delete_old_notifications(pool, 30, batch_limit=2)`.
    //   5. Assert exactly 2 rows deleted (not all N).
    //   6. Call again, assert 2 more deleted, etc.
    //   7. Assert recent notifications are untouched.
    //
    // This test requires a live Postgres connection (see `test_helpers::test_pool`)
    // and is gated behind `#[ignore]` to avoid running in CI without a DB.
    // Run with: `cargo test -p taskbolt-db -- --ignored test_delete_old_notifications_respects_batch_limit`
    #[tokio::test]
    #[ignore = "requires live Postgres (run with --ignored)"]
    async fn test_delete_old_notifications_respects_batch_limit() {
        let pool = crate::queries::test_helpers::test_pool().await;
        let (_tenant_id, user_id) = crate::queries::test_helpers::setup_user(&pool).await;

        // Insert 5 old notifications (90 days ago)
        for i in 0..5 {
            sqlx::query!(
                r#"
                INSERT INTO notifications (id, recipient_id, event_type, title, body, is_read, created_at)
                VALUES ($1, $2, 'test', $3, 'body', false, NOW() - interval '90 days')
                "#,
                Uuid::new_v4(),
                user_id,
                format!("Old notification {}", i),
            )
            .execute(&pool)
            .await
            .expect("insert old notification");
        }

        // Insert 2 recent notifications
        for i in 0..2 {
            sqlx::query!(
                r#"
                INSERT INTO notifications (id, recipient_id, event_type, title, body, is_read, created_at)
                VALUES ($1, $2, 'test', $3, 'body', false, NOW())
                "#,
                Uuid::new_v4(),
                user_id,
                format!("Recent notification {}", i),
            )
            .execute(&pool)
            .await
            .expect("insert recent notification");
        }

        // Delete with batch_limit=2, days_to_keep=30
        let deleted = delete_old_notifications(&pool, 30, 2)
            .await
            .expect("delete_old_notifications");
        assert_eq!(deleted, 2, "Should delete exactly batch_limit rows");

        // Delete again — should get 2 more
        let deleted2 = delete_old_notifications(&pool, 30, 2)
            .await
            .expect("delete_old_notifications second call");
        assert_eq!(deleted2, 2, "Second batch should delete 2 more");

        // Delete again — only 1 old notification remains
        let deleted3 = delete_old_notifications(&pool, 30, 2)
            .await
            .expect("delete_old_notifications third call");
        assert_eq!(deleted3, 1, "Third batch should delete the remaining 1");

        // Delete again — nothing left to delete
        let deleted4 = delete_old_notifications(&pool, 30, 2)
            .await
            .expect("delete_old_notifications fourth call");
        assert_eq!(deleted4, 0, "No more old notifications to delete");
    }
}
