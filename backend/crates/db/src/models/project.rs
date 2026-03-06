use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::ProjectMemberRole;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub prefix: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub background_color: Option<String>,
    pub is_sample: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectMember {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: ProjectMemberRole,
    pub joined_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectColumn {
    pub id: Uuid,
    pub name: String,
    pub project_id: Uuid,
    pub position: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
    pub wip_limit: Option<i32>,
    pub icon: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_serde_roundtrip() {
        let now = Utc::now();
        let project = Project {
            id: Uuid::new_v4(),
            name: "Sprint Project".to_string(),
            description: Some("Sprint planning project".to_string()),
            slack_webhook_url: Some("https://hooks.slack.com/test".to_string()),
            prefix: Some("SPRI".to_string()),
            workspace_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            background_color: None,
            is_sample: false,
            deleted_at: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&project).unwrap();
        let deserialized: Project = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, project.id);
        assert_eq!(deserialized.name, "Sprint Project");
        assert_eq!(
            deserialized.description,
            Some("Sprint planning project".to_string())
        );
        assert!(deserialized.deleted_at.is_none());
    }

    #[test]
    fn test_project_with_deleted_at() {
        let now = Utc::now();
        let project = Project {
            id: Uuid::new_v4(),
            name: "Deleted Project".to_string(),
            description: None,
            slack_webhook_url: None,
            prefix: None,
            workspace_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            background_color: None,
            is_sample: false,
            deleted_at: Some(now),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&project).unwrap();
        let deserialized: Project = serde_json::from_str(&json).unwrap();
        assert!(deserialized.deleted_at.is_some());
    }

    #[test]
    fn test_project_member_serde_roundtrip() {
        let now = Utc::now();
        let member = ProjectMember {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            role: ProjectMemberRole::Editor,
            joined_at: now,
        };
        let json = serde_json::to_string(&member).unwrap();
        let deserialized: ProjectMember = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, member.id);
        assert_eq!(deserialized.role, ProjectMemberRole::Editor);
    }

    #[test]
    fn test_project_member_viewer_role() {
        let now = Utc::now();
        let member = ProjectMember {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            role: ProjectMemberRole::Viewer,
            joined_at: now,
        };
        let json = serde_json::to_string(&member).unwrap();
        let deserialized: ProjectMember = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.role, ProjectMemberRole::Viewer);
    }

    #[test]
    fn test_project_column_serde_roundtrip() {
        let now = Utc::now();
        let col = ProjectColumn {
            id: Uuid::new_v4(),
            name: "In Progress".to_string(),
            project_id: Uuid::new_v4(),
            position: "a1".to_string(),
            color: Some("#3B82F6".to_string()),
            status_mapping: Some(serde_json::json!({"status": "in_progress"})),
            wip_limit: Some(5),
            icon: None,
            created_at: now,
        };
        let json = serde_json::to_string(&col).unwrap();
        let deserialized: ProjectColumn = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "In Progress");
        assert_eq!(deserialized.color, Some("#3B82F6".to_string()));
        assert!(deserialized.status_mapping.is_some());
    }

    #[test]
    fn test_project_column_none_optional_fields() {
        let now = Utc::now();
        let col = ProjectColumn {
            id: Uuid::new_v4(),
            name: "Backlog".to_string(),
            project_id: Uuid::new_v4(),
            position: "a0".to_string(),
            color: None,
            status_mapping: None,
            wip_limit: None,
            icon: None,
            created_at: now,
        };
        let json = serde_json::to_string(&col).unwrap();
        let deserialized: ProjectColumn = serde_json::from_str(&json).unwrap();
        assert!(deserialized.color.is_none());
        assert!(deserialized.status_mapping.is_none());
    }
}
