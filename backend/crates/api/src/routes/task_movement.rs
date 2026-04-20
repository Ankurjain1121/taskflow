use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::services::cache;
use crate::state::AppState;
use taskbolt_db::models::automation::AutomationTrigger;
use taskbolt_db::models::{Task, TaskBroadcast, WsBoardEvent};
use taskbolt_db::queries::{
    get_project_status_name, get_task_assignee_ids, get_task_board_id, get_task_status_id,
    get_task_watcher_ids, get_user_display_name, is_done_status, move_subtasks_to_project,
    move_task, move_task_to_project, strip_task_labels_for_project, validate_transition,
};
use taskbolt_services::notifications::dispatcher::notify_with_metadata;
use taskbolt_services::notifications::NotificationService;
use taskbolt_services::{
    spawn_automation_evaluation, BroadcastService, NotificationMetadata, NotifyContext,
    TriggerContext,
};

use crate::services::ActivityLogService;

use super::common::verify_project_membership;
use super::task_helpers::{
    broadcast_workspace_task_update, get_workspace_id_for_board, MoveTaskRequest,
};

/// Request body for moving a task to a different project
#[derive(Debug, Deserialize)]
pub struct MoveTaskToProjectRequest {
    pub target_project_id: Uuid,
    pub target_status_id: Uuid,
    pub position: String,
}

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
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    // Capture previous status_id for automation trigger + blueprint validation
    let previous_status_id = get_task_status_id(&state.db, task_id).await?;

    // Validate blueprint transition before moving
    if let Some(from_status_id) = previous_status_id {
        validate_transition(&state.db, from_status_id, body.status_id)
            .await
            .map_err(|e| match e {
                taskbolt_db::queries::TaskQueryError::Other(msg) => AppError::ValidationError(msg),
                taskbolt_db::queries::TaskQueryError::NotFound => {
                    AppError::NotFound("Source status not found".into())
                }
                other => AppError::from(other),
            })?;
    }

    let task = move_task_inner(
        &state,
        &tenant,
        task_id,
        board_id,
        body.status_id,
        body.position,
        previous_status_id,
    )
    .await?;

    Ok(Json(task))
}

/// Shared move pipeline — DB move, activity log, cache invalidation, WS broadcast,
/// automation evaluation, completion notifications, parent-watcher notifications.
/// Callers: `move_task_handler`, `complete_task_handler`, `uncomplete_task_handler`.
///
/// This fn assumes the caller has already verified project membership and
/// (optionally) validated the blueprint transition. It does not re-check either.
pub(super) async fn move_task_inner(
    state: &AppState,
    tenant: &TenantContext,
    task_id: Uuid,
    board_id: Uuid,
    target_status_id: Uuid,
    position: String,
    previous_status_id: Option<Uuid>,
) -> Result<Task> {
    let task = move_task(&state.db, task_id, target_status_id, position.clone()).await?;

    // Record status_changed activity when the status actually changed.
    // Fire-and-forget so a logging failure never blocks the user-visible move.
    if previous_status_id != Some(target_status_id) {
        let db = state.db.clone();
        let tenant_id = tenant.tenant_id;
        let actor_id = tenant.user_id;
        let new_status_id = target_status_id;
        let prev_status_id = previous_status_id;
        tokio::spawn(async move {
            let from_name = match prev_status_id {
                Some(id) => get_project_status_name(&db, id).await.ok().flatten(),
                None => None,
            };
            let to_name = get_project_status_name(&db, new_status_id)
                .await
                .ok()
                .flatten();

            if let Err(e) = ActivityLogService::record_status_changed(
                &db,
                task_id,
                actor_id,
                tenant_id,
                from_name.as_deref().unwrap_or(""),
                to_name.as_deref().unwrap_or(""),
            )
            .await
            {
                tracing::error!(
                    task_id = %task_id,
                    "Failed to record status_changed activity: {}",
                    e
                );
            }
        });
    }

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Broadcast the task moved event
    let broadcast_service = BroadcastService::new(state.redis.clone());

    let event = WsBoardEvent::TaskMoved {
        task_id,
        status_id: Some(target_status_id),
        position,
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
            new_status_id: Some(target_status_id),
            priority: None,
            member_user_id: None,
        },
        0,
    );

    // Check if the task was moved to a "done" status - trigger TaskCompleted
    let is_done = is_done_status(&state.db, target_status_id)
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
                new_status_id: Some(target_status_id),
                priority: None,
                member_user_id: None,
            },
            0,
        );

        // Send TaskCompleted notifications to assignees + admin alert (fire-and-forget)
        let db = state.db.clone();
        let redis = state.redis.clone();
        let waha_client = state.waha_client.clone();
        let app_url = state.config.app_url.clone();
        let completer_id = tenant.user_id;
        let task_title = task.title.clone();
        let task_due_date = task.due_date;
        let task_priority = task.priority.clone();
        let completed_board_id = board_id;
        tokio::spawn(async move {
            let completer_name = get_user_display_name(&db, completer_id)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "Someone".to_string());

            // Fetch project name for rich notification
            let project_name: Option<String> =
                sqlx::query_scalar("SELECT name FROM projects WHERE id = $1")
                    .bind(completed_board_id)
                    .fetch_optional(&db)
                    .await
                    .ok()
                    .flatten();

            let assignees = get_task_assignee_ids(&db, task_id)
                .await
                .unwrap_or_default();
            let notification_svc = NotificationService::new(
                db.clone(),
                BroadcastService::new(redis.clone()),
                None,
                app_url.clone(),
            );
            let title = format!("{} completed a task", completer_name);
            let body = format!("\"{}\" has been marked as done", task_title);
            let link = format!("/task/{}", task_id);

            let metadata = NotificationMetadata {
                actor_name: Some(completer_name.clone()),
                project_name: project_name.clone(),
                task_id: Some(task_id),
                task_title: Some(task_title.clone()),
                due_date: task_due_date,
                priority: Some(format!("{:?}", task_priority).to_lowercase()),
                ..Default::default()
            };

            let slack_webhook: Option<String> = sqlx::query_scalar(
                r#"SELECT p.slack_webhook_url FROM projects p
                   JOIN tasks t ON t.project_id = p.id
                   WHERE t.id = $1 AND t.deleted_at IS NULL"#,
            )
            .bind(task_id)
            .fetch_optional(&db)
            .await
            .ok()
            .flatten();

            let notify_ctx = NotifyContext {
                pool: &db,
                redis: &redis,
                notification_svc: &notification_svc,
                app_url: &app_url,
                slack_webhook_url: slack_webhook.as_deref(),
                waha_client: waha_client.as_ref(),
            };

            // Notify assignees
            for assignee_id in assignees {
                if assignee_id != completer_id {
                    if let Err(e) = notify_with_metadata(
                        &notify_ctx,
                        taskbolt_services::NotificationEvent::TaskCompleted,
                        assignee_id,
                        &title,
                        &body,
                        Some(&link),
                        Some(&metadata),
                    )
                    .await
                    {
                        tracing::error!(
                            assignee_id = %assignee_id,
                            error = %e,
                            "Failed to dispatch TaskCompleted notification"
                        );
                    }
                }
            }

            // --- Phase 3: Notify workspace admins on task closure ---
            if let Some(waha) = notify_ctx.waha_client {
                // Get workspace_id from the board
                let workspace_id: Option<Uuid> =
                    sqlx::query_scalar("SELECT workspace_id FROM projects WHERE id = $1")
                        .bind(completed_board_id)
                        .fetch_optional(&db)
                        .await
                        .ok()
                        .flatten();

                if let Some(ws_id) = workspace_id {
                    // Fetch workspace admins with phone numbers
                    let admins: Vec<(Uuid, String, String)> = sqlx::query_as(
                        r#"SELECT u.id, u.name, u.phone_number
                           FROM workspace_members wm
                           JOIN users u ON u.id = wm.user_id AND u.deleted_at IS NULL
                           WHERE wm.workspace_id = $1
                             AND wm.role = 'admin'
                             AND u.phone_number IS NOT NULL
                             AND u.phone_number != ''
                             AND u.id != $2"#,
                    )
                    .bind(ws_id)
                    .bind(completer_id)
                    .fetch_all(&db)
                    .await
                    .unwrap_or_default();

                    let ist = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60)
                        .expect("valid IST offset");
                    let now_ist = chrono::Utc::now().with_timezone(&ist);
                    let time_str = now_ist.format("%I:%M %p IST").to_string();

                    let admin_body = format!(
                        "\u{2705} *Task Closed*\n\n\
                         \u{1F464} *Closed by:* {}\n\
                         \u{1F4CC} *Task:* {}\n\
                         {}\
                         \u{23F0} *Time:* {}",
                        completer_name,
                        task_title,
                        project_name
                            .as_deref()
                            .map(|p| format!("\u{1F4C1} *Project:* {}\n", p))
                            .unwrap_or_default(),
                        time_str,
                    );

                    let task_url = format!("{}/task/{}", app_url, task_id);

                    for (admin_id, _admin_name, admin_phone) in &admins {
                        if let Err(e) = waha
                            .send_link_message(admin_phone, &admin_body, &task_url)
                            .await
                        {
                            tracing::error!(
                                admin_id = %admin_id,
                                error = %e,
                                "Failed to send task closure alert to admin"
                            );
                        }
                    }
                }
            }

            // --- Phase 4: Notify parent task watchers if this is a subtask ---
            let parent_info: Option<(Uuid, String, i32, i32)> = sqlx::query_as(
                r#"SELECT pt.id, pt.title, pt.child_count, pt.completed_child_count
                   FROM tasks t
                   JOIN tasks pt ON pt.id = t.parent_task_id AND pt.deleted_at IS NULL
                   WHERE t.id = $1 AND t.parent_task_id IS NOT NULL"#,
            )
            .bind(task_id)
            .fetch_optional(&db)
            .await
            .ok()
            .flatten();

            if let Some((parent_id, parent_title, child_count, completed_count)) = parent_info {
                let watcher_ids = get_task_watcher_ids(&db, parent_id)
                    .await
                    .unwrap_or_default();

                if !watcher_ids.is_empty() {
                    let progress_meta = NotificationMetadata {
                        actor_name: Some(completer_name.clone()),
                        project_name: project_name.clone(),
                        task_id: Some(parent_id),
                        task_title: Some(parent_title.clone()),
                        subtask_progress: Some((completed_count as i64, child_count as i64)),
                        ..Default::default()
                    };

                    let watcher_title = format!("Subtask completed on \"{}\"", parent_title);
                    let watcher_body =
                        format!("{} completed subtask \"{}\"", completer_name, task_title);
                    let parent_link = format!("/task/{}", parent_id);

                    for watcher_id in watcher_ids {
                        if watcher_id != completer_id {
                            if let Err(e) = notify_with_metadata(
                                &notify_ctx,
                                taskbolt_services::NotificationEvent::TaskUpdatedWatcher,
                                watcher_id,
                                &watcher_title,
                                &watcher_body,
                                Some(&parent_link),
                                Some(&progress_meta),
                            )
                            .await
                            {
                                tracing::error!(
                                    watcher_id = %watcher_id,
                                    error = %e,
                                    "Failed to notify parent task watcher on subtask completion"
                                );
                            }
                        }
                    }
                }
            }
        });
    }

    Ok(task)
}

/// POST /api/tasks/:id/move-to-project
/// Move a task (and its subtasks) to a different project
pub async fn move_task_to_project_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<MoveTaskToProjectRequest>,
) -> Result<Json<Task>> {
    // 1. Get the task to find its current project_id
    let source_project_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Prevent no-op moves
    if source_project_id == body.target_project_id {
        return Err(AppError::BadRequest(
            "Task is already in the target project".into(),
        ));
    }

    // 2. Verify user membership in BOTH source and target projects
    verify_project_membership(&state.db, source_project_id, tenant.user_id, &tenant.role).await?;
    verify_project_membership(
        &state.db,
        body.target_project_id,
        tenant.user_id,
        &tenant.role,
    )
    .await?;

    // 3. Verify target_status_id belongs to target_project_id
    let status_exists = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM project_statuses WHERE id = $1 AND project_id = $2",
    )
    .bind(body.target_status_id)
    .bind(body.target_project_id)
    .fetch_optional(&state.db)
    .await?;

    if status_exists.is_none() {
        return Err(AppError::BadRequest(
            "Target status does not belong to target project".into(),
        ));
    }

    // Capture previous status_id for activity logging before moving.
    let previous_status_id = get_task_status_id(&state.db, task_id).await?;

    // 4. Update the task: move to new project, status, position
    let task = move_task_to_project(
        &state.db,
        task_id,
        body.target_project_id,
        body.target_status_id,
        body.position.clone(),
    )
    .await?;

    // Record status_changed activity when the status actually changed.
    // Fire-and-forget — never blocks the move itself.
    if previous_status_id != Some(body.target_status_id) {
        let db = state.db.clone();
        let tenant_id = tenant.tenant_id;
        let actor_id = tenant.user_id;
        let new_status_id = body.target_status_id;
        let prev_status_id = previous_status_id;
        tokio::spawn(async move {
            let from_name = match prev_status_id {
                Some(id) => get_project_status_name(&db, id).await.ok().flatten(),
                None => None,
            };
            let to_name = get_project_status_name(&db, new_status_id)
                .await
                .ok()
                .flatten();

            if let Err(e) = ActivityLogService::record_status_changed(
                &db,
                task_id,
                actor_id,
                tenant_id,
                from_name.as_deref().unwrap_or(""),
                to_name.as_deref().unwrap_or(""),
            )
            .await
            {
                tracing::error!(
                    task_id = %task_id,
                    "Failed to record status_changed activity on cross-project move: {}",
                    e
                );
            }
        });
    }

    // 5. Strip project-scoped labels from the task
    if let Err(e) = strip_task_labels_for_project(&state.db, task_id, source_project_id).await {
        tracing::error!("Failed to strip labels from moved task: {}", e);
    }

    // 6. Move subtasks to the same target project and status
    let subtask_ids = move_subtasks_to_project(
        &state.db,
        task_id,
        body.target_project_id,
        body.target_status_id,
    )
    .await
    .unwrap_or_default();

    // 7. Strip labels from subtasks too
    for subtask_id in &subtask_ids {
        if let Err(e) =
            strip_task_labels_for_project(&state.db, *subtask_id, source_project_id).await
        {
            tracing::error!(
                subtask_id = %subtask_id,
                "Failed to strip labels from moved subtask: {}", e
            );
        }
    }

    // 8. Invalidate cache for BOTH projects
    cache::cache_del(&state.redis, &cache::project_tasks_key(&source_project_id)).await;
    cache::cache_del(
        &state.redis,
        &cache::project_tasks_key(&body.target_project_id),
    )
    .await;

    // 9. Broadcast events: TaskDeleted to source, TaskCreated to target
    let broadcast_service = BroadcastService::new(state.redis.clone());

    // Source project: task disappeared
    let delete_event = WsBoardEvent::TaskDeleted {
        task_id,
        origin_user_id: tenant.user_id,
    };
    if let Err(e) = broadcast_service
        .broadcast_board_event(source_project_id, &delete_event)
        .await
    {
        tracing::error!("Failed to broadcast TaskDeleted to source project: {}", e);
    }

    // Target project: task appeared
    let assignee_ids = get_task_assignee_ids(&state.db, task_id)
        .await
        .unwrap_or_default();
    let watcher_ids = get_task_watcher_ids(&state.db, task_id)
        .await
        .unwrap_or_default();

    let create_event = WsBoardEvent::TaskCreated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title.clone(),
            priority: task.priority.clone(),
            status_id: task.status_id,
            position: task.position.clone(),
            assignee_ids: assignee_ids.clone(),
            watcher_ids,
            updated_at: task.updated_at,
            changed_fields: None,
            origin_user_name: None,
        },
        origin_user_id: tenant.user_id,
    };
    if let Err(e) = broadcast_service
        .broadcast_board_event(body.target_project_id, &create_event)
        .await
    {
        tracing::error!("Failed to broadcast TaskCreated to target project: {}", e);
    }

    // Broadcast workspace updates for both projects
    if let Ok(Some(ws_id)) = get_workspace_id_for_board(&state.db, source_project_id).await {
        broadcast_workspace_task_update(
            &broadcast_service,
            ws_id,
            task_id,
            source_project_id,
            &assignee_ids,
        )
        .await;
    }
    if let Ok(Some(ws_id)) = get_workspace_id_for_board(&state.db, body.target_project_id).await {
        broadcast_workspace_task_update(
            &broadcast_service,
            ws_id,
            task_id,
            body.target_project_id,
            &assignee_ids,
        )
        .await;
    }

    // 10. Return the updated task
    Ok(Json(task))
}
