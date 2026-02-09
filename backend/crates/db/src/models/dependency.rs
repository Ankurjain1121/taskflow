use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::common::DependencyType;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct TaskDependency {
    pub id: Uuid,
    pub source_task_id: Uuid,
    pub target_task_id: Uuid,
    pub dependency_type: DependencyType,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
}
