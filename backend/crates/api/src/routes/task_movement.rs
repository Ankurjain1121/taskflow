use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::services::cache;
use crate::state::AppState;
use taskflow_db::models::automation::AutomationTrigger;
use taskflow_db::models::{Task, WsBoardEvent};
use taskflow_db::queries::{
    get_task_assignee_ids, get_task_board_id, get_task_status_id, is_done_status, move_task,
    validate_transition,
};
use taskflow_services::{spawn_automation_evaluation, BroadcastService, TriggerContext};

use super::common::verify_project_membership;
use super::task_helpers::{
    broadcast_workspace_task_update, get_workspace_id_for_board, MoveTaskRequest,
};

/// POST /api/tasks/:id/move
/// Move a task to a different column and/or position
pub async fn move_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<MoveTaskRequest>,
) -> Result<Json<Task>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    verify_project_membership(&state.db, board_id, tenant.user_id).await?;

    // Capture previous status_id for automation trigger + blueprint validation
    let previous_status_id = get_task_status_id(&state.db, task_id).await?;

    // Validate blueprint transition before moving
    if let Some(from_status_id) = previous_status_id {
        validate_transition(&state.db, from_status_id, body.status_id)
            .await
            .map_err(|e| match e {
                taskflow_db::queries::TaskQueryError::Other(msg) => AppError::ValidationError(msg),
                taskflow_db::queries::TaskQueryError::NotFound => {
                    AppError::NotFound("Source status not found".into())
                }
                other => AppError::from(other),
            })?;
    }

    let task = move_task(&state.db, task_id, body.status_id, body.position.clone()).await?;

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Broadcast the task moved event
    let broadcast_service = BroadcastService::new(state.redis.clone());

    let event = WsBoardEvent::TaskMoved {
        task_id,
        status_id: Some(body.status_id),
        position: body.position,
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service
        .broadcast_board_event(board_id, &event)
        .await
    {
        tracing::error!("Failed to broadcast task moved event: {}", e);
    }

    // Broadcast workspace update for team overview (task move can change status)
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        let assignee_ids = get_task_assignee_ids(&state.db, task_id)
            .await
            .unwrap_or_default();
        broadcast_workspace_task_update(
            &broadcast_service,
            workspace_id,
            task.id,
            board_id,
            &assignee_ids,
        )
        .await;
    }

    // Trigger automations for TaskMoved
    spawn_automation_evaluation(
        state.db.clone(),
        state.redis.clone(),
        AutomationTrigger::TaskMoved,
        TriggerContext {
            task_id,
            board_id,
            tenant_id: tenant.tenant_id,
            user_id: tenant.user_id,
            previous_status_id,
            new_status_id: Some(body.status_id),
            priority: None,
            member_user_id: None,
        },
    );

    // Check if the task was moved to a "done" status - trigger TaskCompleted
    let is_done = is_done_status(&state.db, body.status_id)
        .await
        .unwrap_or(false);

    if is_done {
        spawn_automation_evaluation(
            state.db.clone(),
            state.redis.clone(),
            AutomationTrigger::TaskCompleted,
            TriggerContext {
                task_id,
                board_id,
                tenant_id: tenant.tenant_id,
                user_id: tenant.user_id,
                previous_status_id,
                new_status_id: Some(body.status_id),
                priority: None,
                member_user_id: None,
            },
        );
    }

    Ok(Json(task))
}
