use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub workspace_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TeamMember {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_id: Uuid,
    pub added_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_team() -> Team {
        let now = Utc::now();
        Team {
            id: Uuid::new_v4(),
            name: "Engineering".to_string(),
            description: Some("Backend team".to_string()),
            color: "#3B82F6".to_string(),
            workspace_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn test_team_serde_roundtrip() {
        let team = make_team();
        let json = serde_json::to_string(&team).expect("serialize team");
        let deserialized: Team = serde_json::from_str(&json).expect("deserialize team");
        assert_eq!(deserialized.id, team.id);
        assert_eq!(deserialized.name, "Engineering");
        assert_eq!(deserialized.description, Some("Backend team".to_string()));
        assert_eq!(deserialized.color, "#3B82F6");
    }

    #[test]
    fn test_team_with_no_description() {
        let now = Utc::now();
        let team = Team {
            id: Uuid::new_v4(),
            name: "Design".to_string(),
            description: None,
            color: "#EC4899".to_string(),
            workspace_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&team).expect("serialize");
        let deserialized: Team = serde_json::from_str(&json).expect("deserialize");
        assert!(deserialized.description.is_none());
    }

    #[test]
    fn test_team_clone() {
        let team = make_team();
        let cloned = team.clone();
        assert_eq!(cloned.id, team.id);
        assert_eq!(cloned.name, team.name);
        assert_eq!(cloned.workspace_id, team.workspace_id);
    }

    #[test]
    fn test_team_debug_format() {
        let team = make_team();
        let debug = format!("{:?}", team);
        assert!(debug.contains("Team"), "Debug should contain struct name");
        assert!(debug.contains("Engineering"), "Debug should contain name");
    }

    #[test]
    fn test_team_member_serde_roundtrip() {
        let now = Utc::now();
        let member = TeamMember {
            id: Uuid::new_v4(),
            team_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            added_at: now,
        };
        let json = serde_json::to_string(&member).expect("serialize");
        let deserialized: TeamMember = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(deserialized.id, member.id);
        assert_eq!(deserialized.team_id, member.team_id);
        assert_eq!(deserialized.user_id, member.user_id);
    }

    #[test]
    fn test_team_json_field_names() {
        let team = make_team();
        let json = serde_json::to_string(&team).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("parse");
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("name").is_some());
        assert!(parsed.get("color").is_some());
        assert!(parsed.get("workspace_id").is_some());
        assert!(parsed.get("created_by_id").is_some());
        assert!(parsed.get("created_at").is_some());
        assert!(parsed.get("updated_at").is_some());
    }
}
