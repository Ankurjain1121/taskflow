use axum::{
    extract::{Path, State},
    Json,
};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskflow_db::models::automation::AutomationTrigger;
use taskflow_db::models::{Task, WsBoardEvent};
use taskflow_db::queries::{get_task_assignee_ids, get_task_board_id, move_task};
use taskflow_services::{spawn_automation_evaluation, BroadcastService, TriggerContext};

use super::task_helpers::{
    broadcast_workspace_task_update, get_workspace_id_for_board, verify_board_membership,
    MoveTaskRequest,
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
    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    // Capture previous column_id for automation trigger
    let previous_column_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT column_id FROM tasks WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(task_id)
    .fetch_optional(&state.db)
    .await?;

    let task = move_task(&state.db, task_id, body.column_id, body.position.clone()).await?;

    // Broadcast the task moved event
    let broadcast_service = BroadcastService::new(state.redis.clone());

    let event = WsBoardEvent::TaskMoved {
        task_id,
        column_id: body.column_id,
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
            previous_column_id,
            new_column_id: Some(body.column_id),
            priority: None,
            member_user_id: None,
        },
    );

    // Check if the task was moved to a "done" column - trigger TaskCompleted
    let is_done_column = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT COALESCE((status_mapping->>'done')::boolean, false)
        FROM board_columns WHERE id = $1
        "#,
    )
    .bind(body.column_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .unwrap_or(false);

    if is_done_column {
        spawn_automation_evaluation(
            state.db.clone(),
            state.redis.clone(),
            AutomationTrigger::TaskCompleted,
            TriggerContext {
                task_id,
                board_id,
                tenant_id: tenant.tenant_id,
                user_id: tenant.user_id,
                previous_column_id,
                new_column_id: Some(body.column_id),
                priority: None,
                member_user_id: None,
            },
        );
    }

    Ok(Json(task))
}
