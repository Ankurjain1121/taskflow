//! Authentication REST endpoints
//!
//! Provides sign-in, token refresh, sign-out, and user profile endpoints.

use axum::{
    extract::State,
    http::{header::SET_COOKIE, HeaderMap, HeaderValue},
    response::{IntoResponse, Response},
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

use taskflow_services::notifications::PostalClient;

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
pub struct SignUpRequest {
    pub name: String,
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

#[derive(Debug, Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub new_password: String,
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
) -> Result<Response> {
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
        user.role,
        token_id,
        &state.jwt_keys,
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

    // Set HttpOnly cookies
    let cookie_headers = build_auth_cookie_headers(
        &tokens.access_token,
        &tokens.refresh_token,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
        &state.config.app_url,
    );

    let response_body = AuthResponse {
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
    };

    let mut response = Json(response_body).into_response();
    response.headers_mut().extend(cookie_headers);
    Ok(response)
}

/// POST /api/auth/sign-up
///
/// Register a new user with a new tenant.
/// Returns access token, refresh token, and user profile.
pub async fn sign_up_handler(
    State(state): State<AppState>,
    Json(payload): Json<SignUpRequest>,
) -> Result<Response> {
    // Validate
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name is required".into()));
    }
    if payload.email.trim().is_empty() || !payload.email.contains('@') {
        return Err(AppError::BadRequest("Valid email is required".into()));
    }
    if payload.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    // Check if email already exists
    if auth::get_user_by_email(&state.db, &payload.email)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict(
            "An account with this email already exists".into(),
        ));
    }

    // Hash password
    let password_hash = taskflow_auth::password::hash_password(&payload.password)
        .map_err(|_| AppError::InternalError("Failed to hash password".into()))?;

    // Create user with tenant
    let user =
        auth::create_user_with_tenant(&state.db, &payload.email, &payload.name, &password_hash)
            .await?;

    // Issue tokens (same as sign-in)
    let refresh_expiry = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let token_id =
        auth::create_refresh_token(&state.db, user.id, "pending", refresh_expiry).await?;

    let tokens = issue_tokens(
        user.id,
        user.tenant_id,
        user.role,
        token_id,
        &state.jwt_keys,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
    )?;

    let token_hash = hash_token(&tokens.refresh_token);
    sqlx::query("UPDATE refresh_tokens SET token_hash = $1 WHERE id = $2")
        .bind(&token_hash)
        .bind(token_id)
        .execute(&state.db)
        .await?;

    // Set HttpOnly cookies
    let cookie_headers = build_auth_cookie_headers(
        &tokens.access_token,
        &tokens.refresh_token,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
        &state.config.app_url,
    );

    let response_body = AuthResponse {
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
    };

    let mut response = Json(response_body).into_response();
    response.headers_mut().extend(cookie_headers);
    Ok(response)
}

/// POST /api/auth/refresh
///
/// Refresh access token using a valid refresh token.
/// Returns new access and refresh tokens, revokes the old refresh token.
pub async fn refresh_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Option<Json<serde_json::Value>>,
) -> Result<Response> {
    // Try to get refresh token from cookie first, then fall back to JSON body
    let refresh_token_value = extract_cookie(&headers, "refresh_token")
        .or_else(|| {
            payload.as_ref().and_then(|j| {
                j.get("refresh_token")
                    .and_then(|v| v.as_str())
                    .map(String::from)
            })
        })
        .ok_or_else(|| AppError::BadRequest("No refresh token provided".into()))?;

    // Verify the refresh token JWT
    let claims = verify_refresh_token(&refresh_token_value, &state.jwt_keys)
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
    let provided_hash = hash_token(&refresh_token_value);
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
        user.role,
        new_token_id,
        &state.jwt_keys,
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

    // Set HttpOnly cookies
    let cookie_headers = build_auth_cookie_headers(
        &tokens.access_token,
        &tokens.refresh_token,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
        &state.config.app_url,
    );

    let response_body = AuthResponse {
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
    };

    let mut response = Json(response_body).into_response();
    response.headers_mut().extend(cookie_headers);
    Ok(response)
}

/// POST /api/auth/sign-out
///
/// Sign out by revoking the current refresh token.
/// Requires authentication.
pub async fn sign_out_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    headers: HeaderMap,
    payload: Option<Json<RefreshRequest>>,
) -> Result<(HeaderMap, Json<MessageResponse>)> {
    // Try to get refresh token from cookie first, then fall back to JSON body
    let refresh_token_value = extract_cookie(&headers, "refresh_token")
        .or_else(|| payload.as_ref().map(|p| p.refresh_token.clone()));

    if let Some(token) = refresh_token_value {
        // Verify the refresh token belongs to this user
        if let Ok(claims) = verify_refresh_token(&token, &state.jwt_keys) {
            if claims.sub == auth.0.user_id {
                let _ = auth::revoke_refresh_token(&state.db, claims.token_id).await;
            }
        }
    }

    // Clear cookies regardless
    let clear_headers = build_clear_cookie_headers(&state.config.app_url);

    Ok((clear_headers, Json(MessageResponse {
        message: "Successfully signed out".into(),
    })))
}

/// POST /api/auth/logout
///
/// Logout by clearing HttpOnly cookies. Does not require authentication
/// (the cookie itself is the credential). Revokes the refresh token if valid.
pub async fn logout_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<MessageResponse>)> {
    // Try to revoke the refresh token from cookie if present
    if let Some(token) = extract_cookie(&headers, "refresh_token") {
        if let Ok(claims) = verify_refresh_token(&token, &state.jwt_keys) {
            let _ = auth::revoke_refresh_token(&state.db, claims.token_id).await;
        }
    }

    // Clear cookies
    let clear_headers = build_clear_cookie_headers(&state.config.app_url);

    Ok((clear_headers, Json(MessageResponse {
        message: "Successfully logged out".into(),
    })))
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

/// POST /api/auth/forgot-password
///
/// Request a password reset link. Always returns success to prevent email enumeration.
pub async fn forgot_password_handler(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<Json<MessageResponse>> {
    // Always return success to prevent email enumeration
    let user = auth::get_user_by_email(&state.db, &payload.email).await?;

    if let Some(user) = user {
        // Generate a random token
        let raw_token = Uuid::new_v4().to_string();
        let token_hash = hash_token(&raw_token);
        let expires_at = Utc::now() + Duration::hours(1);

        auth::create_password_reset_token(&state.db, user.id, &token_hash, expires_at).await?;

        // Send email (best effort - don't fail if email sending fails)
        let reset_url = format!(
            "{}/auth/reset-password?token={}",
            state.config.app_url, raw_token
        );
        tracing::info!(
            email = %payload.email,
            "Password reset requested"
        );

        let subject = "Reset your TaskFlow password";
        let html_body = format!(
            r#"<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
        <h1 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">Password Reset</h1>
        <p style="color: #4b5563; font-size: 16px; margin: 0 0 20px 0;">
            You requested a password reset. Click the button below to set a new password.
            This link expires in 1 hour.
        </p>
        <p><a href="{}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">If you did not request this, you can safely ignore this email.</p>
    </div>
</body>
</html>"#,
            reset_url
        );

        let postal = PostalClient::new(
            state.config.postal_api_url.clone(),
            state.config.postal_api_key.clone(),
            state.config.postal_from_address.clone(),
            state.config.postal_from_name.clone(),
        );

        if let Err(e) = postal.send_email(&payload.email, subject, &html_body).await {
            tracing::error!(error = %e, email = %payload.email, "Failed to send password reset email");
        }
    }

    Ok(Json(MessageResponse {
        message: "If an account with that email exists, a password reset link has been sent."
            .into(),
    }))
}

/// POST /api/auth/reset-password
///
/// Reset password using a valid reset token.
pub async fn reset_password_handler(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<Json<MessageResponse>> {
    if payload.new_password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }

    let token_hash = hash_token(&payload.token);

    let (token_id, user_id) = auth::get_valid_reset_token(&state.db, &token_hash)
        .await?
        .ok_or_else(|| AppError::BadRequest("Invalid or expired reset token".into()))?;

    // Hash new password
    let password_hash = taskflow_auth::password::hash_password(&payload.new_password)
        .map_err(|_| AppError::InternalError("Failed to hash password".into()))?;

    // Update password
    auth::update_user_password(&state.db, user_id, &password_hash).await?;

    // Mark token as used
    auth::mark_reset_token_used(&state.db, token_id).await?;

    // Revoke all refresh tokens
    auth::revoke_all_user_tokens(&state.db, user_id).await?;

    Ok(Json(MessageResponse {
        message: "Password has been reset successfully. Please sign in with your new password."
            .into(),
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

/// Extract a named cookie value from the Cookie header.
fn extract_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let cookie_header = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix(name) {
            let value = value.trim_start();
            if let Some(value) = value.strip_prefix('=') {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Extract domain from APP_URL for cookie Domain attribute.
/// Returns empty string for localhost/local IPs (browser default behavior).
fn extract_domain_from_url(app_url: &str) -> String {
    // Extract domain using simple string parsing
    let url_without_protocol = app_url
        .trim_start_matches("http://")
        .trim_start_matches("https://");

    let domain = url_without_protocol
        .split('/')
        .next()
        .unwrap_or("");

    let domain = domain.split(':').next().unwrap_or("");

    // Skip localhost and local IPs
    if domain == "localhost"
        || domain.starts_with("127.")
        || domain.starts_with("192.168.")
        || domain.starts_with("10.") {
        return String::new();
    }

    // Return domain attribute
    if !domain.is_empty() {
        format!("; Domain={}", domain)
    } else {
        String::new()
    }
}

/// Build Set-Cookie headers for access and refresh tokens.
/// Sets HttpOnly, SameSite=Strict. Secure flag is based on whether APP_URL uses https.
/// Domain attribute is set for production domains (not localhost/local IPs).
fn build_auth_cookie_headers(
    access_token: &str,
    refresh_token: &str,
    access_expiry_secs: i64,
    refresh_expiry_secs: i64,
    app_url: &str,
) -> HeaderMap {
    let secure_flag = if app_url.starts_with("https://") {
        "; Secure"
    } else {
        ""
    };

    // Extract domain from APP_URL
    let domain_attr = extract_domain_from_url(app_url);

    let access_cookie = format!(
        "access_token={}; HttpOnly; SameSite=Strict; Path=/api{}; Max-Age={}{}",
        access_token, domain_attr, access_expiry_secs, secure_flag
    );
    let refresh_cookie = format!(
        "refresh_token={}; HttpOnly; SameSite=Strict; Path=/api/auth{}; Max-Age={}{}",
        refresh_token, domain_attr, refresh_expiry_secs, secure_flag
    );

    let mut headers = HeaderMap::new();
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&access_cookie).expect("valid cookie value"),
    );
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&refresh_cookie).expect("valid cookie value"),
    );
    headers
}

/// Build Set-Cookie headers that clear both auth cookies.
fn build_clear_cookie_headers(app_url: &str) -> HeaderMap {
    let secure_flag = if app_url.starts_with("https://") {
        "; Secure"
    } else {
        ""
    };

    // Extract domain from APP_URL
    let domain_attr = extract_domain_from_url(app_url);

    let clear_access = format!(
        "access_token=; HttpOnly; SameSite=Strict; Path=/api{}; Max-Age=0{}",
        domain_attr, secure_flag
    );
    let clear_refresh = format!(
        "refresh_token=; HttpOnly; SameSite=Strict; Path=/api/auth{}; Max-Age=0{}",
        domain_attr, secure_flag
    );

    let mut headers = HeaderMap::new();
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&clear_access).expect("valid cookie value"),
    );
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&clear_refresh).expect("valid cookie value"),
    );
    headers
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
        .route("/logout", post(logout_handler))
        .route("/me", get(me_handler))
}
