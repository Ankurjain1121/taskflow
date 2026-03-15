//! Admin trash bin routes
//!
//! Provides tenant-wide trash operations. All endpoints require Admin role.
//!
//! All logic is delegated to `trash_queries` with `TrashScope::Tenant`.

use axum::{
    extract::{Path, Query, State},
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Json, Router,
};
use uuid::Uuid;

use crate::errors::Result;
use crate::extractors::AdminUser;
use crate::middleware::auth_middleware;
use crate::state::AppState;

use super::trash_queries::{
    self, EmptyTrashResponse, RestoreRequest, TrashListResponse, TrashOpResponse, TrashQuery,
    TrashScope,
};

/// GET /api/admin/trash
async fn list_trash(
    State(state): State<AppState>,
    admin: AdminUser,
    Query(query): Query<TrashQuery>,
) -> Result<Json<TrashListResponse>> {
    let scope = TrashScope::Tenant(admin.0.tenant_id);
    let response = trash_queries::list_trash(&state.db, &scope, &query).await?;
    Ok(Json(response))
}

/// POST /api/admin/trash/restore
async fn restore_item(
    State(state): State<AppState>,
    admin: AdminUser,
    Json(body): Json<RestoreRequest>,
) -> Result<Json<TrashOpResponse>> {
    let scope = TrashScope::Tenant(admin.0.tenant_id);
    let response = trash_queries::restore_item(
        &state.db,
        &scope,
        &body.entity_type,
        body.entity_id,
        admin.0.user_id,
    )
    .await?;
    Ok(Json(response))
}

/// DELETE /api/admin/trash/:entity_type/:entity_id
async fn delete_item(
    State(state): State<AppState>,
    admin: AdminUser,
    Path((entity_type_str, entity_id)): Path<(String, Uuid)>,
) -> Result<Json<TrashOpResponse>> {
    let scope = TrashScope::Tenant(admin.0.tenant_id);
    let response =
        trash_queries::delete_item(&state, &scope, &entity_type_str, entity_id).await?;
    Ok(Json(response))
}

/// DELETE /api/admin/trash/empty
async fn empty_trash_handler(
    State(state): State<AppState>,
    admin: AdminUser,
) -> Result<Json<EmptyTrashResponse>> {
    let response = trash_queries::empty_trash(&state, admin.0.tenant_id).await?;
    Ok(Json(response))
}

pub fn admin_trash_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/admin/trash", get(list_trash))
        .route("/admin/trash/restore", post(restore_item))
        .route(
            "/admin/trash/{entity_type}/{entity_id}",
            delete(delete_item),
        )
        .route("/admin/trash/empty", delete(empty_trash_handler))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}

#[cfg(test)]
mod tests {
    use super::trash_queries::{RestoreRequest, TrashQuery};

    #[test]
    fn test_default_page_size() {
        let json = r#"{}"#;
        let query: TrashQuery = serde_json::from_str(json).unwrap();
        assert_eq!(query.page_size, 20);
    }

    #[test]
    fn test_restore_request_deserialize() {
        let json =
            r#"{"entity_type": "task", "entity_id": "550e8400-e29b-41d4-a716-446655440000"}"#;
        let req: RestoreRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.entity_type, "task");
    }
}
