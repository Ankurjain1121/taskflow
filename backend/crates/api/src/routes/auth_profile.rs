//! Profile-related authentication endpoints
//!
//! Provides user profile retrieval and update.

use axum::{extract::State, Json};
use serde::Deserialize;

use taskflow_db::queries::auth;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::state::AppState;

use super::auth::UserResponse;

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/auth/me
///
/// Get the current authenticated user's profile.
pub async fn me_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<UserResponse>> {
    let user = auth::get_user_by_id(&state.db, auth.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(UserResponse {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        avatar_url: user.avatar_url,
        phone_number: user.phone_number,
        onboarding_completed: user.onboarding_completed,
        last_login_at: user.last_login_at,
    }))
}

/// PATCH /api/auth/me
///
/// Update the current user's profile (name, phone_number, avatar_url).
pub async fn update_profile_handler(
    State(state): State<AppState>,
    auth_ext: AuthUserExtractor,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>> {
    let user_id = auth_ext.0.user_id;

    // Validate name if provided
    if let Some(ref name) = payload.name {
        let name = name.trim();
        if name.is_empty() || name.len() > 100 {
            return Err(AppError::BadRequest("Name must be 1-100 characters".into()));
        }
    }

    // Validate phone if provided (E.164 format)
    if let Some(ref phone) = payload.phone_number {
        if !phone.is_empty() {
            let phone_re = regex::Regex::new(r"^\+[1-9]\d{1,14}$")
                .map_err(|_| AppError::InternalError("Regex error".into()))?;
            if !phone_re.is_match(phone) {
                return Err(AppError::BadRequest(
                    "Phone must be in E.164 format (e.g. +1234567890)".into(),
                ));
            }
        }
    }

    // Validate avatar_url if provided (must be from MinIO or null)
    if let Some(ref url) = payload.avatar_url {
        if !url.is_empty() && !url.starts_with(&state.config.minio_public_url) {
            return Err(AppError::BadRequest(
                "Avatar URL must be from the configured storage service".into(),
            ));
        }
    }

    // Build dynamic UPDATE
    sqlx::query(
        r#"
        UPDATE users SET
            name = COALESCE($1, name),
            phone_number = COALESCE($2, phone_number),
            avatar_url = COALESCE($3, avatar_url),
            updated_at = NOW()
        WHERE id = $4
        "#,
    )
    .bind(payload.name.as_deref().map(|s| s.trim()))
    .bind(&payload.phone_number)
    .bind(&payload.avatar_url)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    // Return updated user
    let user = auth::get_user_by_id(&state.db, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(UserResponse {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        avatar_url: user.avatar_url,
        phone_number: user.phone_number,
        onboarding_completed: user.onboarding_completed,
        last_login_at: user.last_login_at,
    }))
}
