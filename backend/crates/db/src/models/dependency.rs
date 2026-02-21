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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_dependency_serde_roundtrip() {
        let now = Utc::now();
        let dep = TaskDependency {
            id: Uuid::new_v4(),
            source_task_id: Uuid::new_v4(),
            target_task_id: Uuid::new_v4(),
            dependency_type: DependencyType::Blocks,
            created_by_id: Uuid::new_v4(),
            created_at: now,
        };
        let json = serde_json::to_string(&dep).unwrap();
        let deserialized: TaskDependency = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, dep.id);
        assert_eq!(deserialized.dependency_type, DependencyType::Blocks);
    }

    #[test]
    fn test_all_dependency_types() {
        let now = Utc::now();
        for dep_type in [
            DependencyType::Blocks,
            DependencyType::BlockedBy,
            DependencyType::Related,
        ] {
            let dep = TaskDependency {
                id: Uuid::new_v4(),
                source_task_id: Uuid::new_v4(),
                target_task_id: Uuid::new_v4(),
                dependency_type: dep_type.clone(),
                created_by_id: Uuid::new_v4(),
                created_at: now,
            };
            let json = serde_json::to_string(&dep).unwrap();
            let deserialized: TaskDependency = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized.dependency_type, dep_type);
        }
    }
}
