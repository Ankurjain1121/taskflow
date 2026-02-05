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
