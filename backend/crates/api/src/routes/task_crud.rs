use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::services::cache;
use crate::state::AppState;
use taskbolt_db::models::automation::AutomationTrigger;
use taskbolt_db::models::{Task, TaskBroadcast, WsBoardEvent};
use taskbolt_db::queries::{
    create_task, duplicate_task, find_done_status, find_non_done_status, get_task_assignee_ids,
    get_task_board_id, get_task_by_id, get_task_row, get_user_display_name, list_tasks_by_board,
    soft_delete_task, update_task, CreateTaskInput, TaskQueryError, TaskWithDetails,
    UpdateTaskInput,
};
use taskbolt_services::broadcast::events;
use taskbolt_services::notifications::dispatcher::notify;
use taskbolt_services::notifications::NotificationService;
use taskbolt_services::{
    spawn_automation_evaluation, BroadcastService, NotifyContext, TriggerContext,
};

use super::common::{require_capability, verify_project_membership, Capability};
use super::task_helpers::{
    broadcast_workspace_task_update, get_workspace_id_for_board, sanitize_html, CreateTaskRequest,
    ListTasksResponse, UpdateTaskRequest,
};
use super::validation::{
    validate_optional_string, validate_required_string, MAX_DESCRIPTION_LEN, MAX_NAME_LEN,
};

/// GET /api/boards/:board_id/tasks
/// List all tasks for a board, grouped by column
pub async fn list_tasks(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<ListTasksResponse>> {
    // Check Redis cache first (10s TTL)
    let cache_key = cache::project_tasks_key(&board_id);
    if let Some(cached) = cache::cache_get::<ListTasksResponse>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let tasks = list_tasks_by_board(&state.db, board_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Project not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
            TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?;

    let response = ListTasksResponse { tasks };

    // Store in cache (10 second TTL)
    cache::cache_set(&state.redis, &cache_key, &response, 10).await;

    Ok(Json(response))
}

/// GET /api/tasks/:id
/// Get a task by ID with all details
pub async fn get_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<TaskWithDetails>> {
    let task = get_task_by_id(&state.db, task_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
            TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    Ok(Json(task))
}

/// POST /api/boards/:board_id/tasks
/// Create a new task
pub async fn create_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateTaskRequest>,
) -> Result<Json<Task>> {
    // Verify board membership first
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;
    require_capability(
        &state.db,
        tenant.user_id,
        &tenant.role,
        board_id,
        Capability::CreateTasks,
    )
    .await?;

    // Validate string lengths
    validate_required_string("Title", &body.title, MAX_NAME_LEN)?;
    validate_optional_string(
        "Description",
        body.description.as_deref(),
        MAX_DESCRIPTION_LEN,
    )?;

    let input = CreateTaskInput {
        title: body.title,
        description: body.description.map(|d| sanitize_html(&d)),
        priority: body.priority,
        due_date: body.due_date,
        start_date: body.start_date,
        estimated_hours: body.estimated_hours,
        status_id: body.status_id,
        milestone_id: body.milestone_id,
        task_list_id: body.task_list_id,
        assignee_ids: body.assignee_ids.clone(),
        label_ids: body.label_ids,
        parent_task_id: body.parent_task_id,
        reporting_person_id: body.reporting_person_id,
    };

    let task = create_task(&state.db, board_id, input, tenant.tenant_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Column not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
            TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?;

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Broadcast the task created event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let assignee_ids = body.assignee_ids.unwrap_or_default();

    let event = WsBoardEvent::TaskCreated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title.clone(),
            priority: task.priority.clone(),
            status_id: task.status_id,
            position: task.position.clone(),
            assignee_ids: assignee_ids.clone(),
            watcher_ids: taskbolt_db::queries::get_task_watcher_ids(&state.db, task.id)
                .await
                .unwrap_or_default(),
            updated_at: task.updated_at,
            changed_fields: None,
            origin_user_name: None,
        },
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service
        .broadcast_board_event(board_id, &event)
        .await
    {
        tracing::error!("Failed to broadcast task created event: {}", e);
    }

    // Broadcast workspace update for team overview
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        broadcast_workspace_task_update(
            &broadcast_service,
            workspace_id,
            task.id,
            board_id,
            &assignee_ids,
        )
        .await;
    }

    // Trigger automations for TaskCreated
    spawn_automation_evaluation(
        state.db.clone(),
        state.redis.clone(),
        AutomationTrigger::TaskCreated,
        TriggerContext {
            task_id: task.id,
            board_id,
            tenant_id: tenant.tenant_id,
            user_id: tenant.user_id,
            previous_status_id: None,
            new_status_id: task.status_id,
            priority: Some(format!("{:?}", task.priority).to_lowercase()),
            member_user_id: None,
        },
    );

    // Send TaskAssigned notifications to assignees added during creation (skip self)
    let task_id = task.id;
    let task_title = task.title.clone();
    let creator_id = tenant.user_id;
    let notifiable_assignees: Vec<Uuid> = assignee_ids
        .iter()
        .copied()
        .filter(|uid| *uid != creator_id)
        .collect();

    if !notifiable_assignees.is_empty() {
        let db = state.db.clone();
        let redis = state.redis.clone();
        let waha_client = state.waha_client.clone();
        let app_url = state.config.app_url.clone();
        tokio::spawn(async move {
            let creator_name = get_user_display_name(&db, creator_id)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "Someone".to_string());
            let title = format!("{} assigned you to a task", creator_name);
            let body = format!("\"{}\"", task_title);
            let link = format!("/task/{}", task_id);

            let notification_svc = NotificationService::new(
                db.clone(),
                BroadcastService::new(redis.clone()),
                None,
                app_url.clone(),
            );
            let notify_ctx = NotifyContext {
                pool: &db,
                redis: &redis,
                notification_svc: &notification_svc,
                app_url: &app_url,
                slack_webhook_url: None,
                waha_client: waha_client.as_ref(),
            };

            for assignee_id in notifiable_assignees {
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
                    tracing::error!(
                        error = %e,
                        assignee = %assignee_id,
                        "Failed to dispatch TaskAssigned notification on task creation"
                    );
                }
            }
        });
    }

    Ok(Json(task))
}

/// PUT /api/tasks/:id
/// Update an existing task
pub async fn update_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<UpdateTaskRequest>,
) -> Result<Json<Task>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    // Validate string lengths
    if let Some(ref title) = body.title {
        validate_required_string("Title", title, MAX_NAME_LEN)?;
    }
    validate_optional_string(
        "Description",
        body.description.as_deref(),
        MAX_DESCRIPTION_LEN,
    )?;

    let priority_changed = body.priority.is_some();
    let due_date_changed = body.due_date.is_some() || body.clear_due_date.unwrap_or(false);

    // Fetch old task before update to compute changed fields
    let old_task: Option<Task> = get_task_row(&state.db, task_id)
        .await
        .map_err(AppError::SqlxError)?;

    let input = UpdateTaskInput {
        title: body.title,
        description: body.description.map(|d| sanitize_html(&d)),
        priority: body.priority,
        due_date: body.due_date,
        start_date: body.start_date,
        estimated_hours: body.estimated_hours,
        milestone_id: body.milestone_id,
        clear_description: body.clear_description,
        clear_due_date: body.clear_due_date,
        clear_start_date: body.clear_start_date,
        clear_estimated_hours: body.clear_estimated_hours,
        clear_milestone: body.clear_milestone,
        expected_version: body.expected_version,
    };

    let task = update_task(&state.db, task_id, input)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(current_task) => {
                AppError::VersionConflict(serde_json::to_value(&*current_task).unwrap_or_default())
            }
            TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?;

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Compute changed fields by comparing old and new task
    let changed_fields = old_task.map(|old| {
        let mut fields = Vec::new();
        if old.title != task.title {
            fields.push("title".to_string());
        }
        if old.description != task.description {
            fields.push("description".to_string());
        }
        if old.priority != task.priority {
            fields.push("priority".to_string());
        }
        if old.due_date != task.due_date {
            fields.push("due_date".to_string());
        }
        if old.start_date != task.start_date {
            fields.push("start_date".to_string());
        }
        if old.estimated_hours != task.estimated_hours {
            fields.push("estimated_hours".to_string());
        }
        if old.milestone_id != task.milestone_id {
            fields.push("milestone_id".to_string());
        }
        if old.status_id != task.status_id {
            fields.push("status_id".to_string());
        }
        fields
    });

    // Fetch user display_name for conflict notifications
    let origin_user_name: Option<String> = get_user_display_name(&state.db, tenant.user_id)
        .await
        .ok()
        .flatten();

    // Broadcast the task updated event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let assignee_ids = get_task_assignee_ids(&state.db, task_id).await?;

    let event = WsBoardEvent::TaskUpdated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title.clone(),
            priority: task.priority.clone(),
            status_id: task.status_id,
            position: task.position.clone(),
            assignee_ids: assignee_ids.clone(),
            watcher_ids: taskbolt_db::queries::get_task_watcher_ids(&state.db, task.id)
                .await
                .unwrap_or_default(),
            updated_at: task.updated_at,
            changed_fields,
            origin_user_name,
        },
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service
        .broadcast_board_event(board_id, &event)
        .await
    {
        tracing::error!("Failed to broadcast task updated event: {}", e);
    }

    // Broadcast workspace update for team overview
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        broadcast_workspace_task_update(
            &broadcast_service,
            workspace_id,
            task.id,
            board_id,
            &assignee_ids,
        )
        .await;
    }

    // Reset reminders when due_date changes
    if due_date_changed {
        if let Err(e) = taskbolt_db::queries::reset_reminders_for_task(&state.db, task_id).await {
            tracing::error!(task_id = %task_id, error = %e, "Failed to reset reminders after due_date change");
        }
    }

    // Trigger automations for priority changes
    if priority_changed {
        spawn_automation_evaluation(
            state.db.clone(),
            state.redis.clone(),
            AutomationTrigger::TaskPriorityChanged,
            TriggerContext {
                task_id: task.id,
                board_id,
                tenant_id: tenant.tenant_id,
                user_id: tenant.user_id,
                previous_status_id: None,
                new_status_id: None,
                priority: Some(format!("{:?}", task.priority).to_lowercase()),
                member_user_id: None,
            },
        );
    }

    Ok(Json(task))
}

/// DELETE /api/tasks/:id
/// Soft delete a task
pub async fn delete_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;
    require_capability(
        &state.db,
        tenant.user_id,
        &tenant.role,
        board_id,
        Capability::DeleteTasks,
    )
    .await?;

    soft_delete_task(&state.db, task_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
            TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?;

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Broadcast the task deleted event
    let broadcast_service = BroadcastService::new(state.redis.clone());

    let event = WsBoardEvent::TaskDeleted {
        task_id,
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service
        .broadcast_board_event(board_id, &event)
        .await
    {
        tracing::error!("Failed to broadcast task deleted event: {}", e);
    }

    // Broadcast workspace update for team overview
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        if let Err(e) = broadcast_service
            .broadcast_workspace_update(
                workspace_id,
                events::WORKLOAD_CHANGED,
                json!({
                    "task_id": task_id,
                    "project_id": board_id,
                    "deleted": true
                }),
            )
            .await
        {
            tracing::error!("Failed to broadcast workspace update: {}", e);
        }
    }

    Ok(Json(json!({ "success": true })))
}

/// POST /api/tasks/:id/complete
/// Move a task to the first "done" column on its board
pub async fn complete_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Task>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    // Find the first "done" status for this project
    let done_status_id: Option<uuid::Uuid> = find_done_status(&state.db, board_id)
        .await
        .map_err(AppError::SqlxError)?;

    let done_status_id = done_status_id
        .ok_or_else(|| AppError::BadRequest("No done status found on project".into()))?;

    let task =
        taskbolt_db::queries::move_task(&state.db, task_id, done_status_id, "a0".to_string())
            .await
            .map_err(|e| match e {
                TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
                TaskQueryError::Database(e) => AppError::SqlxError(e),
                _ => AppError::InternalError("Failed to complete task".into()),
            })?;

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    Ok(Json(task))
}

/// POST /api/tasks/:id/uncomplete
/// Move a task back to the first non-done column on its board
pub async fn uncomplete_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Task>> {
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    // Find the first non-done status for this project
    let status_id: Option<uuid::Uuid> = find_non_done_status(&state.db, board_id)
        .await
        .map_err(AppError::SqlxError)?;

    let status_id = status_id
        .ok_or_else(|| AppError::BadRequest("No non-done status found on project".into()))?;

    let task = taskbolt_db::queries::move_task(&state.db, task_id, status_id, "a0".to_string())
        .await
        .map_err(|e| match e {
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError("Failed to uncomplete task".into()),
        })?;

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    Ok(Json(task))
}

/// POST /api/tasks/:id/duplicate
/// Duplicate a task with its assignees and labels
pub async fn duplicate_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Task>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    verify_project_membership(&state.db, board_id, tenant.user_id, &tenant.role).await?;

    let task = duplicate_task(&state.db, task_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotProjectMember => AppError::Forbidden("Not a project member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            TaskQueryError::VersionConflict(_) => AppError::Conflict("Version conflict".into()),
            TaskQueryError::Other(msg) => AppError::InternalError(msg),
        })?;

    // Invalidate project tasks cache
    cache::cache_del(&state.redis, &cache::project_tasks_key(&board_id)).await;

    // Broadcast the task created event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let assignee_ids = get_task_assignee_ids(&state.db, task.id).await?;

    let event = WsBoardEvent::TaskCreated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title.clone(),
            priority: task.priority.clone(),
            status_id: task.status_id,
            position: task.position.clone(),
            assignee_ids: assignee_ids.clone(),
            watcher_ids: taskbolt_db::queries::get_task_watcher_ids(&state.db, task.id)
                .await
                .unwrap_or_default(),
            updated_at: task.updated_at,
            changed_fields: None,
            origin_user_name: None,
        },
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service
        .broadcast_board_event(board_id, &event)
        .await
    {
        tracing::error!("Failed to broadcast task duplicated event: {}", e);
    }

    // Broadcast workspace update for team overview
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        broadcast_workspace_task_update(
            &broadcast_service,
            workspace_id,
            task.id,
            board_id,
            &assignee_ids,
        )
        .await;
    }

    Ok(Json(task))
}
