use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TimeEntry {
    pub id: Uuid,
    pub task_id: Uuid,
    pub user_id: Uuid,
    pub description: Option<String>,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_minutes: Option<i32>,
    pub is_running: bool,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_billable: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_time_entry() -> TimeEntry {
        let now = Utc::now();
        TimeEntry {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            description: Some("Working on feature".to_string()),
            started_at: now,
            ended_at: Some(now),
            duration_minutes: Some(120),
            is_running: false,
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            is_billable: true,
        }
    }

    #[test]
    fn test_time_entry_serde_roundtrip() {
        let entry = make_time_entry();
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: TimeEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, entry.id);
        assert_eq!(
            deserialized.description,
            Some("Working on feature".to_string())
        );
        assert_eq!(deserialized.duration_minutes, Some(120));
        assert!(!deserialized.is_running);
        assert!(deserialized.is_billable);
    }

    #[test]
    fn test_time_entry_running() {
        let now = Utc::now();
        let entry = TimeEntry {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            description: None,
            started_at: now,
            ended_at: None,
            duration_minutes: None,
            is_running: true,
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            is_billable: false,
        };
        let json = serde_json::to_string(&entry).unwrap();
        let deserialized: TimeEntry = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_running);
        assert!(deserialized.ended_at.is_none());
        assert!(deserialized.duration_minutes.is_none());
        assert!(!deserialized.is_billable);
    }

    #[test]
    fn test_time_entry_json_field_names() {
        let entry = make_time_entry();
        let parsed: serde_json::Value = serde_json::to_value(&entry).unwrap();
        assert!(parsed.get("id").is_some());
        assert!(parsed.get("task_id").is_some());
        assert!(parsed.get("user_id").is_some());
        assert!(parsed.get("started_at").is_some());
        assert!(parsed.get("is_running").is_some());
        assert!(parsed.get("is_billable").is_some());
        assert!(parsed.get("duration_minutes").is_some());
    }

    #[test]
    fn test_time_entry_clone() {
        let entry = make_time_entry();
        let cloned = entry.clone();
        assert_eq!(cloned.id, entry.id);
        assert_eq!(cloned.duration_minutes, entry.duration_minutes);
        assert_eq!(cloned.is_billable, entry.is_billable);
    }
}
