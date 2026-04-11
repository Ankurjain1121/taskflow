use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectGroup {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub color: String,
    pub position: String,
    pub description: Option<String>,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_group_serde_roundtrip() {
        let now = Utc::now();
        let group = ProjectGroup {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            name: "Q3 Launches".to_string(),
            color: "#BF7B54".to_string(),
            position: "a0".to_string(),
            description: Some("Launches planned for Q3 2026".to_string()),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&group).unwrap();
        let deserialized: ProjectGroup = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "Q3 Launches");
        assert_eq!(deserialized.color, "#BF7B54");
    }

    #[test]
    fn test_project_group_minimal() {
        let now = Utc::now();
        let group = ProjectGroup {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            name: "Ungrouped".to_string(),
            color: "#6B7280".to_string(),
            position: "a0".to_string(),
            description: None,
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&group).unwrap();
        let deserialized: ProjectGroup = serde_json::from_str(&json).unwrap();
        assert!(deserialized.description.is_none());
    }
}
