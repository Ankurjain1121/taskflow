//! Profile-related authentication endpoints
//!
//! Provides user profile retrieval and update.

use axum::{extract::State, Json};
use serde::Deserialize;

use taskbolt_db::queries::auth;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::store_csrf_token;
use crate::state::AppState;

use super::validation::{validate_optional_string, MAX_BIO_LEN, MAX_NAME_LEN};

use super::auth::{AuthResponse, UserResponse, SESSION_TTL_SECS};

// ============================================================================
// Request DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub bio: Option<String>,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/auth/me
///
/// Get the current authenticated user's profile.
/// Also generates a fresh CSRF token so the frontend can make mutations
/// after a page refresh (where the in-memory CSRF token is lost).
pub async fn me_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<AuthResponse>> {
    let user = auth::get_user_by_id(&state.db, auth.0.user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let csrf_token = store_csrf_token(&state, user.id, SESSION_TTL_SECS)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create CSRF token: {}", e)))?;

    Ok(Json(AuthResponse {
        csrf_token,
        user: UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            avatar_url: user.avatar_url,
            phone_number: user.phone_number,
            phone_verified: user.phone_verified,
            job_title: user.job_title,
            department: user.department,
            bio: user.bio,
            onboarding_completed: user.onboarding_completed,
            last_login_at: user.last_login_at,
        },
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
        if name.is_empty() || name.len() > MAX_NAME_LEN {
            return Err(AppError::BadRequest(format!(
                "Name must be 1-{MAX_NAME_LEN} characters"
            )));
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

    // Validate job_title if provided
    validate_optional_string("Job title", payload.job_title.as_deref(), MAX_NAME_LEN)?;

    // Validate department if provided
    validate_optional_string("Department", payload.department.as_deref(), MAX_NAME_LEN)?;

    // Validate bio if provided
    validate_optional_string("Bio", payload.bio.as_deref(), MAX_BIO_LEN)?;

    // Validate avatar_url if provided (must be from MinIO or null)
    if let Some(ref url) = payload.avatar_url {
        if !url.is_empty() && !url.starts_with(&state.config.minio_public_url) {
            return Err(AppError::BadRequest(
                "Avatar URL must be from the configured storage service".into(),
            ));
        }
    }

    // Check OTP verification for phone number change
    let phone_verified = if let Some(ref phone) = payload.phone_number {
        if !phone.is_empty() {
            let otp_key = format!("otp_verified:{}", phone);
            let verified: Option<String> = redis::cmd("GET")
                .arg(&otp_key)
                .query_async(&mut state.redis.clone())
                .await
                .unwrap_or(None);
            if verified.is_some() {
                let _: () = redis::cmd("DEL")
                    .arg(&otp_key)
                    .query_async(&mut state.redis.clone())
                    .await
                    .unwrap_or(());
                Some(true)
            } else {
                Some(false)
            }
        } else {
            // Clearing phone number — reset verified
            Some(false)
        }
    } else {
        None // phone not being updated
    };

    // Build dynamic UPDATE
    sqlx::query(
        r#"
        UPDATE users SET
            name = COALESCE($1, name),
            phone_number = COALESCE($2, phone_number),
            avatar_url = COALESCE($3, avatar_url),
            job_title = COALESCE($4, job_title),
            department = COALESCE($5, department),
            bio = COALESCE($6, bio),
            phone_verified = COALESCE($7, phone_verified),
            updated_at = NOW()
        WHERE id = $8
        "#,
    )
    .bind(payload.name.as_deref().map(|s| s.trim()))
    .bind(&payload.phone_number)
    .bind(&payload.avatar_url)
    .bind(&payload.job_title)
    .bind(&payload.department)
    .bind(&payload.bio)
    .bind(phone_verified)
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
        phone_verified: user.phone_verified,
        job_title: user.job_title,
        department: user.department,
        bio: user.bio,
        onboarding_completed: user.onboarding_completed,
        last_login_at: user.last_login_at,
    }))
}
