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
