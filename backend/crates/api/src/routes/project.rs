//! Project REST endpoints
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
use taskflow_db::queries::{projects, workspaces};

use taskflow_services::board_templates;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::services::cache;
use crate::services::http_cache::{check_if_none_match, generate_etag};
use crate::state::AppState;

use super::common::MessageResponse;
use super::helpers::project_types::*;
use super::validation::{
    validate_optional_string, validate_required_string, MAX_NAME_LEN, MAX_PROJECT_DESCRIPTION_LEN,
};

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/projects
///
/// List all projects in a workspace that the user has access to.
async fn list_projects(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<ProjectResponse>>> {
    // Check workspace membership
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Check Redis cache first (30s TTL)
    let cache_key = cache::workspace_projects_key(&workspace_id);
    if let Some(cached) = cache::cache_get::<Vec<ProjectResponse>>(&state.redis, &cache_key).await {
        return Ok(Json(cached));
    }

    let projects_list =
        projects::list_boards_by_workspace(&state.db, workspace_id, auth.0.user_id).await?;

    let response: Vec<ProjectResponse> = projects_list
        .into_iter()
        .map(|b| ProjectResponse {
            id: b.id,
            name: b.name,
            description: b.description,
            slack_webhook_url: b.slack_webhook_url,
            prefix: b.prefix,
            workspace_id: b.workspace_id,
            tenant_id: b.tenant_id,
            created_by_id: b.created_by_id,
            background_color: b.background_color,
            is_sample: b.is_sample,
            created_at: b.created_at,
            updated_at: b.updated_at,
        })
        .collect();

    // Store in cache (30 second TTL)
    cache::cache_set(&state.redis, &cache_key, &response, 30).await;

    Ok(Json(response))
}

/// GET /api/projects/:id
///
/// Get a project by ID with its statuses.
/// Returns 304 Not Modified if the ETag matches (If-None-Match header).
async fn get_project(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    headers: axum::http::HeaderMap,
) -> Result<axum::response::Response> {
    // Check Redis cache first (30s TTL)
    let cache_key = cache::project_detail_key(&id);
    if let Some(cached) = cache::cache_get::<ProjectDetailResponse>(&state.redis, &cache_key).await
    {
        // Still apply ETag logic on cached response
        let json_str = serde_json::to_string(&cached).unwrap_or_else(|_| String::from("{}"));
        let etag = generate_etag(&json_str);

        if check_if_none_match(&headers, &etag) {
            return Ok(axum::response::Response::builder()
                .status(axum::http::StatusCode::NOT_MODIFIED)
                .header("etag", etag)
                .body(axum::body::Body::empty())
                .unwrap_or_else(|_| axum::response::Response::new(axum::body::Body::empty())));
        }

        let mut response_json = Json(cached).into_response();
        response_json.headers_mut().insert(
            "etag",
            axum::http::HeaderValue::from_str(&format!("\"{}\"", etag))
                .unwrap_or_else(|_| axum::http::HeaderValue::from_static("")),
        );
        return Ok(response_json);
    }

    let board = projects::get_board_by_id(&state.db, id, auth.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found or access denied".into()))?;

    let response = ProjectDetailResponse {
        id: board.project.id,
        name: board.project.name,
        description: board.project.description,
        slack_webhook_url: board.project.slack_webhook_url,
        prefix: board.project.prefix,
        workspace_id: board.project.workspace_id,
        tenant_id: board.project.tenant_id,
        created_by_id: board.project.created_by_id,
        background_color: board.project.background_color.clone(),
        is_sample: board.project.is_sample,
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

    // Store in cache (30 second TTL)
    cache::cache_set(&state.redis, &cache_key, &response, 30).await;

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

/// POST /api/workspaces/:workspace_id/projects
///
/// Create a new project with default statuses.
async fn create_project(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<Json<ProjectDetailResponse>> {
    // Check workspace membership
    let is_member =
        workspaces::is_workspace_member(&state.db, workspace_id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    // Validate string lengths
    validate_required_string("Project name", &payload.name, MAX_NAME_LEN)?;
    validate_optional_string(
        "Description",
        payload.description.as_deref(),
        MAX_PROJECT_DESCRIPTION_LEN,
    )?;

    let name = payload.name.trim();

    let board = projects::create_board(
        &state.db,
        name,
        payload.description.as_deref(),
        workspace_id,
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await?;

    // Invalidate workspace projects cache
    cache::cache_del(&state.redis, &cache::workspace_projects_key(&workspace_id)).await;

    Ok(Json(ProjectDetailResponse {
        id: board.project.id,
        name: board.project.name,
        description: board.project.description,
        slack_webhook_url: board.project.slack_webhook_url,
        prefix: board.project.prefix,
        workspace_id: board.project.workspace_id,
        tenant_id: board.project.tenant_id,
        created_by_id: board.project.created_by_id,
        background_color: board.project.background_color.clone(),
        is_sample: board.project.is_sample,
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

/// PUT /api/projects/:id
///
/// Update a project's name and description.
async fn update_project(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>> {
    // Check project membership with editor or owner role
    let role = projects::get_board_member_role(&state.db, id, auth.0.user_id).await?;
    match role {
        Some(BoardMemberRole::Owner | BoardMemberRole::Editor) => {}
        Some(BoardMemberRole::Viewer) => {
            return Err(AppError::Forbidden("Editor role required".into()));
        }
        None => {
            return Err(AppError::NotFound(
                "Project not found or access denied".into(),
            ));
        }
    }

    // Validate string lengths
    if let Some(ref n) = payload.name {
        validate_required_string("Project name", n, MAX_NAME_LEN)?;
    }
    validate_optional_string(
        "Description",
        payload.description.as_deref(),
        MAX_PROJECT_DESCRIPTION_LEN,
    )?;

    let name = payload.name.as_deref().map(|n| n.trim());

    let bg_color = payload.background_color.as_ref().map(|c| c.as_deref());
    let board = projects::update_board(
        &state.db,
        id,
        name,
        payload.description.as_deref(),
        bg_color,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    // Invalidate workspace projects cache and project detail cache
    cache::cache_del(
        &state.redis,
        &cache::workspace_projects_key(&board.workspace_id),
    )
    .await;
    cache::cache_del(&state.redis, &cache::project_detail_key(&id)).await;

    Ok(Json(ProjectResponse {
        id: board.id,
        name: board.name,
        description: board.description,
        slack_webhook_url: board.slack_webhook_url,
        prefix: board.prefix,
        workspace_id: board.workspace_id,
        tenant_id: board.tenant_id,
        created_by_id: board.created_by_id,
        background_color: board.background_color,
        is_sample: board.is_sample,
        created_at: board.created_at,
        updated_at: board.updated_at,
    }))
}

/// DELETE /api/projects/:id
///
/// Soft-delete a project.
/// Requires Manager or Admin role.
async fn delete_project(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
) -> Result<Json<MessageResponse>> {
    // Check project membership
    let is_member = projects::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    // Get workspace_id for cache invalidation before deletion
    let project_info = projects::get_board_by_id(&state.db, id, auth.0.user_id).await?;

    let deleted = projects::soft_delete_board(&state.db, id).await?;

    if deleted {
        // Invalidate workspace projects cache and project detail cache
        if let Some(info) = project_info {
            cache::cache_del(
                &state.redis,
                &cache::workspace_projects_key(&info.project.workspace_id),
            )
            .await;
            cache::cache_del(&state.redis, &cache::project_detail_key(&id)).await;
            // Also invalidate task cache for this project
            cache::cache_del(&state.redis, &cache::project_tasks_key(&id)).await;
        }
        Ok(Json(MessageResponse {
            message: "Project deleted successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Project not found".into()))
    }
}

/// GET /api/projects/:id/members
///
/// List all members of a project.
async fn list_project_members(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ProjectMemberResponse>>> {
    // Check project membership
    let is_member = projects::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    let members = projects::list_board_members(&state.db, id).await?;

    let response: Vec<ProjectMemberResponse> = members
        .into_iter()
        .map(|m| ProjectMemberResponse {
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

/// POST /api/projects/:id/members
///
/// Add a user to a project.
/// Requires Manager or Admin role.
async fn add_project_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddProjectMemberRequest>,
) -> Result<Json<MessageResponse>> {
    // Check project membership
    let is_member = projects::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    // Get project to check workspace membership of the user being added
    let project = projects::get_board_internal(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    // Verify user is a workspace member
    let is_ws_member =
        workspaces::is_workspace_member(&state.db, project.workspace_id, payload.user_id).await?;
    if !is_ws_member {
        return Err(AppError::BadRequest(
            "User must be a workspace member first".into(),
        ));
    }

    projects::add_board_member(&state.db, id, payload.user_id, payload.role).await?;

    Ok(Json(MessageResponse {
        message: "Member added successfully".into(),
    }))
}

/// DELETE /api/projects/:id/members/:user_id
///
/// Remove a user from a project.
/// Requires Manager or Admin role.
async fn remove_project_member(
    State(state): State<AppState>,
    auth: ManagerOrAdmin,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<MessageResponse>> {
    // Check project membership
    let is_member = projects::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    let removed = projects::remove_board_member(&state.db, id, user_id).await?;

    if removed {
        Ok(Json(MessageResponse {
            message: "Member removed successfully".into(),
        }))
    } else {
        Err(AppError::NotFound("Member not found".into()))
    }
}

/// PATCH /api/projects/:id/members/:user_id
///
/// Update a project member's role.
/// Requires Editor role on the project.
async fn update_project_member_role(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateProjectMemberRoleRequest>,
) -> Result<Json<ProjectMemberResponse>> {
    // Check project membership with owner or editor role
    let role = projects::get_board_member_role(&state.db, id, auth.0.user_id).await?;
    match role {
        Some(BoardMemberRole::Owner | BoardMemberRole::Editor) => {}
        Some(BoardMemberRole::Viewer) => {
            return Err(AppError::Forbidden("Editor role required".into()));
        }
        None => {
            return Err(AppError::NotFound(
                "Project not found or access denied".into(),
            ));
        }
    }

    // Cannot change your own role
    if auth.0.user_id == user_id {
        return Err(AppError::BadRequest("Cannot change your own role".into()));
    }

    let updated = projects::update_board_member_role(&state.db, id, user_id, payload.role).await?;

    if !updated {
        return Err(AppError::NotFound("Project member not found".into()));
    }

    // Fetch the updated member info
    let members = projects::list_board_members(&state.db, id).await?;
    let member = members
        .into_iter()
        .find(|m| m.user_id == user_id)
        .ok_or_else(|| AppError::NotFound("Project member not found".into()))?;

    Ok(Json(ProjectMemberResponse {
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

/// POST /api/projects/:id/duplicate
///
/// Duplicate a project with statuses and optionally tasks.
async fn duplicate_project(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<DuplicateProjectRequest>,
) -> Result<Json<ProjectDetailResponse>> {
    // Verify membership
    let is_member = projects::is_board_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    validate_required_string("Project name", &payload.name, MAX_NAME_LEN)?;

    let name = payload.name.trim();

    let include_tasks = payload.include_tasks.unwrap_or(false);

    let result =
        projects::duplicate_board(&state.db, id, name, include_tasks, auth.0.user_id).await?;

    // Invalidate workspace projects cache
    cache::cache_del(
        &state.redis,
        &cache::workspace_projects_key(&result.project.workspace_id),
    )
    .await;

    Ok(Json(ProjectDetailResponse {
        id: result.project.id,
        name: result.project.name,
        description: result.project.description,
        slack_webhook_url: result.project.slack_webhook_url,
        prefix: result.project.prefix,
        workspace_id: result.project.workspace_id,
        tenant_id: result.project.tenant_id,
        created_by_id: result.project.created_by_id,
        background_color: result.project.background_color,
        is_sample: result.project.is_sample,
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

/// GET /api/project-templates
///
/// List available project templates.
async fn list_project_templates() -> Json<Vec<board_templates::BoardTemplate>> {
    Json(board_templates::TEMPLATES.to_vec())
}

/// GET /api/projects/:id/full
///
/// Get a project with statuses, tasks (with badge data), and members in a single request.
/// This batch endpoint replaces multiple separate API calls needed to render a project view.
/// Supports optional `?limit=` and `?offset=` query params for task pagination.
async fn get_project_full(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Query(query): Query<ProjectFullQuery>,
) -> Result<Json<ProjectFullResponse>> {
    let limit = query.limit.unwrap_or(1000).clamp(1, 1000);
    let offset = query.offset.unwrap_or(0).max(0);

    // Fetch project+statuses, tasks with badges, members, assignees, and labels in parallel
    let (board_result, tasks_result, members_result, assignees_result, labels_result) = tokio::join!(
        projects::get_board_by_id(&state.db, id, auth.0.user_id),
        projects::list_board_tasks_with_badges(
            &state.db,
            id,
            auth.0.user_id,
            Some(limit),
            Some(offset)
        ),
        projects::list_board_members(&state.db, id),
        projects::list_board_task_assignees(&state.db, id),
        projects::list_board_task_labels(&state.db, id),
    );

    let board = board_result?
        .ok_or_else(|| AppError::NotFound("Project not found or access denied".into()))?;

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

    let project_detail = ProjectDetailResponse {
        id: board.project.id,
        name: board.project.name,
        description: board.project.description,
        slack_webhook_url: board.project.slack_webhook_url,
        prefix: board.project.prefix,
        workspace_id: board.project.workspace_id,
        tenant_id: board.project.tenant_id,
        created_by_id: board.project.created_by_id,
        background_color: board.project.background_color.clone(),
        is_sample: board.project.is_sample,
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

    let member_responses: Vec<ProjectMemberResponse> = members
        .into_iter()
        .map(|m| ProjectMemberResponse {
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

    Ok(Json(ProjectFullResponse {
        project: project_detail,
        tasks,
        members: member_responses,
        meta: ProjectMeta {
            total_task_count,
            current_limit: limit,
            current_offset: offset,
        },
    }))
}

// ============================================================================
// Routers
// ============================================================================

/// Build the projects router for workspace-scoped routes
/// Routes: /api/workspaces/:workspace_id/projects
pub fn workspace_projects_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_projects).post(create_project))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// GET /api/projects/:id/overview
///
/// Get aggregated project data: task counts, overdue, milestones, activity, members.
async fn get_project_overview(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
) -> Result<Json<taskflow_db::queries::project_overview::ProjectOverview>> {
    // Verify project membership
    let is_member = projects::is_project_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    let overview =
        taskflow_db::queries::project_overview::get_project_overview(&state.db, id).await?;

    Ok(Json(overview))
}

/// Build the projects router for direct project routes
/// Routes: /api/projects/:id
pub fn project_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/{id}",
            get(get_project)
                .put(update_project)
                .patch(update_project)
                .delete(delete_project),
        )
        .route("/{id}/full", get(get_project_full))
        .route("/{id}/overview", get(get_project_overview))
        .route("/{id}/duplicate", axum::routing::post(duplicate_project))
        .route(
            "/{id}/members",
            get(list_project_members).post(add_project_member),
        )
        .route(
            "/{id}/members/{user_id}",
            delete(remove_project_member).patch(update_project_member_role),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

/// Build the project templates router
/// Routes: /api/project-templates
pub fn project_templates_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_project_templates))
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
