//! Notification preference query functions
//!
//! Provides database operations for managing user notification preferences.

use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::NotificationPreference;

/// Error type for notification preference operations
#[derive(Debug, thiserror::Error)]
pub enum NotificationPreferenceError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Invalid event type: {0}")]
    InvalidEventType(String),
}

/// Input for upserting a notification preference
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPreferenceInput {
    pub event_type: String,
    pub in_app: bool,
    pub email: bool,
    pub slack: bool,
    pub whatsapp: bool,
}

/// List all notification preferences for a user
///
/// Returns preferences for all event types. For events without explicit
/// preferences, default values are applied (in_app=true, email=true, others=false).
pub async fn list_by_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<NotificationPreference>, NotificationPreferenceError> {
    let preferences = sqlx::query_as!(
        NotificationPreference,
        r#"
        SELECT id, user_id, event_type, in_app, email, slack, whatsapp, created_at, updated_at
        FROM notification_preferences
        WHERE user_id = $1
        ORDER BY event_type
        "#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    Ok(preferences)
}

/// Upsert a notification preference for a specific event type
#[allow(clippy::fn_params_excessive_bools)]
pub async fn upsert(
    pool: &PgPool,
    user_id: Uuid,
    event_type: &str,
    in_app: bool,
    email: bool,
    slack: bool,
    whatsapp: bool,
) -> Result<NotificationPreference, NotificationPreferenceError> {
    // Validate event type
    let valid_events = [
        "task-assigned",
        "task-due-soon",
        "task-overdue",
        "task-commented",
        "task-completed",
        "mention-in-comment",
        "task-updated-watcher",
        "task-reminder",
        "weekly-digest",
        "daily-digest",
    ];

    if !valid_events.contains(&event_type) {
        return Err(NotificationPreferenceError::InvalidEventType(
            event_type.to_string(),
        ));
    }

    let preference = sqlx::query_as!(
        NotificationPreference,
        r#"
        INSERT INTO notification_preferences (id, user_id, event_type, in_app, email, slack, whatsapp)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, event_type, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'))
        DO UPDATE SET
            in_app = EXCLUDED.in_app,
            email = EXCLUDED.email,
            slack = EXCLUDED.slack,
            whatsapp = EXCLUDED.whatsapp,
            updated_at = NOW()
        RETURNING id, user_id, event_type, in_app, email, slack, whatsapp, created_at, updated_at
        "#,
        Uuid::new_v4(),
        user_id,
        event_type,
        in_app,
        email,
        slack,
        whatsapp
    )
    .fetch_one(pool)
    .await?;

    Ok(preference)
}

/// Reset all notification preferences to defaults for a user
///
/// This deletes all explicit preferences, which causes the system to use
/// default values (in_app=true, email=true, slack=false, whatsapp=false).
pub async fn reset_all(pool: &PgPool, user_id: Uuid) -> Result<i64, NotificationPreferenceError> {
    let result = sqlx::query!(
        r#"
        DELETE FROM notification_preferences
        WHERE user_id = $1
        "#,
        user_id
    )
    .execute(pool)
    .await?;

    Ok(i64::try_from(result.rows_affected()).unwrap_or(0))
}

/// Get preference for a specific event type
///
/// Returns the explicit preference if set, or None to indicate defaults should be used.
pub async fn get_preference(
    pool: &PgPool,
    user_id: Uuid,
    event_type: &str,
) -> Result<Option<NotificationPreference>, NotificationPreferenceError> {
    let preference = sqlx::query_as!(
        NotificationPreference,
        r#"
        SELECT id, user_id, event_type, in_app, email, slack, whatsapp, created_at, updated_at
        FROM notification_preferences
        WHERE user_id = $1 AND event_type = $2
        "#,
        user_id,
        event_type
    )
    .fetch_optional(pool)
    .await?;

    Ok(preference)
}

/// Check if a user should receive a notification via a specific channel
///
/// Returns true if the channel is enabled for the event type.
/// Uses defaults if no explicit preference exists.
pub async fn should_notify(
    pool: &PgPool,
    user_id: Uuid,
    event_type: &str,
    channel: NotificationChannel,
) -> Result<bool, NotificationPreferenceError> {
    let preference = get_preference(pool, user_id, event_type).await?;

    Ok(match preference {
        Some(pref) => match channel {
            NotificationChannel::InApp => pref.in_app,
            NotificationChannel::Email => pref.email,
            NotificationChannel::Slack => pref.slack,
            NotificationChannel::WhatsApp => pref.whatsapp,
        },
        None => match channel {
            // Default preferences
            NotificationChannel::Slack => false,
            NotificationChannel::InApp | NotificationChannel::Email | NotificationChannel::WhatsApp => true,
        },
    })
}

/// Notification channel types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotificationChannel {
    InApp,
    Email,
    Slack,
    WhatsApp,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_upsert_input_deserialize() {
        let json = r#"{
            "eventType": "task-assigned",
            "inApp": true,
            "email": true,
            "slack": false,
            "whatsapp": false
        }"#;
        let input: UpsertPreferenceInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.event_type, "task-assigned");
        assert!(input.in_app);
        assert!(input.email);
        assert!(!input.slack);
        assert!(!input.whatsapp);
    }
}
