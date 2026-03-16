use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use serde_json::json;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::auth_middleware;
use crate::state::AppState;
use taskflow_db::queries::dependencies::{
    check_blockers, create_dependency, delete_dependency, get_board_dependencies,
    list_dependencies, BlockerInfo, CreateDependencyInput, DependencyQueryError,
    DependencyWithTask,
};
use taskflow_db::queries::get_task_project_id;

/// Helper: verify board membership through task -> board chain
async fn verify_task_board_membership(
    state: &AppState,
    task_id: Uuid,
    user_id: Uuid,
) -> Result<Uuid> {
    let board_id = get_task_project_id(&state.db, task_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".into()))?;

    let is_member = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM board_members
            WHERE board_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(board_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden("Not a project member".into()));
    }

    Ok(board_id)
}

/// Map DependencyQueryError to AppError
fn map_dep_error(e: DependencyQueryError) -> AppError {
    match e {
        DependencyQueryError::NotFound => AppError::NotFound("Dependency not found".into()),
        DependencyQueryError::NotBoardMember => AppError::Forbidden("Not a project member".into()),
        DependencyQueryError::CircularDependency => {
            AppError::BadRequest("Circular dependency detected".into())
        }
        DependencyQueryError::CrossBoardDependency => {
            AppError::BadRequest("Dependencies must be between tasks on the same board".into())
        }
        DependencyQueryError::Database(e) => AppError::SqlxError(e),
    }
}

/// GET /api/tasks/{task_id}/dependencies
/// List all dependencies for a task
async fn list_dependencies_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<DependencyWithTask>>> {
    let deps = list_dependencies(&state.db, task_id, tenant.user_id)
        .await
        .map_err(map_dep_error)?;

    Ok(Json(deps))
}

/// POST /api/tasks/{task_id}/dependencies
/// Create a new dependency
async fn create_dependency_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
    Json(body): Json<CreateDependencyInput>,
) -> Result<Json<DependencyWithTask>> {
    let dep = create_dependency(&state.db, task_id, body, tenant.user_id)
        .await
        .map_err(map_dep_error)?;

    Ok(Json(dep))
}

/// DELETE /api/dependencies/{id}
/// Delete a dependency
async fn delete_dependency_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(dep_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    // Look up the dependency's source task to verify board membership
    let source_task_id: Option<Uuid> =
        sqlx::query_scalar("SELECT source_task_id FROM task_dependencies WHERE id = $1")
            .bind(dep_id)
            .fetch_optional(&state.db)
            .await?;

    let source_task_id =
        source_task_id.ok_or_else(|| AppError::NotFound("Dependency not found".into()))?;

    verify_task_board_membership(&state, source_task_id, tenant.user_id).await?;

    delete_dependency(&state.db, dep_id)
        .await
        .map_err(map_dep_error)?;

    Ok(Json(json!({ "success": true })))
}

/// GET /api/tasks/{task_id}/blockers
/// Check blockers for a task
async fn check_blockers_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(task_id): Path<Uuid>,
) -> Result<Json<Vec<BlockerInfo>>> {
    // Verify board membership
    verify_task_board_membership(&state, task_id, tenant.user_id).await?;

    let blockers = check_blockers(&state.db, task_id)
        .await
        .map_err(map_dep_error)?;

    Ok(Json(blockers))
}

/// GET /api/boards/{board_id}/dependencies
/// Get all dependencies for a board
async fn board_dependencies_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<DependencyWithTask>>> {
    let deps = get_board_dependencies(&state.db, board_id, tenant.user_id)
        .await
        .map_err(map_dep_error)?;

    Ok(Json(deps))
}

/// Create the dependency router
pub fn dependency_router(state: AppState) -> Router<AppState> {
    Router::new()
        // Task-scoped dependency routes
        .route(
            "/tasks/{task_id}/dependencies",
            get(list_dependencies_handler),
        )
        .route(
            "/tasks/{task_id}/dependencies",
            post(create_dependency_handler),
        )
        .route("/tasks/{task_id}/blockers", get(check_blockers_handler))
        // Dependency-specific routes
        .route("/dependencies/{id}", delete(delete_dependency_handler))
        // Board-level dependency routes
        .route(
            "/projects/{board_id}/dependencies",
            get(board_dependencies_handler),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
