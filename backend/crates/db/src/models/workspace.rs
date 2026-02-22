use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::common::{WorkspaceMemberRole, WorkspaceVisibility};

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub visibility: WorkspaceVisibility,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceMember {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub user_id: Uuid,
    pub role: WorkspaceMemberRole,
    pub joined_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_serde_roundtrip() {
        let now = Utc::now();
        let ws = Workspace {
            id: Uuid::new_v4(),
            name: "My Workspace".to_string(),
            description: Some("A description".to_string()),
            logo_url: None,
            visibility: WorkspaceVisibility::Closed,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&ws).unwrap();
        let deserialized: Workspace = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, ws.id);
        assert_eq!(deserialized.name, ws.name);
        assert_eq!(deserialized.description, ws.description);
        assert_eq!(deserialized.tenant_id, ws.tenant_id);
        assert_eq!(deserialized.created_by_id, ws.created_by_id);
        assert!(deserialized.deleted_at.is_none());
    }

    #[test]
    fn test_workspace_with_deleted_at() {
        let now = Utc::now();
        let ws = Workspace {
            id: Uuid::new_v4(),
            name: "Deleted WS".to_string(),
            description: None,
            logo_url: None,
            visibility: WorkspaceVisibility::Closed,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: Some(now),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&ws).unwrap();
        let deserialized: Workspace = serde_json::from_str(&json).unwrap();
        assert!(deserialized.deleted_at.is_some());
    }

    #[test]
    fn test_workspace_clone() {
        let now = Utc::now();
        let ws = Workspace {
            id: Uuid::new_v4(),
            name: "Clone Test".to_string(),
            description: None,
            logo_url: None,
            visibility: WorkspaceVisibility::Closed,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
        };
        let cloned = ws.clone();
        assert_eq!(cloned.id, ws.id);
        assert_eq!(cloned.name, ws.name);
    }

    #[test]
    fn test_workspace_member_serde_roundtrip() {
        let now = Utc::now();
        let member = WorkspaceMember {
            id: Uuid::new_v4(),
            workspace_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            role: WorkspaceMemberRole::Member,
            joined_at: now,
        };
        let json = serde_json::to_string(&member).unwrap();
        let deserialized: WorkspaceMember = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, member.id);
        assert_eq!(deserialized.workspace_id, member.workspace_id);
        assert_eq!(deserialized.user_id, member.user_id);
    }

    #[test]
    fn test_workspace_json_field_names() {
        let now = Utc::now();
        let ws = Workspace {
            id: Uuid::new_v4(),
            name: "Field Names".to_string(),
            description: None,
            logo_url: None,
            visibility: WorkspaceVisibility::Closed,
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&ws).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("name").is_some());
        assert!(parsed.get("description").is_some());
        assert!(parsed.get("tenant_id").is_some());
        assert!(parsed.get("created_by_id").is_some());
        assert!(parsed.get("deleted_at").is_some());
        assert!(parsed.get("created_at").is_some());
        assert!(parsed.get("updated_at").is_some());
    }
}
