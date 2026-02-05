//! Authentication REST endpoints
//!
//! Provides sign-in, token refresh, sign-out, and user profile endpoints.

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use taskflow_auth::jwt::{issue_tokens, verify_refresh_token};
use taskflow_auth::password::verify_password;
use taskflow_db::models::UserRole;
use taskflow_db::queries::auth;

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::state::AppState;

// ============================================================================
// Request/Response DTOs
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SignInRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: UserRole,
    pub tenant_id: Uuid,
    pub avatar_url: Option<String>,
    pub onboarding_completed: bool,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/auth/sign-in
///
/// Authenticate user with email and password.
/// Returns access token, refresh token, and user profile.
pub async fn sign_in_handler(
    State(state): State<AppState>,
    Json(payload): Json<SignInRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate input
    if payload.email.is_empty() || payload.password.is_empty() {
        return Err(AppError::BadRequest("Email and password are required".into()));
    }

    // Fetch user by email
    let user = auth::get_user_by_email(&state.db, &payload.email)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid email or password".into()))?;

    // Verify password
    let password_valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|_| AppError::InternalError("Password verification failed".into()))?;

    if !password_valid {
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    }

    // Calculate refresh token expiry
    let refresh_expiry = Utc::now()
        + Duration::seconds(state.config.jwt_refresh_expiry_secs);

    // Create refresh token record in DB first (to get the token_id)
    // We use a placeholder hash initially, then update after generating the JWT
    let token_id = auth::create_refresh_token(
        &state.db,
        user.id,
        "pending", // Will be updated
        refresh_expiry,
    )
    .await?;

    // Issue JWT token pair
    let tokens = issue_tokens(
        user.id,
        user.tenant_id,
        user.role.clone(),
        token_id,
        &state.config.jwt_secret,
        &state.config.jwt_refresh_secret,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
    )?;

    // Hash the refresh token and store it
    let token_hash = hash_token(&tokens.refresh_token);
    sqlx::query("UPDATE refresh_tokens SET token_hash = $1 WHERE id = $2")
        .bind(&token_hash)
        .bind(token_id)
        .execute(&state.db)
        .await?;

    Ok(Json(AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            avatar_url: user.avatar_url,
            onboarding_completed: user.onboarding_completed,
        },
    }))
}

/// POST /api/auth/refresh
///
/// Refresh access token using a valid refresh token.
/// Returns new access and refresh tokens, revokes the old refresh token.
pub async fn refresh_handler(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>> {
    // Verify the refresh token JWT
    let claims = verify_refresh_token(&payload.refresh_token, &state.config.jwt_refresh_secret)
        .map_err(|_| AppError::Unauthorized("Invalid refresh token".into()))?;

    // Get the refresh token record from DB
    let stored_token = auth::get_refresh_token(&state.db, claims.token_id)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Refresh token not found".into()))?;

    // Check if token has been revoked
    if stored_token.revoked_at.is_some() {
        return Err(AppError::Unauthorized("Refresh token has been revoked".into()));
    }

    // Verify token hash matches
    let provided_hash = hash_token(&payload.refresh_token);
    if stored_token.token_hash != provided_hash {
        return Err(AppError::Unauthorized("Invalid refresh token".into()));
    }

    // Get user info
    let user = auth::get_user_by_id(&state.db, claims.sub)
        .await?
        .ok_or_else(|| AppError::Unauthorized("User not found".into()))?;

    // Revoke the old refresh token
    auth::revoke_refresh_token(&state.db, claims.token_id).await?;

    // Create new refresh token record
    let refresh_expiry = Utc::now()
        + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let new_token_id = auth::create_refresh_token(
        &state.db,
        user.id,
        "pending",
        refresh_expiry,
    )
    .await?;

    // Issue new token pair
    let tokens = issue_tokens(
        user.id,
        user.tenant_id,
        user.role.clone(),
        new_token_id,
        &state.config.jwt_secret,
        &state.config.jwt_refresh_secret,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
    )?;

    // Update the token hash
    let token_hash = hash_token(&tokens.refresh_token);
    sqlx::query("UPDATE refresh_tokens SET token_hash = $1 WHERE id = $2")
        .bind(&token_hash)
        .bind(new_token_id)
        .execute(&state.db)
        .await?;

    Ok(Json(AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            avatar_url: user.avatar_url,
            onboarding_completed: user.onboarding_completed,
        },
    }))
}

/// POST /api/auth/sign-out
///
/// Sign out by revoking the current refresh token.
/// Requires authentication.
pub async fn sign_out_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<RefreshRequest>,
) -> Result<Json<MessageResponse>> {
    // Verify the refresh token belongs to this user
    let claims = verify_refresh_token(&payload.refresh_token, &state.config.jwt_refresh_secret)
        .map_err(|_| AppError::Unauthorized("Invalid refresh token".into()))?;

    if claims.sub != auth.0.user_id {
        return Err(AppError::Forbidden("Token does not belong to authenticated user".into()));
    }

    // Revoke the refresh token
    auth::revoke_refresh_token(&state.db, claims.token_id).await?;

    Ok(Json(MessageResponse {
        message: "Successfully signed out".into(),
    }))
}

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
        onboarding_completed: user.onboarding_completed,
    }))
}

// ============================================================================
// Helpers
// ============================================================================

/// Hash a token using SHA-256
fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ============================================================================
// Router
// ============================================================================

/// Build the auth router
///
/// Public routes:
/// - POST /sign-in
/// - POST /refresh
///
/// Protected routes (require auth middleware):
/// - POST /sign-out
/// - GET /me
pub fn auth_router() -> Router<AppState> {
    Router::new()
        .route("/sign-in", post(sign_in_handler))
        .route("/refresh", post(refresh_handler))
        .route("/sign-out", post(sign_out_handler))
        .route("/me", get(me_handler))
}
