use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct UserPreferences {
    pub id: Uuid,
    pub user_id: Uuid,
    pub timezone: String,
    pub date_format: String,
    pub default_board_view: String,
    pub sidebar_density: String,
    pub locale: String,
    pub quiet_hours_start: Option<NaiveTime>,
    pub quiet_hours_end: Option<NaiveTime>,
    pub digest_frequency: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // New theme fields
    pub light_theme_slug: Option<String>,
    pub dark_theme_slug: Option<String>,
    pub accent_color: Option<String>,
    pub color_mode: Option<String>,
}
