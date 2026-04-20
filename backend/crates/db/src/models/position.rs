use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Position {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub project_id: Uuid,
    pub fallback_position_id: Option<Uuid>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct PositionHolder {
    pub id: Uuid,
    pub position_id: Uuid,
    pub user_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

/// Summary of a user holding a position (for API responses)
#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct HolderSummary {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub assigned_at: DateTime<Utc>,
}

/// Position with holders and linked recurring task count (API response type)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PositionWithHolders {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub project_id: Uuid,
    pub fallback_position_id: Option<Uuid>,
    pub fallback_position_name: Option<String>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub holders: Vec<HolderSummary>,
    pub recurring_task_count: i64,
}

/// DTO for creating a position
#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct CreatePositionRequest {
    pub name: String,
    pub description: Option<String>,
    pub fallback_position_id: Option<Uuid>,
}

/// DTO for updating a position
#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct UpdatePositionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub fallback_position_id: Option<Option<Uuid>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_position() -> Position {
        let now = Utc::now();
        Position {
            id: Uuid::new_v4(),
            name: "Tech Lead".to_string(),
            description: Some("Technical leadership".to_string()),
            project_id: Uuid::new_v4(),
            fallback_position_id: None,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn test_position_serde_roundtrip() {
        let pos = make_position();
        let json = serde_json::to_string(&pos).unwrap();
        let deserialized: Position = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, pos.id);
        assert_eq!(deserialized.name, "Tech Lead");
        assert!(deserialized.description.is_some());
        assert!(deserialized.fallback_position_id.is_none());
    }

    #[test]
    fn test_position_with_fallback() {
        let now = Utc::now();
        let fallback_id = Uuid::new_v4();
        let pos = Position {
            id: Uuid::new_v4(),
            name: "Junior Dev".to_string(),
            description: None,
            project_id: Uuid::new_v4(),
            fallback_position_id: Some(fallback_id),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&pos).unwrap();
        let deserialized: Position = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.fallback_position_id, Some(fallback_id));
    }

    #[test]
    fn test_position_holder_serde_roundtrip() {
        let now = Utc::now();
        let holder = PositionHolder {
            id: Uuid::new_v4(),
            position_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            assigned_at: now,
        };
        let json = serde_json::to_string(&holder).unwrap();
        let deserialized: PositionHolder = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, holder.id);
        assert_eq!(deserialized.position_id, holder.position_id);
    }

    #[test]
    fn test_holder_summary_serde_roundtrip() {
        let now = Utc::now();
        let summary = HolderSummary {
            user_id: Uuid::new_v4(),
            name: "Alice".to_string(),
            email: "alice@example.com".to_string(),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
            assigned_at: now,
        };
        let json = serde_json::to_string(&summary).unwrap();
        let deserialized: HolderSummary = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Alice");
        assert_eq!(deserialized.email, "alice@example.com");
        assert!(deserialized.avatar_url.is_some());
    }

    #[test]
    fn test_position_with_holders_serde_roundtrip() {
        let now = Utc::now();
        let pwh = PositionWithHolders {
            id: Uuid::new_v4(),
            name: "Scrum Master".to_string(),
            description: Some("Facilitates ceremonies".to_string()),
            project_id: Uuid::new_v4(),
            fallback_position_id: None,
            fallback_position_name: None,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            holders: vec![HolderSummary {
                user_id: Uuid::new_v4(),
                name: "Bob".to_string(),
                email: "bob@example.com".to_string(),
                avatar_url: None,
                assigned_at: now,
            }],
            recurring_task_count: 3,
        };
        let json = serde_json::to_string(&pwh).unwrap();
        let deserialized: PositionWithHolders = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Scrum Master");
        assert_eq!(deserialized.holders.len(), 1);
        assert_eq!(deserialized.recurring_task_count, 3);
    }

    #[test]
    fn test_create_position_request_deserialize() {
        let json = r#"{"name": "QA Lead", "description": "Quality assurance lead"}"#;
        let req: CreatePositionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, "QA Lead");
        assert_eq!(req.description, Some("Quality assurance lead".to_string()));
        assert!(req.fallback_position_id.is_none());
    }

    #[test]
    fn test_update_position_request_partial() {
        let json = r#"{"name": "Senior Dev"}"#;
        let req: UpdatePositionRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.name, Some("Senior Dev".to_string()));
        assert!(req.description.is_none());
        assert!(req.fallback_position_id.is_none());
    }
}
