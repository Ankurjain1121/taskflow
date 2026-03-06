//! DTOs for board REST endpoints.
//!
//! Request and response structs used by the board route handlers.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskflow_db::models::{BoardMemberRole, TaskPriority};

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateBoardRequest {
    pub name: String,
    pub description: Option<String>,
    pub template: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBoardRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub background_color: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AddBoardMemberRequest {
    pub user_id: Uuid,
    pub role: BoardMemberRole,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBoardMemberRoleRequest {
    pub role: BoardMemberRole,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BoardResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub prefix: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub background_color: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct BoardDetailResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub prefix: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub background_color: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub columns: Vec<ColumnResponse>,
}

#[derive(Debug, Serialize)]
pub struct ColumnResponse {
    pub id: Uuid,
    pub name: String,
    pub board_id: Uuid,
    pub position: String,
    pub color: Option<String>,
    pub status_mapping: Option<serde_json::Value>,
    pub wip_limit: Option<i32>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct BoardMemberResponse {
    pub id: Uuid,
    pub board_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
}

// ============================================================================
// Board Full (batch) Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct BoardFullQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct BoardMeta {
    pub total_task_count: i64,
    pub current_limit: i64,
    pub current_offset: i64,
}

#[derive(Debug, Serialize)]
pub struct BoardFullResponse {
    pub board: BoardDetailResponse,
    pub tasks: Vec<TaskWithBadges>,
    pub members: Vec<BoardMemberResponse>,
    pub meta: BoardMeta,
}

#[derive(Debug, Serialize)]
pub struct TaskWithBadges {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub column_id: Uuid,
    pub position: String,
    pub group_id: Option<Uuid>,
    pub milestone_id: Option<Uuid>,
    pub created_by_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub column_entered_at: chrono::DateTime<chrono::Utc>,
    pub parent_task_id: Option<Uuid>,
    pub subtask_completed: i64,
    pub subtask_total: i64,
    pub has_running_timer: bool,
    pub comment_count: i64,
    pub assignees: Vec<AssigneeInfo>,
    pub labels: Vec<LabelInfo>,
}

#[derive(Debug, Serialize)]
pub struct AssigneeInfo {
    pub id: Uuid,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LabelInfo {
    pub id: Uuid,
    pub name: String,
    pub color: String,
}

// ============================================================================
// Duplicate Board
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DuplicateBoardRequest {
    pub name: String,
    pub include_tasks: Option<bool>,
}
