use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskflow_db::models::automation::AutomationTrigger;
use taskflow_db::models::{Task, TaskBroadcast, WsBoardEvent};
use taskflow_db::queries::{
    assign_user, get_task_assignee_ids, get_task_board_id, unassign_user, TaskQueryError,
};
use taskflow_services::broadcast::events;
use taskflow_services::{spawn_automation_evaluation, BroadcastService, TriggerContext};

use super::task_helpers::{
    broadcast_workspace_task_update, get_workspace_id_for_board, verify_board_membership,
    AssignUserRequest,
};

/// POST /api/tasks/:id/assignees
/// Assign a user to a task
pub async fn assign_user_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<AssignUserRequest>,
) -> Result<Json<serde_json::Value>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    // Verify the assignee is also a board member
    if !verify_board_membership(&state.db, board_id, body.user_id).await? {
        return Err(AppError::BadRequest(
            "User to assign is not a board member".into(),
        ));
    }

    assign_user(&state.db, task_id, body.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    // Broadcast the task updated event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let task = sqlx::query_as::<_, Task>(
        r#"
        SELECT
            id, title, description,
            priority as "priority: TaskPriority",
            due_date, start_date, estimated_hours,
            board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_one(&state.db)
    .await?;

    let assignee_ids = get_task_assignee_ids(&state.db, task_id).await?;

    let event = WsBoardEvent::TaskUpdated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title,
            priority: task.priority,
            column_id: task.column_id,
            position: task.position,
            assignee_ids: assignee_ids.clone(),
            updated_at: task.updated_at,
        },
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service
        .broadcast_board_event(board_id, &event)
        .await
    {
        tracing::error!("Failed to broadcast task assigned event: {}", e);
    }

    // Notify the assigned user
    if let Err(e) = broadcast_service
        .broadcast_user_update(
            body.user_id,
            events::TASK_ASSIGNED,
            json!({
                "task_id": task_id,
                "board_id": board_id,
                "assigned_by": tenant.user_id
            }),
        )
        .await
    {
        tracing::error!("Failed to broadcast user notification: {}", e);
    }

    // Broadcast workspace update for team overview (assignee change affects workload)
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        broadcast_workspace_task_update(
            &broadcast_service,
            workspace_id,
            task_id,
            board_id,
            &assignee_ids,
        )
        .await;
    }

    // Trigger automations for TaskAssigned
    spawn_automation_evaluation(
        state.db.clone(),
        AutomationTrigger::TaskAssigned,
        TriggerContext {
            task_id,
            board_id,
            tenant_id: tenant.tenant_id,
            user_id: tenant.user_id,
            previous_column_id: None,
            new_column_id: None,
            priority: None,
        },
    );

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/:id/assignees/:user_id
/// Unassign a user from a task
pub async fn unassign_user_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    unassign_user(&state.db, task_id, user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Assignment not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    // Broadcast the task updated event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let task = sqlx::query_as::<_, Task>(
        r#"
        SELECT
            id, title, description,
            priority as "priority: TaskPriority",
            due_date, start_date, estimated_hours,
            board_id, column_id, group_id, position,
            milestone_id, task_number, eisenhower_urgency, eisenhower_importance,
            tenant_id, created_by_id, deleted_at, created_at, updated_at
        FROM tasks
        WHERE id = $1 AND deleted_at IS NULL
        "#,
    )
    .bind(task_id)
    .fetch_one(&state.db)
    .await?;

    let assignee_ids = get_task_assignee_ids(&state.db, task_id).await?;

    let event = WsBoardEvent::TaskUpdated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title,
            priority: task.priority,
            column_id: task.column_id,
            position: task.position,
            assignee_ids: assignee_ids.clone(),
            updated_at: task.updated_at,
        },
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service
        .broadcast_board_event(board_id, &event)
        .await
    {
        tracing::error!("Failed to broadcast task unassigned event: {}", e);
    }

    // Broadcast workspace update for team overview (unassign affects workload)
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        // Include the removed user in the notification
        let mut all_affected = assignee_ids;
        all_affected.push(user_id);
        broadcast_workspace_task_update(
            &broadcast_service,
            workspace_id,
            task_id,
            board_id,
            &all_affected,
        )
        .await;
    }

    Ok(Json(json!({ "success": true })))
}
