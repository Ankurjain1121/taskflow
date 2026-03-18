//! Saved Views database queries
//!
//! CRUD operations for user-created saved views (filters, sorts, column configs).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

/// A saved view row
#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct SavedView {
    pub id: Uuid,
    pub user_id: Uuid,
    pub workspace_id: Uuid,
    pub project_id: Option<Uuid>,
    pub name: String,
    pub view_type: String,
    pub config: serde_json::Value,
    pub pinned: bool,
    pub shared: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input for creating a saved view
#[derive(Debug, Deserialize)]
pub struct CreateSavedViewInput {
    pub name: String,
    pub view_type: String,
    pub project_id: Option<Uuid>,
    pub config: Option<serde_json::Value>,
    pub pinned: Option<bool>,
    pub shared: Option<bool>,
}

/// Input for updating a saved view
#[derive(Debug, Deserialize)]
pub struct UpdateSavedViewInput {
    pub name: Option<String>,
    pub config: Option<serde_json::Value>,
    pub pinned: Option<bool>,
    pub shared: Option<bool>,
}

/// List saved views for a user in a workspace
pub async fn list_saved_views(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Uuid,
) -> Result<Vec<SavedView>, sqlx::Error> {
    sqlx::query_as::<_, SavedView>(
        r#"
        SELECT id, user_id, workspace_id, project_id, name, view_type,
               config, pinned, shared, created_at, updated_at
        FROM saved_views
        WHERE user_id = $1 AND workspace_id = $2
        ORDER BY pinned DESC, updated_at DESC
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_all(pool)
    .await
}

/// Create a saved view (enforces max 30 per user per workspace)
pub async fn create_saved_view(
    pool: &PgPool,
    user_id: Uuid,
    workspace_id: Uuid,
    input: &CreateSavedViewInput,
) -> Result<SavedView, SavedViewError> {
    // Check count
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM saved_views WHERE user_id = $1 AND workspace_id = $2",
    )
    .bind(user_id)
    .bind(workspace_id)
    .fetch_one(pool)
    .await
    .map_err(SavedViewError::Database)?;

    if count >= 30 {
        return Err(SavedViewError::LimitReached(
            "Maximum 30 saved views per workspace".to_string(),
        ));
    }

    let config = input.config.clone().unwrap_or(serde_json::json!({}));
    let pinned = input.pinned.unwrap_or(false);
    let shared = input.shared.unwrap_or(false);

    sqlx::query_as::<_, SavedView>(
        r#"
        INSERT INTO saved_views (user_id, workspace_id, project_id, name, view_type, config, pinned, shared)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, user_id, workspace_id, project_id, name, view_type,
                  config, pinned, shared, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(workspace_id)
    .bind(input.project_id)
    .bind(&input.name)
    .bind(&input.view_type)
    .bind(&config)
    .bind(pinned)
    .bind(shared)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e {
            if db_err.constraint() == Some("uq_saved_view_name") {
                return SavedViewError::DuplicateName;
            }
        }
        SavedViewError::Database(e)
    })
}

/// Update a saved view (verifies ownership)
pub async fn update_saved_view(
    pool: &PgPool,
    view_id: Uuid,
    user_id: Uuid,
    input: &UpdateSavedViewInput,
) -> Result<SavedView, SavedViewError> {
    let existing = get_saved_view(pool, view_id).await?;
    if existing.user_id != user_id {
        return Err(SavedViewError::NotOwner);
    }

    let name = input.name.as_deref().unwrap_or(&existing.name);
    let config = input.config.as_ref().unwrap_or(&existing.config);
    let pinned = input.pinned.unwrap_or(existing.pinned);
    let shared = input.shared.unwrap_or(existing.shared);

    sqlx::query_as::<_, SavedView>(
        r#"
        UPDATE saved_views
        SET name = $1, config = $2, pinned = $3, shared = $4, updated_at = NOW()
        WHERE id = $5
        RETURNING id, user_id, workspace_id, project_id, name, view_type,
                  config, pinned, shared, created_at, updated_at
        "#,
    )
    .bind(name)
    .bind(config)
    .bind(pinned)
    .bind(shared)
    .bind(view_id)
    .fetch_one(pool)
    .await
    .map_err(SavedViewError::Database)
}

/// Delete a saved view (verifies ownership)
pub async fn delete_saved_view(
    pool: &PgPool,
    view_id: Uuid,
    user_id: Uuid,
) -> Result<(), SavedViewError> {
    let result = sqlx::query("DELETE FROM saved_views WHERE id = $1 AND user_id = $2")
        .bind(view_id)
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(SavedViewError::Database)?;

    if result.rows_affected() == 0 {
        return Err(SavedViewError::NotFound);
    }
    Ok(())
}

/// Pin or unpin a saved view (enforces max 10 pinned globally)
pub async fn toggle_pin(
    pool: &PgPool,
    view_id: Uuid,
    user_id: Uuid,
    pinned: bool,
) -> Result<SavedView, SavedViewError> {
    let existing = get_saved_view(pool, view_id).await?;
    if existing.user_id != user_id {
        return Err(SavedViewError::NotOwner);
    }

    if pinned && !existing.pinned {
        let pinned_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM saved_views WHERE user_id = $1 AND pinned = true",
        )
        .bind(user_id)
        .fetch_one(pool)
        .await
        .map_err(SavedViewError::Database)?;

        if pinned_count >= 10 {
            return Err(SavedViewError::LimitReached(
                "Maximum 10 pinned views".to_string(),
            ));
        }
    }

    sqlx::query_as::<_, SavedView>(
        r#"
        UPDATE saved_views
        SET pinned = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, user_id, workspace_id, project_id, name, view_type,
                  config, pinned, shared, created_at, updated_at
        "#,
    )
    .bind(pinned)
    .bind(view_id)
    .fetch_one(pool)
    .await
    .map_err(SavedViewError::Database)
}

/// Get a saved view by ID
pub async fn get_saved_view(pool: &PgPool, view_id: Uuid) -> Result<SavedView, SavedViewError> {
    sqlx::query_as::<_, SavedView>(
        r#"
        SELECT id, user_id, workspace_id, project_id, name, view_type,
               config, pinned, shared, created_at, updated_at
        FROM saved_views
        WHERE id = $1
        "#,
    )
    .bind(view_id)
    .fetch_optional(pool)
    .await
    .map_err(SavedViewError::Database)?
    .ok_or(SavedViewError::NotFound)
}

/// Error type for saved view operations
#[derive(Debug, thiserror::Error)]
pub enum SavedViewError {
    #[error("Saved view not found")]
    NotFound,
    #[error("Not the owner of this saved view")]
    NotOwner,
    #[error("Duplicate view name")]
    DuplicateName,
    #[error("Limit reached: {0}")]
    LimitReached(String),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}
