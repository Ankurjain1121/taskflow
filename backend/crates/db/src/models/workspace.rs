use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Workspace {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
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
    pub joined_at: DateTime<Utc>,
}
