use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct Position {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub board_id: Uuid,
    pub fallback_position_id: Option<Uuid>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct PositionHolder {
    pub id: Uuid,
    pub position_id: Uuid,
    pub user_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

/// Summary of a user holding a position (for API responses)
#[derive(FromRow, Serialize, Deserialize, Clone, Debug)]
pub struct HolderSummary {
    pub user_id: Uuid,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub assigned_at: DateTime<Utc>,
}

/// Position with holders and linked recurring task count (API response type)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PositionWithHolders {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub board_id: Uuid,
    pub fallback_position_id: Option<Uuid>,
    pub fallback_position_name: Option<String>,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub holders: Vec<HolderSummary>,
    pub recurring_task_count: i64,
}

/// DTO for creating a position
#[derive(Debug, Deserialize)]
pub struct CreatePositionRequest {
    pub name: String,
    pub description: Option<String>,
    pub fallback_position_id: Option<Uuid>,
}

/// DTO for updating a position
#[derive(Debug, Deserialize)]
pub struct UpdatePositionRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub fallback_position_id: Option<Option<Uuid>>,
}
