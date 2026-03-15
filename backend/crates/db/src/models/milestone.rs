use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Milestone {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub color: String,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_milestone_serde_roundtrip() {
        let now = Utc::now();
        let milestone = Milestone {
            id: Uuid::new_v4(),
            name: "v1.0 Release".to_string(),
            description: Some("First major release".to_string()),
            due_date: Some(now),
            color: "#10B981".to_string(),
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&milestone).unwrap();
        let deserialized: Milestone = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "v1.0 Release");
        assert_eq!(deserialized.color, "#10B981");
        assert!(deserialized.due_date.is_some());
    }

    #[test]
    fn test_milestone_minimal() {
        let now = Utc::now();
        let milestone = Milestone {
            id: Uuid::new_v4(),
            name: "Milestone 1".to_string(),
            description: None,
            due_date: None,
            color: "#6B7280".to_string(),
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&milestone).unwrap();
        let deserialized: Milestone = serde_json::from_str(&json).unwrap();
        assert!(deserialized.description.is_none());
        assert!(deserialized.due_date.is_none());
    }
}
