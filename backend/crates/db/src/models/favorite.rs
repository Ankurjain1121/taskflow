use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Favorite {
    pub id: Uuid,
    pub user_id: Uuid,
    pub entity_type: String,
    pub entity_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_favorite_serde_roundtrip() {
        let now = Utc::now();
        let fav = Favorite {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            entity_type: "project".to_string(),
            entity_id: Uuid::new_v4(),
            created_at: now,
        };
        let json = serde_json::to_string(&fav).unwrap();
        let deserialized: Favorite = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, fav.id);
        assert_eq!(deserialized.entity_type, "project");
        assert_eq!(deserialized.entity_id, fav.entity_id);
    }

    #[test]
    fn test_favorite_json_field_names() {
        let now = Utc::now();
        let fav = Favorite {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            entity_type: "task".to_string(),
            entity_id: Uuid::new_v4(),
            created_at: now,
        };
        let parsed: serde_json::Value = serde_json::to_value(&fav).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("user_id").is_some());
        assert!(parsed.get("entity_type").is_some());
        assert!(parsed.get("entity_id").is_some());
        assert!(parsed.get("created_at").is_some());
    }

    #[test]
    fn test_favorite_clone() {
        let now = Utc::now();
        let fav = Favorite {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            entity_type: "workspace".to_string(),
            entity_id: Uuid::new_v4(),
            created_at: now,
        };
        let cloned = fav.clone();
        assert_eq!(cloned.id, fav.id);
        assert_eq!(cloned.entity_type, fav.entity_type);
    }
}
