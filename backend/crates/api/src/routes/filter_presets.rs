//! Filter Presets REST endpoints
//!
//! CRUD operations for per-user per-board saved filter presets.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::get,
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::auth_middleware;
use crate::state::AppState;

// ============================================================================
// DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateFilterPresetRequest {
    pub name: String,
    pub filters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFilterPresetRequest {
    pub name: Option<String>,
    pub filters: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FilterPresetResponse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub board_id: Uuid,
    pub name: String,
    pub filters: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/boards/:board_id/filter-presets
///
/// List all filter presets for the current user on this board.
async fn list_presets(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(board_id): Path<Uuid>,
) -> Result<Json<Vec<FilterPresetResponse>>> {
    let presets: Vec<FilterPresetResponse> = sqlx::query_as(
        r#"
        SELECT id, user_id, board_id, name, filters, created_at, updated_at
        FROM filter_presets
        WHERE user_id = $1 AND board_id = $2
        ORDER BY name ASC
        "#,
    )
    .bind(auth.0.user_id)
    .bind(board_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(presets))
}

/// POST /api/boards/:board_id/filter-presets
///
/// Create a new filter preset for the current user.
async fn create_preset(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(board_id): Path<Uuid>,
    Json(payload): Json<CreateFilterPresetRequest>,
) -> Result<Json<FilterPresetResponse>> {
    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Preset name is required".into()));
    }
    if name.len() > 100 {
        return Err(AppError::BadRequest(
            "Preset name must be 100 characters or less".into(),
        ));
    }

    let preset: FilterPresetResponse = sqlx::query_as(
        r#"
        INSERT INTO filter_presets (user_id, board_id, name, filters, tenant_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, board_id, name, filters, created_at, updated_at
        "#,
    )
    .bind(auth.0.user_id)
    .bind(board_id)
    .bind(name)
    .bind(&payload.filters)
    .bind(auth.0.tenant_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return AppError::Conflict(format!(
                    "Preset '{}' already exists for this board",
                    name
                ));
            }
        }
        AppError::from(e)
    })?;

    Ok(Json(preset))
}

/// PUT /api/boards/:board_id/filter-presets/:preset_id
///
/// Update a filter preset.
async fn update_preset(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((board_id, preset_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateFilterPresetRequest>,
) -> Result<Json<FilterPresetResponse>> {
    // Verify ownership
    let existing: Option<FilterPresetResponse> = sqlx::query_as(
        "SELECT id, user_id, board_id, name, filters, created_at, updated_at FROM filter_presets WHERE id = $1 AND user_id = $2 AND board_id = $3",
    )
    .bind(preset_id)
    .bind(auth.0.user_id)
    .bind(board_id)
    .fetch_optional(&state.db)
    .await
    .map_err(AppError::from)?;

    let existing = existing.ok_or_else(|| AppError::NotFound("Preset not found".into()))?;

    let name = payload
        .name
        .as_deref()
        .map(|n| n.trim())
        .unwrap_or(&existing.name);
    let filters = payload.filters.as_ref().unwrap_or(&existing.filters);

    let updated: FilterPresetResponse = sqlx::query_as(
        r#"
        UPDATE filter_presets
        SET name = $1, filters = $2, updated_at = now()
        WHERE id = $3 AND user_id = $4
        RETURNING id, user_id, board_id, name, filters, created_at, updated_at
        "#,
    )
    .bind(name)
    .bind(filters)
    .bind(preset_id)
    .bind(auth.0.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(updated))
}

/// DELETE /api/boards/:board_id/filter-presets/:preset_id
///
/// Delete a filter preset.
async fn delete_preset(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((board_id, preset_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    let result =
        sqlx::query("DELETE FROM filter_presets WHERE id = $1 AND user_id = $2 AND board_id = $3")
            .bind(preset_id)
            .bind(auth.0.user_id)
            .bind(board_id)
            .execute(&state.db)
            .await
            .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Preset not found".into()));
    }

    Ok(Json(
        serde_json::json!({ "message": "Preset deleted successfully" }),
    ))
}

// ============================================================================
// Router
// ============================================================================

pub fn filter_presets_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_presets).post(create_preset))
        .route(
            "/{preset_id}",
            axum::routing::put(update_preset).delete(delete_preset),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
