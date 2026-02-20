use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Theme model for the themes table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Theme {
    pub slug: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub is_dark: bool,
    pub sort_order: i16,
    pub is_active: bool,
    pub colors: serde_json::Value,
    pub personality: serde_json::Value,
    pub preview: serde_json::Value,
    pub primeng_ramp: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Theme list response
#[derive(Debug, Serialize)]
pub struct ThemeListResponse {
    pub themes: Vec<Theme>,
}
