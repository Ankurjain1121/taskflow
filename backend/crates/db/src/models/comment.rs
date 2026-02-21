use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Comment {
    pub id: Uuid,
    pub content: String,
    pub task_id: Uuid,
    pub author_id: Uuid,
    pub parent_id: Option<Uuid>,
    pub mentioned_user_ids: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_comment_serde_roundtrip() {
        let now = Utc::now();
        let comment = Comment {
            id: Uuid::new_v4(),
            content: "This is a comment".to_string(),
            task_id: Uuid::new_v4(),
            author_id: Uuid::new_v4(),
            parent_id: None,
            mentioned_user_ids: serde_json::json!([]),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&comment).unwrap();
        let deserialized: Comment = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, comment.id);
        assert_eq!(deserialized.content, "This is a comment");
        assert!(deserialized.parent_id.is_none());
    }

    #[test]
    fn test_comment_with_parent_and_mentions() {
        let now = Utc::now();
        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();
        let comment = Comment {
            id: Uuid::new_v4(),
            content: "Reply with @mention".to_string(),
            task_id: Uuid::new_v4(),
            author_id: Uuid::new_v4(),
            parent_id: Some(Uuid::new_v4()),
            mentioned_user_ids: serde_json::json!([user1.to_string(), user2.to_string()]),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&comment).unwrap();
        let deserialized: Comment = serde_json::from_str(&json).unwrap();
        assert!(deserialized.parent_id.is_some());
        assert!(deserialized.mentioned_user_ids.is_array());
        assert_eq!(deserialized.mentioned_user_ids.as_array().unwrap().len(), 2);
    }
}
