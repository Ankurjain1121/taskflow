use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::common::RecurrencePattern;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct RecurringTaskConfig {
    pub id: Uuid,
    pub task_id: Uuid,
    pub pattern: RecurrencePattern,
    pub cron_expression: Option<String>,
    pub interval_days: Option<i32>,
    pub next_run_at: DateTime<Utc>,
    pub last_run_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub max_occurrences: Option<i32>,
    pub occurrences_created: i32,
    pub project_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub skip_weekends: bool,
    pub days_of_week: Vec<i32>,
    pub day_of_month: Option<i32>,
    pub creation_mode: String,
    pub position_id: Option<Uuid>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recurring_task_config_serde_roundtrip() {
        let now = Utc::now();
        let config = RecurringTaskConfig {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            pattern: RecurrencePattern::Weekly,
            cron_expression: None,
            interval_days: Some(7),
            next_run_at: now,
            last_run_at: None,
            is_active: true,
            max_occurrences: Some(52),
            occurrences_created: 3,
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            end_date: None,
            skip_weekends: false,
            days_of_week: vec![1, 3, 5],
            day_of_month: None,
            creation_mode: "auto".to_string(),
            position_id: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: RecurringTaskConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, config.id);
        assert_eq!(deserialized.pattern, RecurrencePattern::Weekly);
        assert!(deserialized.is_active);
        assert_eq!(deserialized.occurrences_created, 3);
        assert_eq!(deserialized.days_of_week, vec![1, 3, 5]);
        assert_eq!(deserialized.max_occurrences, Some(52));
    }

    #[test]
    fn test_recurring_task_config_with_cron() {
        let now = Utc::now();
        let config = RecurringTaskConfig {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            pattern: RecurrencePattern::Custom,
            cron_expression: Some("0 9 * * MON".to_string()),
            interval_days: None,
            next_run_at: now,
            last_run_at: Some(now),
            is_active: true,
            max_occurrences: None,
            occurrences_created: 10,
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            end_date: Some(now),
            skip_weekends: true,
            days_of_week: vec![],
            day_of_month: Some(15),
            creation_mode: "manual".to_string(),
            position_id: Some(Uuid::new_v4()),
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: RecurringTaskConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(
            deserialized.cron_expression,
            Some("0 9 * * MON".to_string())
        );
        assert!(deserialized.skip_weekends);
        assert_eq!(deserialized.day_of_month, Some(15));
        assert!(deserialized.position_id.is_some());
        assert!(deserialized.end_date.is_some());
    }

    #[test]
    fn test_recurring_task_config_clone() {
        let now = Utc::now();
        let config = RecurringTaskConfig {
            id: Uuid::new_v4(),
            task_id: Uuid::new_v4(),
            pattern: RecurrencePattern::Daily,
            cron_expression: None,
            interval_days: Some(1),
            next_run_at: now,
            last_run_at: None,
            is_active: false,
            max_occurrences: None,
            occurrences_created: 0,
            project_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            created_by_id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            end_date: None,
            skip_weekends: false,
            days_of_week: vec![],
            day_of_month: None,
            creation_mode: "auto".to_string(),
            position_id: None,
        };
        let cloned = config.clone();
        assert_eq!(cloned.id, config.id);
        assert_eq!(cloned.pattern, config.pattern);
        assert_eq!(cloned.is_active, config.is_active);
    }
}
