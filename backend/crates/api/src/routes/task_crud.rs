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
    create_task, duplicate_task, get_task_assignee_ids, get_task_board_id, get_task_by_id,
    list_tasks_by_board, soft_delete_task, update_task, CreateTaskInput, TaskQueryError,
    TaskWithDetails, UpdateTaskInput,
};
use taskflow_services::broadcast::events;
use taskflow_services::{spawn_automation_evaluation, BroadcastService, TriggerContext};

use super::task_helpers::{
    broadcast_workspace_task_update, get_workspace_id_for_board, sanitize_html,
    verify_board_membership, CreateTaskRequest, ListTasksResponse, UpdateTaskRequest,
};

/// GET /api/boards/:board_id/tasks
/// List all tasks for a board, grouped by column
pub async fn list_tasks(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<ListTasksResponse>> {
    let tasks = list_tasks_by_board(&state.db, board_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Board not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    Ok(Json(ListTasksResponse { tasks }))
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
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
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
    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    let input = CreateTaskInput {
        title: body.title,
        description: body.description.map(|d| sanitize_html(&d)),
        priority: body.priority,
        due_date: body.due_date,
        start_date: body.start_date,
        estimated_hours: body.estimated_hours,
        column_id: body.column_id,
        milestone_id: body.milestone_id,
        group_id: body.group_id,
        assignee_ids: body.assignee_ids.clone(),
        label_ids: body.label_ids,
    };

    let task = create_task(&state.db, board_id, input, tenant.tenant_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Column not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    // Broadcast the task created event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let assignee_ids = body.assignee_ids.unwrap_or_default();

    let event = WsBoardEvent::TaskCreated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title.clone(),
            priority: task.priority.clone(),
            column_id: task.column_id,
            position: task.position.clone(),
            assignee_ids: assignee_ids.clone(),
            updated_at: task.updated_at,
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
        AutomationTrigger::TaskCreated,
        TriggerContext {
            task_id: task.id,
            board_id,
            tenant_id: tenant.tenant_id,
            user_id: tenant.user_id,
            previous_column_id: None,
            new_column_id: Some(task.column_id),
            priority: Some(format!("{:?}", task.priority).to_lowercase()),
        },
    );

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
    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    let priority_changed = body.priority.is_some();

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
    };

    let task = update_task(&state.db, task_id, input)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    // Broadcast the task updated event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let assignee_ids = get_task_assignee_ids(&state.db, task_id).await?;

    let event = WsBoardEvent::TaskUpdated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title.clone(),
            priority: task.priority.clone(),
            column_id: task.column_id,
            position: task.position.clone(),
            assignee_ids: assignee_ids.clone(),
            updated_at: task.updated_at,
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

    // Trigger automations for priority changes
    if priority_changed {
        spawn_automation_evaluation(
            state.db.clone(),
            AutomationTrigger::TaskPriorityChanged,
            TriggerContext {
                task_id: task.id,
                board_id,
                tenant_id: tenant.tenant_id,
                user_id: tenant.user_id,
                previous_column_id: None,
                new_column_id: None,
                priority: Some(format!("{:?}", task.priority).to_lowercase()),
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
    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    soft_delete_task(&state.db, task_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

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
                    "board_id": board_id,
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
    if !verify_board_membership(&state.db, board_id, tenant.user_id).await? {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    let task = duplicate_task(&state.db, task_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    // Broadcast the task created event
    let broadcast_service = BroadcastService::new(state.redis.clone());
    let assignee_ids = get_task_assignee_ids(&state.db, task.id).await?;

    let event = WsBoardEvent::TaskCreated {
        task: TaskBroadcast {
            id: task.id,
            title: task.title.clone(),
            priority: task.priority.clone(),
            column_id: task.column_id,
            position: task.position.clone(),
            assignee_ids: assignee_ids.clone(),
            updated_at: task.updated_at,
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
