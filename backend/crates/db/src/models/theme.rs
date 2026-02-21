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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn make_theme() -> Theme {
        let now = Utc::now();
        Theme {
            slug: "ocean-dark".to_string(),
            name: "Ocean Dark".to_string(),
            category: "dark".to_string(),
            description: "A deep ocean theme".to_string(),
            is_dark: true,
            sort_order: 1,
            is_active: true,
            colors: serde_json::json!({"primary": "#1a73e8", "background": "#0d1117"}),
            personality: serde_json::json!({"mood": "calm"}),
            preview: serde_json::json!({"thumbnail": "ocean.png"}),
            primeng_ramp: serde_json::json!({"50": "#e3f2fd"}),
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn test_theme_serde_roundtrip() {
        let theme = make_theme();
        let json = serde_json::to_string(&theme).unwrap();
        let deserialized: Theme = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.slug, "ocean-dark");
        assert_eq!(deserialized.name, "Ocean Dark");
        assert!(deserialized.is_dark);
        assert!(deserialized.is_active);
    }

    #[test]
    fn test_theme_list_response_serialize() {
        let theme = make_theme();
        let resp = ThemeListResponse {
            themes: vec![theme],
        };
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed["themes"].is_array());
        assert_eq!(parsed["themes"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn test_theme_list_response_empty() {
        let resp = ThemeListResponse { themes: vec![] };
        let json = serde_json::to_string(&resp).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed["themes"].as_array().unwrap().is_empty());
    }
}
