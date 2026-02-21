use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Subtask {
    pub id: Uuid,
    pub title: String,
    pub is_completed: bool,
    pub position: String,
    pub task_id: Uuid,
    pub created_by_id: Uuid,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subtask_serde_roundtrip() {
        let now = Utc::now();
        let subtask = Subtask {
            id: Uuid::new_v4(),
            title: "Write tests".to_string(),
            is_completed: false,
            position: "a0".to_string(),
            task_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            completed_at: None,
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&subtask).unwrap();
        let deserialized: Subtask = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.title, "Write tests");
        assert!(!deserialized.is_completed);
        assert!(deserialized.completed_at.is_none());
    }

    #[test]
    fn test_subtask_completed() {
        let now = Utc::now();
        let subtask = Subtask {
            id: Uuid::new_v4(),
            title: "Done subtask".to_string(),
            is_completed: true,
            position: "b1".to_string(),
            task_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            completed_at: Some(now),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&subtask).unwrap();
        let deserialized: Subtask = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_completed);
        assert!(deserialized.completed_at.is_some());
    }
}
