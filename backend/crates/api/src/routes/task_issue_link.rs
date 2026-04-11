use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;

use super::common::verify_project_membership;
use taskbolt_db::queries::issues::get_issue_project_id;
use taskbolt_db::queries::task_issue_links::{
    create_link, delete_link, list_linked_issues, list_linked_tasks, LinkedIssueRow,
    LinkedTaskRow, TaskIssueLinkError,
};
use taskbolt_db::queries::tasks::get_task_project_id;

fn map_err(e: TaskIssueLinkError) -> AppError {
    match e {
        TaskIssueLinkError::NotFound => AppError::NotFound("Task or issue not found".into()),
        TaskIssueLinkError::ProjectMismatch => {
            AppError::BadRequest("Task and issue must be in the same project".into())
        }
        TaskIssueLinkError::AlreadyExists => {
            AppError::Conflict("Link already exists".into())
        }
        TaskIssueLinkError::Database(e) => AppError::SqlxError(e),
    }
}

#[derive(Deserialize)]
pub struct LinkIssueRequest {
    pub issue_id: Uuid,
}

/// POST /api/tasks/{task_id}/linked-issues
async fn link_issue_to_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<LinkIssueRequest>,
) -> Result<Json<serde_json::Value>> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;
    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    create_link(&state.db, task_id, body.issue_id, tenant.user_id)
        .await
        .map_err(map_err)?;
    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/tasks/{task_id}/linked-issues/{issue_id}
async fn unlink_issue_from_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((task_id, issue_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;
    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    delete_link(&state.db, task_id, issue_id).await.map_err(map_err)?;
    Ok(Json(json!({ "success": true })))
}

/// GET /api/tasks/{task_id}/linked-issues
async fn get_linked_issues_for_task(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<LinkedIssueRow>>> {
    let project_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;
    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let rows = list_linked_issues(&state.db, task_id).await?;
    Ok(Json(rows))
}

/// GET /api/issues/{issue_id}/linked-tasks
async fn get_linked_tasks_for_issue(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(issue_id): Path<Uuid>,
) -> Result<Json<Vec<LinkedTaskRow>>> {
    let project_id = get_issue_project_id(&state.db, issue_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Issue not found".into()))?;
    verify_project_membership(&state.db, project_id, tenant.user_id, &tenant.role).await?;

    let rows = list_linked_tasks(&state.db, issue_id).await?;
    Ok(Json(rows))
}

pub fn task_issue_link_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route(
            "/tasks/{task_id}/linked-issues",
            get(get_linked_issues_for_task).post(link_issue_to_task),
        )
        .route(
            "/tasks/{task_id}/linked-issues/{issue_id}",
            axum::routing::delete(unlink_issue_from_task),
        )
        .route(
            "/issues/{issue_id}/linked-tasks",
            get(get_linked_tasks_for_issue),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
