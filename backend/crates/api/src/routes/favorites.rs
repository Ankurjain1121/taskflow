use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::TenantContext;
use crate::middleware::{auth_middleware, csrf_middleware};
use crate::state::AppState;
use taskflow_db::queries::favorites::{
    add_favorite, is_favorited, list_favorites, remove_favorite, FavoriteItem,
};

/// Request body for adding a favorite
#[derive(Debug, Deserialize)]
pub struct AddFavoriteRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
}

/// GET /api/favorites
///
/// List all favorites for the current user.
async fn list_favorites_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
) -> Result<Json<Vec<FavoriteItem>>> {
    let items = list_favorites(&state.db, tenant.user_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to list favorites: {}", e)))?;

    Ok(Json(items))
}

/// POST /api/favorites
///
/// Add an entity to favorites.
async fn add_favorite_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Json(body): Json<AddFavoriteRequest>,
) -> Result<Json<serde_json::Value>> {
    // Validate entity_type (accept both "project" and legacy "board")
    if body.entity_type != "task" && body.entity_type != "project" && body.entity_type != "board" {
        return Err(AppError::BadRequest(format!(
            "Invalid entity_type: {}. Must be 'task' or 'project'",
            body.entity_type
        )));
    }

    // Verify entity exists and belongs to tenant
    verify_entity_access(&state, &body.entity_type, body.entity_id, tenant.tenant_id).await?;

    let id = add_favorite(&state.db, tenant.user_id, &body.entity_type, body.entity_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to add favorite: {}", e)))?;

    Ok(Json(serde_json::json!({ "id": id, "success": true })))
}

/// DELETE /api/favorites/{entity_type}/{entity_id}
///
/// Remove an entity from favorites.
async fn remove_favorite_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let removed = remove_favorite(&state.db, tenant.user_id, &entity_type, entity_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to remove favorite: {}", e)))?;

    if !removed {
        return Err(AppError::NotFound("Favorite not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "success": true })))
}

/// GET /api/favorites/check/{entity_type}/{entity_id}
///
/// Check if an entity is favorited by the current user.
async fn check_favorite_handler(
    State(state): State<AppState>,
    tenant: TenantContext,
    Path((entity_type, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let favorited = is_favorited(&state.db, tenant.user_id, &entity_type, entity_id)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to check favorite: {}", e)))?;

    Ok(Json(serde_json::json!({ "favorited": favorited })))
}

/// Verify that an entity exists and belongs to the tenant
async fn verify_entity_access(
    state: &AppState,
    entity_type: &str,
    entity_id: Uuid,
    tenant_id: Uuid,
) -> Result<()> {
    let exists: (bool,) = match entity_type {
        "task" => {
            sqlx::query_as(
                r#"SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"#,
            )
            .bind(entity_id)
            .bind(tenant_id)
            .fetch_one(&state.db)
            .await?
        }
        "project" | "board" => {
            sqlx::query_as(
                r#"SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL)"#,
            )
            .bind(entity_id)
            .bind(tenant_id)
            .fetch_one(&state.db)
            .await?
        }
        _ => return Err(AppError::BadRequest(format!("Invalid entity type: {}", entity_type))),
    };

    if !exists.0 {
        return Err(AppError::NotFound(format!("{} not found", entity_type)));
    }

    Ok(())
}

/// Create the favorites router
pub fn favorites_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_favorites_handler))
        .route("/", post(add_favorite_handler))
        .route(
            "/{entity_type}/{entity_id}",
            delete(remove_favorite_handler),
        )
        .route(
            "/check/{entity_type}/{entity_id}",
            get(check_favorite_handler),
        )
        .layer(from_fn_with_state(state.clone(), csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
