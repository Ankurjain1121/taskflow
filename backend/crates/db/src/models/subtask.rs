use chrono::{DateTime, NaiveDate, Utc};
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
    pub assigned_to_id: Option<Uuid>,
    pub due_date: Option<NaiveDate>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Extended subtask with assignee info from JOIN
#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct SubtaskWithAssignee {
    pub id: Uuid,
    pub title: String,
    pub is_completed: bool,
    pub position: String,
    pub task_id: Uuid,
    pub created_by_id: Uuid,
    pub assigned_to_id: Option<Uuid>,
    pub due_date: Option<NaiveDate>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub assignee_name: Option<String>,
    pub assignee_avatar_url: Option<String>,
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
            assigned_to_id: None,
            due_date: None,
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
            assigned_to_id: Some(Uuid::new_v4()),
            due_date: Some(NaiveDate::from_ymd_opt(2026, 3, 15).expect("valid date")),
            completed_at: Some(now),
            created_at: now,
            updated_at: now,
        };
        let json = serde_json::to_string(&subtask).unwrap();
        let deserialized: Subtask = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_completed);
        assert!(deserialized.completed_at.is_some());
        assert!(deserialized.assigned_to_id.is_some());
        assert!(deserialized.due_date.is_some());
    }
}
