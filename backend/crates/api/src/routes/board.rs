//! Board/Project REST endpoints
//!
//! Provides CRUD operations for projects and project membership management.

use std::collections::HashMap;

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    response::IntoResponse,
    routing::{delete, get},
    Json, Router,
};
use uuid::Uuid;

use taskflow_db::models::BoardMemberRole;
use taskflow_db::queries::{boards, workspaces};

use taskflow_services::board_templates;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::auth_middleware;
use crate::services::cache;
use crate::services::http_cache::{check_if_none_match, generate_etag};
use crate::state::AppState;

use super::board_types::*;
use super::common::MessageResponse;

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/boards
///
/// List all boards in a workspace that the user has access to.
async fn list_boards(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<BoardResponse>>> {
    // Check workspace membership
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Check Redis cache first (30s TTL)
    let cache_key = cache::workspace_boards_key(&workspace_id);
    if let Some(cached) = cache::cache_get::<Vec<BoardResponse>>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let boards_list =
        boards::list_boards_by_workspace(&state.db, workspace_id, auth.0.user_id).await?;

    let response: Vec<BoardResponse> = boards_list
        .into_iter()
        .map(|b| BoardResponse {
            id: b.id,
            name: b.name,
            description: b.description,
            slack_webhook_url: b.slack_webhook_url,
            prefix: b.prefix,
            workspace_id: b.workspace_id,
            tenant_id: b.tenant_id,
            created_by_id: b.created_by_id,
            background_color: b.background_color,
            created_at: b.created_at,
            updated_at: b.updated_at,
        })
        .collect();

    // Store in cache (30 second TTL)
    cache::cache_set(&state.redis, &cache_key, &response, 30).await;

    Ok(Json(response))
}

/// GET /api/boards/:id
///
/// Get a board by ID with its statuses.
/// Returns 304 Not Modified if the ETag matches (If-None-Match header).
async fn get_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    headers: axum::http::HeaderMap,
) -> Result<axum::response::Response> {
    let board = boards::get_board_by_id(&state.db, id, auth.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Board not found or access denied".into()))?;

    let response = BoardDetailResponse {
        id: board.project.id,
        name: board.project.name,
        description: board.project.description,
        slack_webhook_url: board.project.slack_webhook_url,
        prefix: board.project.prefix,
        workspace_id: board.project.workspace_id,
        tenant_id: board.project.tenant_id,
        created_by_id: board.project.created_by_id,
        background_color: board.project.background_color.clone(),
        created_at: board.project.created_at,
        updated_at: board.project.updated_at,
        statuses: board
            .statuses
            .into_iter()
            .map(|s| StatusResponse {
                id: s.id,
                name: s.name,
                project_id: s.project_id,
                position: s.position,
                color: s.color,
                status_type: s.status_type,
                is_default: s.is_default,
                created_at: s.created_at,
            })
            .collect(),
    };

    // Generate ETag from response JSON
    let json_str = serde_json::to_string(&response).unwrap_or_else(|_| String::from("{}"));
    let etag = generate_etag(&json_str);

    // Check if client has matching ETag
    if check_if_none_match(&headers, &etag) {
        return Ok(axum::response::Response::builder()
            .status(axum::http::StatusCode::NOT_MODIFIED)
            .header("etag", etag)
            .body(axum::body::Body::empty())
            .unwrap_or_else(|_| axum::response::Response::new(axum::body::Body::empty())));
    }

    // Return response with ETag header
    let mut response_json = Json(response).into_response();
    response_json.headers_mut().insert(
        "etag",
        axum::http::HeaderValue::from_str(&format!("\"{}\"", etag))
            .unwrap_or_else(|_| axum::http::HeaderValue::from_static("")),
    );
    Ok(response_json)
}

/// POST /api/workspaces/:workspace_id/boards
///
/// Create a new board with default statuses.
async fn create_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateBoardRequest>,
) -> Result<Json<BoardDetailResponse>> {
    // Check workspace membership
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Board name is required".into()));
    }

    let board = boards::create_board(
        &state.db,
        name,
        payload.description.as_deref(),
        workspace_id,
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await?;

    // Invalidate workspace boards cache
    cache::cache_del(&state.redis, &cache::workspace_boards_key(&workspace_id)).await;

    Ok(Json(BoardDetailResponse {
        id: board.project.id,
        name: board.project.name,
        description: board.project.description,
        slack_webhook_url: board.project.slack_webhook_url,
        prefix: board.project.prefix,
        workspace_id: board.project.workspace_id,
        tenant_id: board.project.tenant_id,
        created_by_id: board.project.created_by_id,
        background_color: board.project.background_color.clone(),
        created_at: board.project.created_at,
        updated_at: board.project.updated_at,
        statuses: board
            .statuses
            .into_iter()
            .map(|s| StatusResponse {
                id: s.id,
                name: s.name,
                project_id: s.project_id,
                position: s.position,
                color: s.color,
                status_type: s.status_type,
                is_default: s.is_default,
                created_at: s.created_at,
            })
            .collect(),
    }))
}

/// PUT /api/boards/:id
///
/// Update a board's name and description.
async fn update_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBoardRequest>,
) -> Result<Json<BoardResponse>> {
    // Check board membership with editor or owner role
    let role = boards::get_board_member_role(&state.db, id, auth.0.user_id).await?;
    match role {
        Some(BoardMemberRole::Owner | BoardMemberRole::Editor) => {}
        Some(BoardMemberRole::Viewer) => {
            return Err(AppError::Forbidden("Editor role required".into()));
        }
        None => {
            return Err(AppError::NotFound(
                "Board not found or access denied".into(),
            ));
        }
    }

    let name = payload.name.as_deref().map(|n| n.trim());
    if let Some(n) = name {
        if n.is_empty() {
            return Err(AppError::BadRequest("Board name is required".into()));
        }
    }

    let bg_color = payload.background_color.as_ref().map(|c| c.as_deref());
    let board = boards::update_board(
        &state.db,
        id,
        name,
        payload.description.as_deref(),
        bg_color,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("Board not found".into()))?;

    // Invalidate workspace boards cache
    cache::cache_del(
        &state.redis,
        &cache::workspace_boards_key(&board.workspace_id),
    )
    .await;

    Ok(Json(BoardResponse {
        id: board.id,
        name: board.name,
        description: board.description,
        slack_webhook_url: board.slack_webhook_url,
        prefix: board.prefix,
        workspace_id: board.workspace_id,
        tenant_id: board.tenant_id,
        created_by_id: board.created_by_id,
        background_color: board.background_color,
        created_at: board.created_at,
        updated_at: board.updated_at,
    }))
}

/// DELETE /api/boards/:id
///
/// Soft-delete a board.
/// Requires Manager or Admin role.
async fn delete_board(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Board not found or access denied".into(),
        ));
    }

    // Get workspace_id for cache invalidation before deletion
    let board_info = boards::get_board_by_id(&state.db, id, auth.0.user_id).await?;

    let deleted = boards::soft_delete_board(&state.db, id).await?;

    if deleted {
        // Invalidate workspace boards cache
        if let Some(info) = board_info {
            cache::cache_del(
                &state.redis,
                &cache::workspace_boards_key(&info.project.workspace_id),
            )
            .await;
        }
        Ok(Json(MessageResponse {
            message: "Board deleted successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Board not found".into()))
    }
}

/// GET /api/boards/:id/members
///
/// List all members of a board.
async fn list_board_members(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<BoardMemberResponse>>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Board not found or access denied".into(),
        ));
    }

    let members = boards::list_board_members(&state.db, id).await?;

    let response: Vec<BoardMemberResponse> = members
        .into_iter()
        .map(|m| BoardMemberResponse {
            id: m.id,
            project_id: m.project_id,
            user_id: m.user_id,
            role: m.role,
            joined_at: m.joined_at,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
        })
        .collect();

    Ok(Json(response))
}

/// POST /api/boards/:id/members
///
/// Add a user to a board.
/// Requires Manager or Admin role.
async fn add_board_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddBoardMemberRequest>,
) -> Result<Json<MessageResponse>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Board not found or access denied".into(),
        ));
    }

    // Get board to check workspace membership of the user being added
    let board = boards::get_board_internal(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Board not found".into()))?;

    // Verify user is a workspace member
    let is_ws_member =
        workspaces::is_workspace_member(&state.db, board.workspace_id, payload.user_id).await?;
    if !is_ws_member {
        return Err(AppError::BadRequest(
            "User must be a workspace member first".into(),
        ));
    }

    boards::add_board_member(&state.db, id, payload.user_id, payload.role).await?;

    Ok(Json(MessageResponse {
        message: "Member added successfully".into(),
    }))
}

/// DELETE /api/boards/:id/members/:user_id
///
/// Remove a user from a board.
/// Requires Manager or Admin role.
async fn remove_board_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    // Check board membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Board not found or access denied".into(),
        ));
    }

    let removed = boards::remove_board_member(&state.db, id, user_id).await?;

    if removed {
        Ok(Json(MessageResponse {
            message: "Member removed successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Member not found".into()))
    }
}

/// PATCH /api/boards/:id/members/:user_id
///
/// Update a board member's role.
/// Requires Editor role on the board.
async fn update_board_member_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateBoardMemberRoleRequest>,
) -> Result<Json<BoardMemberResponse>> {
    // Check board membership with owner or editor role
    let role = boards::get_board_member_role(&state.db, id, auth.0.user_id).await?;
    match role {
        Some(BoardMemberRole::Owner | BoardMemberRole::Editor) => {}
        Some(BoardMemberRole::Viewer) => {
            return Err(AppError::Forbidden("Editor role required".into()));
        }
        None => {
            return Err(AppError::NotFound(
                "Board not found or access denied".into(),
            ));
        }
    }

    // Cannot change your own role
    if auth.0.user_id == user_id {
        return Err(AppError::BadRequest("Cannot change your own role".into()));
    }

    let updated = boards::update_board_member_role(&state.db, id, user_id, payload.role).await?;

    if !updated {
        return Err(AppError::NotFound("Board member not found".into()));
    }

    // Fetch the updated member info
    let members = boards::list_board_members(&state.db, id).await?;
    let member = members
        .into_iter()
        .find(|m| m.user_id == user_id)
        .ok_or_else(|| AppError::NotFound("Board member not found".into()))?;

    Ok(Json(BoardMemberResponse {
        id: member.id,
        project_id: member.project_id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        name: member.name,
        email: member.email,
        avatar_url: member.avatar_url,
    }))
}

/// POST /api/boards/:id/duplicate
///
/// Duplicate a board with statuses and optionally tasks.
async fn duplicate_board(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<DuplicateBoardRequest>,
) -> Result<Json<BoardDetailResponse>> {
    // Verify membership
    let is_member = boards::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Board not found or access denied".into(),
        ));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Board name is required".into()));
    }

    let include_tasks = payload.include_tasks.unwrap_or(false);

    let result =
        boards::duplicate_board(&state.db, id, name, include_tasks, auth.0.user_id).await?;

    // Invalidate workspace boards cache
    cache::cache_del(
        &state.redis,
        &cache::workspace_boards_key(&result.project.workspace_id),
    )
    .await;

    Ok(Json(BoardDetailResponse {
        id: result.project.id,
        name: result.project.name,
        description: result.project.description,
        slack_webhook_url: result.project.slack_webhook_url,
        prefix: result.project.prefix,
        workspace_id: result.project.workspace_id,
        tenant_id: result.project.tenant_id,
        created_by_id: result.project.created_by_id,
        background_color: result.project.background_color,
        created_at: result.project.created_at,
        updated_at: result.project.updated_at,
        statuses: result
            .statuses
            .into_iter()
            .map(|s| StatusResponse {
                id: s.id,
                name: s.name,
                project_id: s.project_id,
                position: s.position,
                color: s.color,
                status_type: s.status_type,
                is_default: s.is_default,
                created_at: s.created_at,
            })
            .collect(),
    }))
}

/// GET /api/board-templates
///
/// List available board templates.
async fn list_board_templates() -> Json<Vec<board_templates::BoardTemplate>> {
    Json(board_templates::TEMPLATES.to_vec())
}

/// GET /api/boards/:id/full
///
/// Get a board with statuses, tasks (with badge data), and members in a single request.
/// This batch endpoint replaces multiple separate API calls needed to render a board view.
/// Supports optional `?limit=` and `?offset=` query params for task pagination.
async fn get_board_full(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Query(query): Query<BoardFullQuery>,
) -> Result<Json<BoardFullResponse>> {
    let limit = query.limit.unwrap_or(1000).clamp(1, 1000);
    let offset = query.offset.unwrap_or(0).max(0);

    // Fetch board+statuses, tasks with badges, members, assignees, and labels in parallel
    let (board_result, tasks_result, members_result, assignees_result, labels_result) = tokio::join!(
        boards::get_board_by_id(&state.db, id, auth.0.user_id),
        boards::list_board_tasks_with_badges(&state.db, id, Some(limit), Some(offset)),
        boards::list_board_members(&state.db, id),
        boards::list_board_task_assignees(&state.db, id),
        boards::list_board_task_labels(&state.db, id),
    );

    let board = board_result?
        .ok_or_else(|| AppError::NotFound("Board not found or access denied".into()))?;

    let paginated = tasks_result?;
    let task_rows = paginated.tasks;
    let total_task_count = paginated.total_count;
    let members = members_result?;
    let assignee_rows = assignees_result?;
    let label_rows = labels_result?;

    // Group assignees by task_id
    let mut assignees_map: HashMap<Uuid, Vec<AssigneeInfo>> = HashMap::new();
    for a in assignee_rows {
        assignees_map
            .entry(a.task_id)
            .or_default()
            .push(AssigneeInfo {
                id: a.user_id,
                display_name: a.display_name,
                avatar_url: a.avatar_url,
            });
    }

    // Group labels by task_id
    let mut labels_map: HashMap<Uuid, Vec<LabelInfo>> = HashMap::new();
    for l in label_rows {
        labels_map.entry(l.task_id).or_default().push(LabelInfo {
            id: l.label_id,
            name: l.name,
            color: l.color,
        });
    }

    // Build enriched task list
    let tasks: Vec<TaskWithBadges> = task_rows
        .into_iter()
        .map(|t| {
            let task_id = t.id;
            TaskWithBadges {
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                due_date: t.due_date,
                status_id: t.status_id,
                position: t.position,
                task_list_id: t.task_list_id,
                milestone_id: t.milestone_id,
                created_by_id: t.created_by_id,
                created_at: t.created_at,
                updated_at: t.updated_at,
                parent_task_id: t.parent_task_id,
                subtask_completed: t.subtask_completed,
                subtask_total: t.subtask_total,
                has_running_timer: t.has_running_timer,
                comment_count: t.comment_count,
                assignees: assignees_map.remove(&task_id).unwrap_or_default(),
                labels: labels_map.remove(&task_id).unwrap_or_default(),
            }
        })
        .collect();

    let board_detail = BoardDetailResponse {
        id: board.project.id,
        name: board.project.name,
        description: board.project.description,
        slack_webhook_url: board.project.slack_webhook_url,
        prefix: board.project.prefix,
        workspace_id: board.project.workspace_id,
        tenant_id: board.project.tenant_id,
        created_by_id: board.project.created_by_id,
        background_color: board.project.background_color.clone(),
        created_at: board.project.created_at,
        updated_at: board.project.updated_at,
        statuses: board
            .statuses
            .into_iter()
            .map(|s| StatusResponse {
                id: s.id,
                name: s.name,
                project_id: s.project_id,
                position: s.position,
                color: s.color,
                status_type: s.status_type,
                is_default: s.is_default,
                created_at: s.created_at,
            })
            .collect(),
    };

    let member_responses: Vec<BoardMemberResponse> = members
        .into_iter()
        .map(|m| BoardMemberResponse {
            id: m.id,
            project_id: m.project_id,
            user_id: m.user_id,
            role: m.role,
            joined_at: m.joined_at,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
        })
        .collect();

    Ok(Json(BoardFullResponse {
        board: board_detail,
        tasks,
        members: member_responses,
        meta: BoardMeta {
            total_task_count,
            current_limit: limit,
            current_offset: offset,
        },
    }))
}

// ============================================================================
// Routers
// ============================================================================

/// Build the boards router for workspace-scoped routes
/// Routes: /api/workspaces/:workspace_id/boards
pub fn workspace_boards_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_boards).post(create_board))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the boards router for direct board routes
/// Routes: /api/boards/:id
pub fn board_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/{id}",
            get(get_board)
                .put(update_board)
                .patch(update_board)
                .delete(delete_board),
        )
        .route("/{id}/full", get(get_board_full))
        .route("/{id}/duplicate", axum::routing::post(duplicate_board))
        .route(
            "/{id}/members",
            get(list_board_members).post(add_board_member),
        )
        .route(
            "/{id}/members/{user_id}",
            delete(remove_board_member).patch(update_board_member_role),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the board templates router
/// Routes: /api/board-templates
pub fn board_templates_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_board_templates))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
