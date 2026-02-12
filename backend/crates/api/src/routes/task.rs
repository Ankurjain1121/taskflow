use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::models::{Task, TaskBroadcast, TaskPriority, WsBoardEvent};
use taskflow_db::queries::{
    assign_user, bulk_delete_tasks, bulk_update_tasks, create_task, get_task_assignee_ids,
    get_task_board_id, get_task_by_id, list_tasks_by_board, list_tasks_flat,
    list_tasks_for_calendar, list_tasks_for_gantt, move_task, soft_delete_task, unassign_user,
    update_task, BulkUpdateInput, CalendarTask, CreateTaskInput, GanttTask, TaskListItem,
    TaskQueryError, TaskWithDetails, UpdateTaskInput,
};
use taskflow_services::broadcast::events;
use taskflow_services::BroadcastService;

/// Response for listing tasks by board
#[derive(Serialize)]
pub struct ListTasksResponse {
    pub tasks: std::collections::HashMap<Uuid, Vec<Task>>,
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
async fn get_workspace_id_for_board(
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

/// Helper to broadcast workspace update after task mutation
async fn broadcast_workspace_task_update(
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

/// GET /api/boards/:board_id/tasks
/// List all tasks for a board, grouped by column
async fn list_tasks(
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
async fn get_task(
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
async fn create_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(body): Json<CreateTaskRequest>,
) -> Result<Json<Task>> {
    // Verify board membership first
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    let input = CreateTaskInput {
        title: body.title,
        description: body.description,
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

    if let Err(e) = broadcast_service.broadcast_board_event(board_id, &event).await {
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

    Ok(Json(task))
}

/// PUT /api/tasks/:id
/// Update an existing task
async fn update_task_handler(
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
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    let input = UpdateTaskInput {
        title: body.title,
        description: body.description,
        priority: body.priority,
        due_date: body.due_date,
        start_date: body.start_date,
        estimated_hours: body.estimated_hours,
        milestone_id: body.milestone_id,
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

    if let Err(e) = broadcast_service.broadcast_board_event(board_id, &event).await {
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

    Ok(Json(task))
}

/// DELETE /api/tasks/:id
/// Soft delete a task
async fn delete_task_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
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

    if let Err(e) = broadcast_service.broadcast_board_event(board_id, &event).await {
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

/// POST /api/tasks/:id/move
/// Move a task to a different column and/or position
async fn move_task_handler(
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
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    let task = move_task(&state.db, task_id, body.column_id, body.position.clone())
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Task not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;

    // Broadcast the task moved event
    let broadcast_service = BroadcastService::new(state.redis.clone());

    let event = WsBoardEvent::TaskMoved {
        task_id,
        column_id: body.column_id,
        position: body.position,
        origin_user_id: tenant.user_id,
    };

    if let Err(e) = broadcast_service.broadcast_board_event(board_id, &event).await {
        tracing::error!("Failed to broadcast task moved event: {}", e);
    }

    // Broadcast workspace update for team overview (task move can change status)
    if let Ok(Some(workspace_id)) = get_workspace_id_for_board(&state.db, board_id).await {
        let assignee_ids = get_task_assignee_ids(&state.db, task_id).await.unwrap_or_default();
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

/// POST /api/tasks/:id/assignees
/// Assign a user to a task
async fn assign_user_handler(
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
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a board member".into()));
    }

    // Verify the assignee is also a board member
    let assignee_is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        body.user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !assignee_is_member {
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
            id,
            title,
            description,
            priority as "priority: TaskPriority",
            due_date,
            start_date,
            estimated_hours,
            board_id,
            column_id,
            position,
            milestone_id,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        FROM tasks
        WHERE id = $1
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

    if let Err(e) = broadcast_service.broadcast_board_event(board_id, &event).await {
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

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/:id/assignees/:user_id
/// Unassign a user from a task
async fn unassign_user_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    // Get task's board_id for authorization
    let board_id = get_task_board_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    // Verify board membership
    let is_member = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        ) as "exists!"
        "#,
        board_id,
        tenant.user_id
    )
    .fetch_one(&state.db)
    .await?;

    if !is_member {
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
            id,
            title,
            description,
            priority as "priority: TaskPriority",
            due_date,
            start_date,
            estimated_hours,
            board_id,
            column_id,
            position,
            milestone_id,
            tenant_id,
            created_by_id,
            deleted_at,
            created_at,
            updated_at
        FROM tasks
        WHERE id = $1
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

    if let Err(e) = broadcast_service.broadcast_board_event(board_id, &event).await {
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

/// GET /api/boards/:board_id/tasks/list
/// List all tasks for a board as a flat list with column names
async fn list_tasks_flat_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<TaskListItem>>> {
    let tasks = list_tasks_flat(&state.db, board_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Board not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;
    Ok(Json(tasks))
}

/// Query params for calendar endpoint
#[derive(Deserialize)]
pub struct CalendarQuery {
    pub start: chrono::DateTime<chrono::Utc>,
    pub end: chrono::DateTime<chrono::Utc>,
}

/// GET /api/boards/{board_id}/tasks/calendar?start=&end=
async fn list_calendar_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
    Query(query): Query<CalendarQuery>,
) -> Result<Json<Vec<CalendarTask>>> {
    let tasks = list_tasks_for_calendar(&state.db, board_id, tenant.user_id, query.start, query.end)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Board not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;
    Ok(Json(tasks))
}

/// GET /api/boards/{board_id}/tasks/gantt
async fn list_gantt_tasks_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<GanttTask>>> {
    let tasks = list_tasks_for_gantt(&state.db, board_id, tenant.user_id)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::NotFound => AppError::NotFound("Board not found".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
        })?;
    Ok(Json(tasks))
}

/// Create the task router
/// Request body for bulk update
#[derive(Deserialize)]
pub struct BulkUpdateRequest {
    pub task_ids: Vec<Uuid>,
    pub column_id: Option<Uuid>,
    pub priority: Option<TaskPriority>,
    pub milestone_id: Option<Uuid>,
    pub clear_milestone: Option<bool>,
    pub group_id: Option<Uuid>,
    pub clear_group: Option<bool>,
}

/// Request body for bulk delete
#[derive(Deserialize)]
pub struct BulkDeleteRequest {
    pub task_ids: Vec<Uuid>,
}

/// POST /boards/{board_id}/tasks/bulk-update
async fn bulk_update_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(req): Json<BulkUpdateRequest>,
) -> Result<Json<serde_json::Value>> {
    let input = BulkUpdateInput {
        task_ids: req.task_ids,
        column_id: req.column_id,
        priority: req.priority,
        milestone_id: req.milestone_id,
        clear_milestone: req.clear_milestone,
        group_id: req.group_id,
        clear_group: req.clear_group,
    };

    let updated = bulk_update_tasks(&state.db, board_id, ctx.user_id, input)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    Ok(Json(json!({ "updated": updated })))
}

/// POST /boards/{board_id}/tasks/bulk-delete
async fn bulk_delete_handler(
    State(state): State<AppState>,
    ctx: TenantContext,
    Path(board_id): Path<Uuid>,
    Json(req): Json<BulkDeleteRequest>,
) -> Result<Json<serde_json::Value>> {
    let deleted = bulk_delete_tasks(&state.db, board_id, ctx.user_id, &req.task_ids)
        .await
        .map_err(|e| match e {
            TaskQueryError::NotBoardMember => AppError::Forbidden("Not a board member".into()),
            TaskQueryError::Database(e) => AppError::SqlxError(e),
            _ => AppError::InternalError(format!("{}", e)),
        })?;

    Ok(Json(json!({ "deleted": deleted })))
}

pub fn task_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Board-scoped task routes
        .route("/boards/{board_id}/tasks", get(list_tasks))
        .route("/boards/{board_id}/tasks/list", get(list_tasks_flat_handler))
        .route("/boards/{board_id}/tasks/calendar", get(list_calendar_tasks_handler))
        .route("/boards/{board_id}/tasks/gantt", get(list_gantt_tasks_handler))
        .route("/boards/{board_id}/tasks/bulk-update", post(bulk_update_handler))
        .route("/boards/{board_id}/tasks/bulk-delete", post(bulk_delete_handler))
        .route("/boards/{board_id}/tasks", post(create_task_handler))
        // Task-specific routes
        .route("/tasks/{id}", get(get_task))
        .route("/tasks/{id}", put(update_task_handler))
        .route("/tasks/{id}", delete(delete_task_handler))
        .route("/tasks/{id}/move", post(move_task_handler))
        .route("/tasks/{id}/assignees", post(assign_user_handler))
        .route(
            "/tasks/{id}/assignees/{user_id}",
            delete(unassign_user_handler),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
