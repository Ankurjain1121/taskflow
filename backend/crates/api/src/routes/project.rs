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

use taskflow_db::models::ProjectMemberRole;
use taskflow_db::queries::{columns, projects, workspaces};
use taskflow_db::utils::generate_key_between;

use taskflow_services::project_templates;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, ManagerOrAdmin};
use crate::middleware::auth_middleware;
use crate::services::cache;
use crate::services::http_cache::{check_if_none_match, generate_etag};
use crate::state::AppState;

use super::common::MessageResponse;
use super::project_types::*;

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
        projects::list_projects_by_workspace(&state.db, workspace_id, auth.0.user_id).await?;

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
/// Get a project by ID with its columns.
/// Returns 304 Not Modified if the ETag matches (If-None-Match header).
async fn get_project(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    headers: axum::http::HeaderMap,
) -> Result<axum::response::Response> {
    let proj = projects::get_project_by_id(&state.db, id, auth.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found or access denied".into()))?;

    let response = ProjectDetailResponse {
        id: proj.project.id,
        name: proj.project.name,
        description: proj.project.description,
        slack_webhook_url: proj.project.slack_webhook_url,
        prefix: proj.project.prefix,
        workspace_id: proj.project.workspace_id,
        tenant_id: proj.project.tenant_id,
        created_by_id: proj.project.created_by_id,
        background_color: proj.project.background_color.clone(),
        created_at: proj.project.created_at,
        updated_at: proj.project.updated_at,
        columns: proj
            .columns
            .into_iter()
            .map(|c| ColumnResponse {
                id: c.id,
                name: c.name,
                project_id: c.project_id,
                position: c.position,
                color: c.color,
                status_mapping: c.status_mapping,
                wip_limit: c.wip_limit,
                created_at: c.created_at,
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

/// POST /api/workspaces/:workspace_id/projects
///
/// Create a new project with default columns.
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

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Project name is required".into()));
    }

    let proj = projects::create_project(
        &state.db,
        name,
        payload.description.as_deref(),
        workspace_id,
        auth.0.tenant_id,
        auth.0.user_id,
    )
    .await?;

    // If a template was specified (and it's not the default kanban that create_project already creates),
    // replace the default columns with template columns
    let mut final_columns = proj.columns;

    if let Some(ref template_id) = payload.template {
        if let Some(template) = project_templates::get_template(template_id) {
            // Delete the default columns that were auto-created
            for col in &final_columns {
                let _ = columns::force_delete_column(&state.db, col.id).await;
            }
            final_columns.clear();

            if template_id == "blank" {
                // Blank template: no columns
            } else {
                // Create columns from the template
                let mut prev_pos: Option<String> = None;
                for template_col in template.columns {
                    let position = generate_key_between(prev_pos.as_deref(), None);

                    let status_mapping = if template_col.is_done {
                        Some(serde_json::json!({"done": true}))
                    } else {
                        None
                    };

                    let col = columns::add_column(
                        &state.db,
                        proj.project.id,
                        template_col.name,
                        Some(template_col.color),
                        status_mapping,
                        &position,
                    )
                    .await?;

                    prev_pos = Some(position);
                    final_columns.push(col);
                }
            }
        }
    }

    // Invalidate workspace projects cache
    cache::cache_del(&state.redis, &cache::workspace_projects_key(&workspace_id)).await;

    Ok(Json(ProjectDetailResponse {
        id: proj.project.id,
        name: proj.project.name,
        description: proj.project.description,
        slack_webhook_url: proj.project.slack_webhook_url,
        prefix: proj.project.prefix,
        workspace_id: proj.project.workspace_id,
        tenant_id: proj.project.tenant_id,
        created_by_id: proj.project.created_by_id,
        background_color: proj.project.background_color.clone(),
        created_at: proj.project.created_at,
        updated_at: proj.project.updated_at,
        columns: final_columns
            .into_iter()
            .map(|c| ColumnResponse {
                id: c.id,
                name: c.name,
                project_id: c.project_id,
                position: c.position,
                color: c.color,
                status_mapping: c.status_mapping,
                wip_limit: c.wip_limit,
                created_at: c.created_at,
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
    let role = projects::get_project_member_role(&state.db, id, auth.0.user_id).await?;
    match role {
        Some(ProjectMemberRole::Owner | ProjectMemberRole::Editor) => {}
        Some(ProjectMemberRole::Viewer) => {
            return Err(AppError::Forbidden("Editor role required".into()));
        }
        None => {
            return Err(AppError::NotFound(
                "Project not found or access denied".into(),
            ));
        }
    }

    let name = payload.name.as_deref().map(|n| n.trim());
    if let Some(n) = name {
        if n.is_empty() {
            return Err(AppError::BadRequest("Project name is required".into()));
        }
    }

    let bg_color = payload.background_color.as_ref().map(|c| c.as_deref());
    let proj = projects::update_project(
        &state.db,
        id,
        name,
        payload.description.as_deref(),
        bg_color,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    // Invalidate workspace projects cache
    cache::cache_del(
        &state.redis,
        &cache::workspace_projects_key(&proj.workspace_id),
    )
    .await;

    Ok(Json(ProjectResponse {
        id: proj.id,
        name: proj.name,
        description: proj.description,
        slack_webhook_url: proj.slack_webhook_url,
        prefix: proj.prefix,
        workspace_id: proj.workspace_id,
        tenant_id: proj.tenant_id,
        created_by_id: proj.created_by_id,
        background_color: proj.background_color,
        created_at: proj.created_at,
        updated_at: proj.updated_at,
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
    let is_member = projects::is_project_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    // Get workspace_id for cache invalidation before deletion
    let project_info = projects::get_project_by_id(&state.db, id, auth.0.user_id).await?;

    let deleted = projects::soft_delete_project(&state.db, id).await?;

    if deleted {
        // Invalidate workspace projects cache
        if let Some(info) = project_info {
            cache::cache_del(
                &state.redis,
                &cache::workspace_projects_key(&info.project.workspace_id),
            )
            .await;
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
    let is_member = projects::is_project_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    let members = projects::list_project_members(&state.db, id).await?;

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
    let is_member = projects::is_project_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    // Get project to check workspace membership of the user being added
    let proj = projects::get_project_internal(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("Project not found".into()))?;

    // Verify user is a workspace member
    let is_ws_member =
        workspaces::is_workspace_member(&state.db, proj.workspace_id, payload.user_id).await?;
    if !is_ws_member {
        return Err(AppError::BadRequest(
            "User must be a workspace member first".into(),
        ));
    }

    projects::add_project_member(&state.db, id, payload.user_id, payload.role).await?;

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
    let is_member = projects::is_project_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    let removed = projects::remove_project_member(&state.db, id, user_id).await?;

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
    let role = projects::get_project_member_role(&state.db, id, auth.0.user_id).await?;
    match role {
        Some(ProjectMemberRole::Owner | ProjectMemberRole::Editor) => {}
        Some(ProjectMemberRole::Viewer) => {
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

    let updated =
        projects::update_project_member_role(&state.db, id, user_id, payload.role).await?;

    if !updated {
        return Err(AppError::NotFound("Project member not found".into()));
    }

    // Fetch the updated member info
    let members = projects::list_project_members(&state.db, id).await?;
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
/// Duplicate a project with columns and optionally tasks.
async fn duplicate_project(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Json(payload): Json<DuplicateProjectRequest>,
) -> Result<Json<ProjectDetailResponse>> {
    // Verify membership
    let is_member = projects::is_project_member(&state.db, id, auth.0.user_id).await?;
    if !is_member {
        return Err(AppError::NotFound(
            "Project not found or access denied".into(),
        ));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Project name is required".into()));
    }

    let include_tasks = payload.include_tasks.unwrap_or(false);

    let result =
        projects::duplicate_project(&state.db, id, name, include_tasks, auth.0.user_id).await?;

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
        created_at: result.project.created_at,
        updated_at: result.project.updated_at,
        columns: result
            .columns
            .into_iter()
            .map(|c| ColumnResponse {
                id: c.id,
                name: c.name,
                project_id: c.project_id,
                position: c.position,
                color: c.color,
                status_mapping: c.status_mapping,
                wip_limit: c.wip_limit,
                created_at: c.created_at,
            })
            .collect(),
    }))
}

/// GET /api/projects/:id/full
///
/// Get a project with columns, tasks (with badge data), and members in a single request.
/// This batch endpoint replaces 6+ separate API calls needed to render a project view.
/// Supports optional `?limit=` and `?offset=` query params for task pagination.
async fn get_project_full(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(id): Path<Uuid>,
    Query(query): Query<ProjectFullQuery>,
) -> Result<Json<ProjectFullResponse>> {
    let limit = query.limit.unwrap_or(1000).clamp(1, 1000);
    let offset = query.offset.unwrap_or(0).max(0);

    // Fetch project+columns, tasks with badges, members, assignees, and labels in parallel
    let (project_result, tasks_result, members_result, assignees_result, labels_result) = tokio::join!(
        projects::get_project_by_id(&state.db, id, auth.0.user_id),
        projects::list_project_tasks_with_badges(&state.db, id, Some(limit), Some(offset)),
        projects::list_project_members(&state.db, id),
        projects::list_project_task_assignees(&state.db, id),
        projects::list_project_task_labels(&state.db, id),
    );

    let proj = project_result?
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
                column_id: t.column_id,
                position: t.position,
                group_id: t.group_id,
                milestone_id: t.milestone_id,
                created_by_id: t.created_by_id,
                created_at: t.created_at,
                updated_at: t.updated_at,
                column_entered_at: t.column_entered_at,
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
        id: proj.project.id,
        name: proj.project.name,
        description: proj.project.description,
        slack_webhook_url: proj.project.slack_webhook_url,
        prefix: proj.project.prefix,
        workspace_id: proj.project.workspace_id,
        tenant_id: proj.project.tenant_id,
        created_by_id: proj.project.created_by_id,
        background_color: proj.project.background_color.clone(),
        created_at: proj.project.created_at,
        updated_at: proj.project.updated_at,
        columns: proj
            .columns
            .into_iter()
            .map(|c| ColumnResponse {
                id: c.id,
                name: c.name,
                project_id: c.project_id,
                position: c.position,
                color: c.color,
                status_mapping: c.status_mapping,
                wip_limit: c.wip_limit,
                created_at: c.created_at,
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
        .layer(from_fn_with_state(state.clone(), auth_middleware))
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
        .route("/{id}/duplicate", axum::routing::post(duplicate_project))
        .route(
            "/{id}/members",
            get(list_project_members).post(add_project_member),
        )
        .route(
            "/{id}/members/{user_id}",
            delete(remove_project_member).patch(update_project_member_role),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

