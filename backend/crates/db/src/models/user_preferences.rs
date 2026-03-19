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
    pub default_project_view: String,
    pub sidebar_density: String,
    pub locale: String,
    pub quiet_hours_start: Option<NaiveTime>,
    pub quiet_hours_end: Option<NaiveTime>,
    pub digest_frequency: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub accent_color: Option<String>,
    pub color_mode: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_user_preferences() -> UserPreferences {
        let now = Utc::now();
        UserPreferences {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            timezone: "America/New_York".to_string(),
            date_format: "MM/DD/YYYY".to_string(),
            default_project_view: "kanban".to_string(),
            sidebar_density: "comfortable".to_string(),
            locale: "en-US".to_string(),
            quiet_hours_start: Some(NaiveTime::from_hms_opt(22, 0, 0).unwrap()),
            quiet_hours_end: Some(NaiveTime::from_hms_opt(8, 0, 0).unwrap()),
            digest_frequency: "daily".to_string(),
            created_at: now,
            updated_at: now,
            accent_color: Some("indigo".to_string()),
            color_mode: Some("dark".to_string()),
        }
    }

    #[test]
    fn test_user_preferences_serde_roundtrip() {
        let prefs = make_user_preferences();
        let json = serde_json::to_string(&prefs).unwrap();
        let deserialized: UserPreferences = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, prefs.id);
        assert_eq!(deserialized.timezone, "America/New_York");
        assert_eq!(deserialized.date_format, "MM/DD/YYYY");
        assert_eq!(deserialized.default_project_view, "kanban");
        assert_eq!(deserialized.locale, "en-US");
        assert_eq!(deserialized.digest_frequency, "daily");
        assert_eq!(deserialized.accent_color, Some("indigo".to_string()));
        assert_eq!(deserialized.color_mode, Some("dark".to_string()));
    }

    #[test]
    fn test_user_preferences_quiet_hours() {
        let prefs = make_user_preferences();
        let json = serde_json::to_string(&prefs).unwrap();
        let deserialized: UserPreferences = serde_json::from_str(&json).unwrap();
        assert!(deserialized.quiet_hours_start.is_some());
        assert!(deserialized.quiet_hours_end.is_some());
    }

    #[test]
    fn test_user_preferences_no_quiet_hours() {
        let now = Utc::now();
        let prefs = UserPreferences {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            timezone: "UTC".to_string(),
            date_format: "YYYY-MM-DD".to_string(),
            default_project_view: "list".to_string(),
            sidebar_density: "compact".to_string(),
            locale: "en-GB".to_string(),
            quiet_hours_start: None,
            quiet_hours_end: None,
            digest_frequency: "weekly".to_string(),
            created_at: now,
            updated_at: now,
            accent_color: None,
            color_mode: None,
        };
        let json = serde_json::to_string(&prefs).unwrap();
        let deserialized: UserPreferences = serde_json::from_str(&json).unwrap();
        assert!(deserialized.quiet_hours_start.is_none());
        assert!(deserialized.quiet_hours_end.is_none());
        assert!(deserialized.accent_color.is_none());
        assert!(deserialized.color_mode.is_none());
    }

    #[test]
    fn test_user_preferences_clone() {
        let prefs = make_user_preferences();
        let cloned = prefs.clone();
        assert_eq!(cloned.id, prefs.id);
        assert_eq!(cloned.timezone, prefs.timezone);
        assert_eq!(cloned.accent_color, prefs.accent_color);
    }

    #[test]
    fn test_user_preferences_json_field_names() {
        let prefs = make_user_preferences();
        let parsed: serde_json::Value = serde_json::to_value(&prefs).unwrap();
        assert!(parsed.get("timezone").is_some());
        assert!(parsed.get("date_format").is_some());
        assert!(parsed.get("default_project_view").is_some());
        assert!(parsed.get("sidebar_density").is_some());
        assert!(parsed.get("locale").is_some());
        assert!(parsed.get("digest_frequency").is_some());
        assert!(parsed.get("accent_color").is_some());
        assert!(parsed.get("color_mode").is_some());
    }
}
