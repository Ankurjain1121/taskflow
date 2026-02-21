use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::common::BoardMemberRole;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Board {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub deleted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardMember {
    pub id: Uuid,
    pub board_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct BoardColumn {
    pub id: Uuid,
    pub name: String,
    pub board_id: Uuid,
    pub position: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_board_serde_roundtrip() {
        let now = Utc::now();
        let board = Board {
            id: Uuid::new_v4(),
            name: "Sprint Board".to_string(),
            description: Some("Sprint planning board".to_string()),
            slack_webhook_url: Some("https://hooks.slack.com/test".to_string()),
            workspace_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&board).unwrap();
        let deserialized: Board = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, board.id);
        assert_eq!(deserialized.name, "Sprint Board");
        assert_eq!(
            deserialized.description,
            Some("Sprint planning board".to_string())
        );
        assert!(deserialized.deleted_at.is_none());
    }

    #[test]
    fn test_board_with_deleted_at() {
        let now = Utc::now();
        let board = Board {
            id: Uuid::new_v4(),
            name: "Deleted Board".to_string(),
            description: None,
            slack_webhook_url: None,
            workspace_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            deleted_at: Some(now),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&board).unwrap();
        let deserialized: Board = serde_json::from_str(&json).unwrap();
        assert!(deserialized.deleted_at.is_some());
    }

    #[test]
    fn test_board_member_serde_roundtrip() {
        let now = Utc::now();
        let member = BoardMember {
            id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            role: BoardMemberRole::Editor,
            joined_at: now,
        };
        let json = serde_json::to_string(&member).unwrap();
        let deserialized: BoardMember = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, member.id);
        assert_eq!(deserialized.role, BoardMemberRole::Editor);
    }

    #[test]
    fn test_board_member_viewer_role() {
        let now = Utc::now();
        let member = BoardMember {
            id: Uuid::new_v4(),
            board_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            role: BoardMemberRole::Viewer,
            joined_at: now,
        };
        let json = serde_json::to_string(&member).unwrap();
        let deserialized: BoardMember = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.role, BoardMemberRole::Viewer);
    }

    #[test]
    fn test_board_column_serde_roundtrip() {
        let now = Utc::now();
        let col = BoardColumn {
            id: Uuid::new_v4(),
            name: "In Progress".to_string(),
            board_id: Uuid::new_v4(),
            position: "a1".to_string(),
            color: Some("#3B82F6".to_string()),
            status_mapping: Some(serde_json::json!({"status": "in_progress"})),
            created_at: now,
        };
        let json = serde_json::to_string(&col).unwrap();
        let deserialized: BoardColumn = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "In Progress");
        assert_eq!(deserialized.color, Some("#3B82F6".to_string()));
        assert!(deserialized.status_mapping.is_some());
    }

    #[test]
    fn test_board_column_none_optional_fields() {
        let now = Utc::now();
        let col = BoardColumn {
            id: Uuid::new_v4(),
            name: "Backlog".to_string(),
            board_id: Uuid::new_v4(),
            position: "a0".to_string(),
            color: None,
            status_mapping: None,
            created_at: now,
        };
        let json = serde_json::to_string(&col).unwrap();
        let deserialized: BoardColumn = serde_json::from_str(&json).unwrap();
        assert!(deserialized.color.is_none());
        assert!(deserialized.status_mapping.is_none());
    }
}
