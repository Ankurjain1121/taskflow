use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Notification {
    pub id: Uuid,
    pub recipient_id: Uuid,
    pub event_type: String,
    pub title: String,
    pub body: String,
    pub link_url: Option<String>,
    pub is_read: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct NotificationPreference {
    pub id: Uuid,
    pub user_id: Uuid,
    pub event_type: String,
    pub in_app: bool,
    pub email: bool,
    pub slack: bool,
    pub whatsapp: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_serde_roundtrip() {
        let now = Utc::now();
        let notif = Notification {
            id: Uuid::new_v4(),
            recipient_id: Uuid::new_v4(),
            event_type: "task_assigned".to_string(),
            title: "New Task".to_string(),
            body: "You have been assigned a task".to_string(),
            link_url: Some("/boards/123/tasks/456".to_string()),
            is_read: false,
            created_at: now,
        };
        let json = serde_json::to_string(&notif).unwrap();
        let deserialized: Notification = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, notif.id);
        assert_eq!(deserialized.event_type, "task_assigned");
        assert!(!deserialized.is_read);
        assert!(deserialized.link_url.is_some());
    }

    #[test]
    fn test_notification_preference_serde_roundtrip() {
        let now = Utc::now();
        let pref = NotificationPreference {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            event_type: "task_due_soon".to_string(),
            in_app: true,
            email: true,
            slack: false,
            whatsapp: false,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&pref).unwrap();
        let deserialized: NotificationPreference = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.event_type, "task_due_soon");
        assert!(deserialized.in_app);
        assert!(deserialized.email);
        assert!(!deserialized.slack);
        assert!(!deserialized.whatsapp);
    }
}
