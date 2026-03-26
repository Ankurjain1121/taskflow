//! Task collaboration handlers: assignees, watchers, and reminders.
//!
//! These endpoints manage "who interacts with a task" — assigning users,
//! watching for changes, and setting due-date reminders.

use crate::services::cache;
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::state::AppState;
use taskbolt_db::models::automation::AutomationTrigger;
use taskbolt_db::models::{TaskBroadcast, WsBoardEvent};
use taskbolt_db::queries::{
    add_watcher, assign_user, get_task_assignee_ids, get_task_board_id, get_task_row,
    get_user_display_name, list_reminders_for_task, remove_reminder, remove_watcher, set_reminder,
    unassign_user, ReminderInfo,
};
use taskbolt_services::broadcast::events;
use taskbolt_services::notifications::dispatcher::notify;
use taskbolt_services::notifications::NotificationService;
use taskbolt_services::{
    spawn_automation_evaluation, BroadcastService, NotifyContext, TriggerContext,
};

use super::common::verify_project_membership;
use super::task_helpers::{
    broadcast_workspace_task_update, get_workspace_id_for_board, AssignUserRequest,
};

// ── Watcher types ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AddWatcherRequest {
    pub user_id: Uuid,
}

// ── Reminder types ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SetReminderRequest {
    pub remind_before_minutes: i32,
}

// ── Assignment handlers ─────────────────────────────────────────────────────

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
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    // Verify the assignee is also a project member
    if !taskbolt_db::queries::verify_project_membership(&state.db, board_id, body.user_id).await? {
        return Err(AppError::BadRequest(
            "User to assign is not a project member".into(),
        ));
    }

    assign_user(&state.db, task_id, body.user_id).await?;

    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Broadcast the task updated event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let task = get_task_row(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let assignee_ids = get_task_assignee_ids(&state.db, task_id).await?;

    let event = WsBoardEvent::TaskUpdated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title,
            priority: task.priority,
            status_id: task.status_id,
            position: task.position,
            assignee_ids: assignee_ids.clone(),
            watcher_ids: taskbolt_db::queries::get_task_watcher_ids(&state.db, task_id)
                .await
                .unwrap_or_default(),
            updated_at: task.updated_at,
            changed_fields: Some(vec!["assignee_ids".to_string()]),
            origin_user_name: None,
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
        state.redis.clone(),
        AutomationTrigger::TaskAssigned,
        TriggerContext {
            task_id,
            board_id,
            tenant_id: tenant.tenant_id,
            user_id: tenant.user_id,
            previous_status_id: None,
            new_status_id: None,
            priority: None,
            member_user_id: None,
        },
    );

    // Send persistent TaskAssigned notification (fire-and-forget, skip self-notify)
    if body.user_id != tenant.user_id {
        let db = state.db.clone();
        let redis = state.redis.clone();
        let waha_client = state.waha_client.clone();
        let app_url = state.config.app_url.clone();
        let assignee_id = body.user_id;
        let assigner_id = tenant.user_id;
        tokio::spawn(async move {
            let assigner_name = get_user_display_name(&db, assigner_id)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "Someone".to_string());
            let task_title: String =
                sqlx::query_scalar("SELECT title FROM tasks WHERE id = $1 AND deleted_at IS NULL")
                    .bind(task_id)
                    .fetch_optional(&db)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| "a task".to_string());

            let notification_svc = NotificationService::new(
                db.clone(),
                BroadcastService::new(redis.clone()),
                None,
                app_url.clone(),
            );
            let title = format!("{} assigned you to a task", assigner_name);
            let body = format!("\"{}\"", task_title);
            let link = format!("/task/{}", task_id);

            let notify_ctx = NotifyContext {
                pool: &db,
                redis: &redis,
                notification_svc: &notification_svc,
                app_url: &app_url,
                slack_webhook_url: None, // TODO: get from workspace settings
                waha_client: waha_client.as_ref(),
            };
            if let Err(e) = notify(
                &notify_ctx,
                taskbolt_services::NotificationEvent::TaskAssigned,
                assignee_id,
                &title,
                &body,
                Some(&link),
            )
            .await
            {
                tracing::error!(error = %e, "Failed to dispatch TaskAssigned notification");
            }
        });
    }

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
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    unassign_user(&state.db, task_id, user_id).await?;

    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Broadcast the task updated event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let task = get_task_row(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let assignee_ids = get_task_assignee_ids(&state.db, task_id).await?;

    let event = WsBoardEvent::TaskUpdated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title,
            priority: task.priority,
            status_id: task.status_id,
            position: task.position,
            assignee_ids: assignee_ids.clone(),
            watcher_ids: taskbolt_db::queries::get_task_watcher_ids(&state.db, task_id)
                .await
                .unwrap_or_default(),
            updated_at: task.updated_at,
            changed_fields: Some(vec!["assignee_ids".to_string()]),
            origin_user_name: None,
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

// ── Watcher handlers ────────────────────────────────────────────────────────

/// POST /api/tasks/:id/watchers
pub async fn add_watcher_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<AddWatcherRequest>,
) -> Result<Json<serde_json::Value>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    add_watcher(&state.db, task_id, body.user_id).await?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/:id/watchers/:user_id
pub async fn remove_watcher_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    remove_watcher(&state.db, task_id, user_id).await?;

    Ok(Json(json!({ "success": true })))
}

// ── Reminder handlers ───────────────────────────────────────────────────────

/// POST /api/tasks/:id/reminders
pub async fn set_reminder_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<SetReminderRequest>,
) -> Result<Json<serde_json::Value>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    let reminder = set_reminder(
        &state.db,
        task_id,
        tenant.user_id,
        body.remind_before_minutes,
    )
    .await?;

    Ok(Json(json!({ "success": true, "id": reminder.id })))
}

/// GET /api/tasks/:id/reminders
pub async fn list_reminders_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<ReminderInfo>>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    let reminders = list_reminders_for_task(&state.db, task_id, tenant.user_id).await?;

    Ok(Json(reminders))
}

/// DELETE /api/tasks/:id/reminders/:reminder_id
pub async fn remove_reminder_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, reminder_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    remove_reminder(&state.db, reminder_id, tenant.user_id).await?;

    Ok(Json(json!({ "success": true })))
}
