//! Workspace Labels REST endpoints
//!
//! CRUD operations for workspace-level labels.

use axum::{
    extract::{Path, State},
    middleware::from_fn_with_state,
    routing::{get, put},
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
pub struct CreateLabelRequest {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLabelRequest {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LabelResponse {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    pub workspace_id: Uuid,
    pub board_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workspaces/:workspace_id/labels
///
/// List all workspace-level labels (where board_id IS NULL).
async fn list_labels(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
) -> Result<Json<Vec<LabelResponse>>> {
    // Verify workspace membership
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let labels: Vec<LabelResponse> = sqlx::query_as(
        r#"
        SELECT id, name, color, workspace_id, board_id, created_at
        FROM labels
        WHERE workspace_id = $1 AND board_id IS NULL
        ORDER BY name ASC
        "#,
    )
    .bind(workspace_id)
    .fetch_all(&state.db)
    .await
    .map_err(AppError::from)?;

    Ok(Json(labels))
}

/// POST /api/workspaces/:workspace_id/labels
///
/// Create a new workspace-level label.
async fn create_label(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(workspace_id): Path<Uuid>,
    Json(payload): Json<CreateLabelRequest>,
) -> Result<Json<LabelResponse>> {
    // Verify workspace membership
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Label name is required".into()));
    }
    if name.len() > 100 {
        return Err(AppError::BadRequest(
            "Label name must be 100 characters or less".into(),
        ));
    }

    let color = payload.color.trim();
    if color.is_empty() || color.len() > 7 {
        return Err(AppError::BadRequest(
            "Color must be a valid hex color (e.g. #FF5733)".into(),
        ));
    }

    let label: LabelResponse = sqlx::query_as(
        r#"
        INSERT INTO labels (name, color, workspace_id, tenant_id, created_by_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, color, workspace_id, board_id, created_at
        "#,
    )
    .bind(name)
    .bind(color)
    .bind(workspace_id)
    .bind(auth.0.tenant_id)
    .bind(auth.0.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return AppError::Conflict(format!(
                    "Label '{}' already exists in this workspace",
                    name
                ));
            }
        }
        AppError::from(e)
    })?;

    Ok(Json(label))
}

/// PUT /api/workspaces/:workspace_id/labels/:label_id
async fn update_label_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, label_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateLabelRequest>,
) -> Result<Json<LabelResponse>> {
    // Verify workspace membership
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Label name is required".into()));
    }

    let color = payload.color.trim();
    if color.is_empty() || color.len() > 7 {
        return Err(AppError::BadRequest(
            "Color must be a valid hex color (e.g. #FF5733)".into(),
        ));
    }

    let label: LabelResponse = sqlx::query_as(
        r#"
        UPDATE labels
        SET name = $1, color = $2
        WHERE id = $3 AND workspace_id = $4 AND board_id IS NULL
        RETURNING id, name, color, workspace_id, board_id, created_at
        "#,
    )
    .bind(name)
    .bind(color)
    .bind(label_id)
    .bind(workspace_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint().is_some() {
                return AppError::Conflict(format!(
                    "Label '{}' already exists in this workspace",
                    name
                ));
            }
        }
        AppError::from(e)
    })?
    .ok_or_else(|| AppError::NotFound("Label not found".into()))?;

    Ok(Json(label))
}

/// DELETE /api/workspaces/:workspace_id/labels/:label_id
///
/// Delete a workspace-level label.
async fn delete_label(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path((workspace_id, label_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>> {
    // Verify workspace membership
    let is_member = taskflow_db::queries::workspaces::is_workspace_member(
        &state.db,
        workspace_id,
        auth.0.user_id,
    )
    .await?;
    if !is_member {
        return Err(AppError::Forbidden("Not a member of this workspace".into()));
    }

    let result =
        sqlx::query("DELETE FROM labels WHERE id = $1 AND workspace_id = $2 AND board_id IS NULL")
            .bind(label_id)
            .bind(workspace_id)
            .execute(&state.db)
            .await
            .map_err(AppError::from)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Label not found".into()));
    }

    Ok(Json(
        serde_json::json!({ "message": "Label deleted successfully" }),
    ))
}

// ============================================================================
// Router
// ============================================================================

pub fn workspace_labels_router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_labels).post(create_label))
        .route(
            "/{label_id}",
            put(update_label_handler).delete(delete_label),
        )
        .layer(from_fn_with_state(state.clone(), auth_middleware))
}
