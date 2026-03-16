use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::BoardMemberRole;

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

/// Backward-compatible alias — prefer `Project` in new code.
pub type Board = Project;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectMember {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: DateTime<Utc>,
    pub billing_rate_cents: Option<i32>,
}

/// Backward-compatible alias — prefer `ProjectMember` in new code.
pub type BoardMember = ProjectMember;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct ProjectStatus {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub color: String,
    #[sqlx(rename = "type")]
    pub status_type: String,
    pub position: String,
    pub is_default: bool,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
    /// NULL = allow all transitions (backward compat), empty = terminal status
    pub allowed_transitions: Option<Vec<Uuid>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_serde_roundtrip() {
        let now = Utc::now();
        let project = Project {
            id: Uuid::new_v4(),
            name: "Dev Project".to_string(),
            description: Some("Dev planning project".to_string()),
            slack_webhook_url: None,
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
        assert_eq!(deserialized.name, "Dev Project");
    }

    #[test]
    fn test_project_member_serde_roundtrip() {
        let now = Utc::now();
        let member = ProjectMember {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            role: BoardMemberRole::Editor,
            joined_at: now,
            billing_rate_cents: None,
        };
        let json = serde_json::to_string(&member).unwrap();
        let deserialized: ProjectMember = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, member.id);
        assert_eq!(deserialized.role, BoardMemberRole::Editor);
    }
}
