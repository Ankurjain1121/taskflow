//! DTOs for project REST endpoints.
//!
//! Request and response structs used by the project route handlers.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use taskbolt_db::models::{BoardMemberRole, TaskPriority};

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub template: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub background_color: Option<Option<String>>,
}

#[derive(Debug, Deserialize)]
pub struct AddProjectMemberRequest {
    pub user_id: Uuid,
    pub role: BoardMemberRole,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectMemberRoleRequest {
    pub role: BoardMemberRole,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub prefix: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub background_color: Option<String>,
    pub is_sample: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub id: Uuid,
    pub name: String,
    pub project_id: Uuid,
    pub position: String,
    pub color: String,
    #[serde(rename = "type")]
    pub status_type: String,
    pub is_default: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectDetailResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub slack_webhook_url: Option<String>,
    pub prefix: Option<String>,
    pub workspace_id: Uuid,
    pub tenant_id: Uuid,
    pub created_by_id: Uuid,
    pub background_color: Option<String>,
    pub is_sample: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub statuses: Vec<StatusResponse>,
}

#[derive(Debug, Serialize)]
pub struct ProjectMemberResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: BoardMemberRole,
    pub joined_at: chrono::DateTime<chrono::Utc>,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    /// True if the user's access comes from workspace membership or org admin role,
    /// not from an explicit project_members row.
    pub is_implicit: bool,
}

// ============================================================================
// Project Full (batch) Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct ProjectFullQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ProjectMeta {
    pub total_task_count: i64,
    pub current_limit: i64,
    pub current_offset: i64,
}

#[derive(Debug, Serialize)]
pub struct ProjectFullResponse {
    pub project: ProjectDetailResponse,
    pub tasks: Vec<TaskWithBadges>,
    pub members: Vec<ProjectMemberResponse>,
    pub meta: ProjectMeta,
}

#[derive(Debug, Serialize)]
pub struct TaskWithBadges {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub status_id: Option<Uuid>,
    pub position: String,
    pub task_list_id: Option<Uuid>,
    pub milestone_id: Option<Uuid>,
    pub created_by_id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
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
// Duplicate Project
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DuplicateProjectRequest {
    pub name: String,
    pub include_tasks: Option<bool>,
}
