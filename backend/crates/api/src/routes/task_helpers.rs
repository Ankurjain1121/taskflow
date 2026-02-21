use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::Result;
use taskflow_db::models::TaskPriority;
use taskflow_services::broadcast::events;
use taskflow_services::BroadcastService;

/// Response for listing tasks by board
#[derive(serde::Serialize)]
pub struct ListTasksResponse {
    pub tasks: std::collections::HashMap<Uuid, Vec<taskflow_db::models::Task>>,
}

/// Request body for creating a task
#[derive(Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: TaskPriority,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    pub estimated_hours: Option<f64>,
    pub column_id: Uuid,
    pub milestone_id: Option<Uuid>,
    pub group_id: Option<Uuid>,
    pub assignee_ids: Option<Vec<Uuid>>,
    pub label_ids: Option<Vec<Uuid>>,
}

/// Request body for updating a task
#[derive(Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<TaskPriority>,
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    pub estimated_hours: Option<f64>,
    pub milestone_id: Option<Uuid>,
    pub clear_description: Option<bool>,
    pub clear_due_date: Option<bool>,
    pub clear_start_date: Option<bool>,
    pub clear_estimated_hours: Option<bool>,
    pub clear_milestone: Option<bool>,
}

/// Request body for moving a task
#[derive(Deserialize)]
pub struct MoveTaskRequest {
    pub column_id: Uuid,
    pub position: String,
}

/// Request body for assigning a user
#[derive(Deserialize)]
pub struct AssignUserRequest {
    pub user_id: Uuid,
}

/// Helper to get workspace_id from board_id
pub async fn get_workspace_id_for_board(
    pool: &sqlx::PgPool,
    board_id: Uuid,
) -> std::result::Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        SELECT workspace_id FROM boards WHERE id = $1 AND deleted_at IS NULL
        "#,
        board_id
    )
    .fetch_optional(pool)
    .await
}

/// Helper to verify a user is a board member
pub async fn verify_board_membership(
    pool: &sqlx::PgPool,
    board_id: Uuid,
    user_id: Uuid,
) -> Result<bool> {
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        user_id
    )
    .fetch_one(pool)
    .await?;

    Ok(is_member)
}

/// Helper to broadcast workspace update after task mutation
pub async fn broadcast_workspace_task_update(
    broadcast_service: &BroadcastService,
    workspace_id: Uuid,
    task_id: Uuid,
    board_id: Uuid,
    assignee_ids: &[Uuid],
) {
    // Broadcast to workspace channel
    if let Err(e) = broadcast_service
        .broadcast_workspace_update(
            workspace_id,
            events::WORKLOAD_CHANGED,
            json!({
                "task_id": task_id,
                "board_id": board_id
            }),
        )
        .await
    {
        tracing::error!("Failed to broadcast workspace update: {}", e);
    }

    // Broadcast to each assignee's user channel
    for assignee_id in assignee_ids {
        if let Err(e) = broadcast_service
            .broadcast_user_update(
                *assignee_id,
                events::TASK_UPDATED,
                json!({
                    "task_id": task_id,
                    "board_id": board_id,
                    "workspace_id": workspace_id
                }),
            )
            .await
        {
            tracing::error!("Failed to broadcast user task update: {}", e);
        }
    }
}
