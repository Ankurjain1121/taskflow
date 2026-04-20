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
use chrono::Utc;
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use taskbolt_auth::jwt::verify_refresh_token;
use taskbolt_auth::password::verify_password;
use taskbolt_db::models::UserRole;
use taskbolt_db::queries::auth;

use crate::errors::{AppError, Result};
use crate::extractors::{AuthUserExtractor, StrictJson};
use crate::state::AppState;

use super::auth_password;
use super::auth_profile;
use super::auth_session::{build_auth_session, extract_session_metadata, SessionParams};
use super::common::MessageResponse;

pub(crate) const SESSION_TTL_SECS: usize = 30 * 60;

/// Maximum failed login attempts before lockout
const MAX_LOGIN_ATTEMPTS: i64 = 5;
/// Lockout duration in seconds (15 minutes)
const LOGIN_LOCKOUT_SECS: i64 = 900;

// ============================================================================
// Request/Response DTOs (shared across auth modules)
// ============================================================================

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct SignInRequest {
    /// Accepts email or E.164 phone number (e.g. "+918750269626")
    pub identifier: String,
    pub password: String,
    /// When false, cookies are session-only (no Max-Age). Defaults to true.
    pub remember_me: Option<bool>,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct SignUpRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    pub phone_number: Option<String>,
}

#[strict_dto_derive::strict_dto]
#[derive(Debug)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub csrf_token: String,
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
    pub phone_number: Option<String>,
    pub phone_verified: bool,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub bio: Option<String>,
    pub onboarding_completed: bool,
    pub last_login_at: Option<chrono::DateTime<chrono::Utc>>,
}

// ============================================================================
// Helpers
// ============================================================================

/// Validate password complexity: >= 8 chars, at least one uppercase, one lowercase, one digit.
pub fn is_password_strong(password: &str) -> bool {
    password.len() >= 8
        && password.chars().any(char::is_uppercase)
        && password.chars().any(char::is_lowercase)
        && password.chars().any(|c| c.is_ascii_digit())
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
    headers: HeaderMap,
    StrictJson(payload): StrictJson<SignInRequest>,
) -> Result<Response> {
    // Validate input
    let identifier = payload.identifier.trim();
    if identifier.is_empty() || payload.password.is_empty() {
        return Err(AppError::BadRequest(
            "Email/phone and password are required".into(),
        ));
    }

    // Check brute-force lockout (fail-open: if Redis is down, allow the attempt)
    let lockout_key = format!("login_attempts:{}", identifier.to_lowercase());
    let attempts: i64 = redis::cmd("GET")
        .arg(&lockout_key)
        .query_async(&mut state.redis.clone())
        .await
        .unwrap_or(0);

    if attempts >= MAX_LOGIN_ATTEMPTS {
        return Err(AppError::TooManyRequests(
            "Too many failed login attempts. Please try again in 15 minutes.".into(),
        ));
    }

    // Fetch user by email or phone number
    let is_phone = identifier.starts_with('+');
    let user = if is_phone {
        auth::get_user_by_phone(&state.db, identifier).await?
    } else {
        auth::get_user_by_email(&state.db, identifier).await?
    }
    .ok_or_else(|| AppError::Unauthorized("Invalid credentials".into()))?;

    // Verify password
    let password_valid = verify_password(&payload.password, &user.password_hash)
        .map_err(|_| AppError::InternalError("Password verification failed".into()))?;

    if !password_valid {
        // Atomic INCR + EXPIRE via Lua script (prevents race where EXPIRE never fires)
        let script = redis::Script::new(
            r#"
            local count = redis.call('INCR', KEYS[1])
            redis.call('EXPIRE', KEYS[1], ARGV[1])
            return count
            "#,
        );
        let attempt_count: i64 = script
            .key(&lockout_key)
            .arg(LOGIN_LOCKOUT_SECS)
            .invoke_async(&mut state.redis.clone())
            .await
            .unwrap_or(0);
        tracing::warn!(
            identifier = %identifier,
            attempt = attempt_count,
            "Failed login attempt"
        );
        return Err(AppError::Unauthorized("Invalid credentials".into()));
    }

    // Clear failed login attempts on successful login
    if let Err(e) = redis::cmd("DEL")
        .arg(&lockout_key)
        .query_async::<()>(&mut state.redis.clone())
        .await
    {
        tracing::error!(identifier = %identifier, error = %e, "Failed to clear login counter");
    }

    // Check if user has 2FA enabled
    let has_2fa: bool = sqlx::query_scalar(
        "SELECT COALESCE((SELECT totp_enabled FROM user_2fa WHERE user_id = $1), false)",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    let persistent = payload.remember_me.unwrap_or(true);

    if has_2fa {
        // Issue a short-lived temp token instead of the real JWT
        let temp_token = Uuid::new_v4().to_string();
        let temp_key = format!("2fa_temp:{}", temp_token);
        // Store user_id and remember_me preference as JSON
        let temp_value = serde_json::json!({
            "user_id": user.id.to_string(),
            "persistent": persistent,
        });
        redis::cmd("SET")
            .arg(&temp_key)
            .arg(temp_value.to_string())
            .arg("EX")
            .arg(300i64) // 5 minutes
            .query_async::<()>(&mut state.redis.clone())
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to store temp token: {e}")))?;

        let body = serde_json::json!({
            "requires_2fa": true,
            "temp_token": temp_token,
        });
        return Ok(Json(body).into_response());
    }

    // Update last_login_at
    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    let (ip_address, user_agent) = extract_session_metadata(&headers);

    let session = build_auth_session(SessionParams {
        user_id: user.id,
        tenant_id: user.tenant_id,
        role: user.role,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        phone_number: user.phone_number,
        phone_verified: user.phone_verified,
        job_title: user.job_title,
        department: user.department,
        bio: user.bio,
        onboarding_completed: user.onboarding_completed,
        last_login_at: Some(Utc::now()),
        ip_address,
        user_agent,
        persistent,
        state: &state,
    })
    .await?;

    let mut response = Json(session.auth_response).into_response();
    response.headers_mut().extend(session.cookie_headers);
    Ok(response)
}

/// POST /api/auth/sign-up
///
/// Register a new user with a new tenant.
/// Returns access token, refresh token, and user profile.
pub async fn sign_up_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    StrictJson(payload): StrictJson<SignUpRequest>,
) -> Result<Response> {
    // Validate
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("Name is required".into()));
    }
    let email = payload.email.trim();
    if email.is_empty()
        || !email.contains('@')
        || email.starts_with('@')
        || email.ends_with('@')
        || email.contains("..")
        || !email.contains('.')
    {
        return Err(AppError::BadRequest("Valid email is required".into()));
    }
    if !is_password_strong(&payload.password) {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters and contain uppercase, lowercase, and a digit"
                .into(),
        ));
    }

    // Validate phone number if provided
    let phone_number = payload.phone_number.as_deref().filter(|p| !p.is_empty());
    if let Some(phone) = phone_number {
        taskbolt_services::notifications::whatsapp::validate_e164_phone_number(phone)
            .map_err(|e| AppError::BadRequest(e.to_string()))?;
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

    // Check if phone is already verified by another user
    if let Some(phone) = phone_number {
        if let Some(existing) = auth::get_user_by_phone(&state.db, phone).await? {
            if existing.phone_verified {
                return Err(AppError::Conflict(
                    "This phone number is already registered".into(),
                ));
            }
        }
    }

    // Hash password
    let password_hash = taskbolt_auth::password::hash_password(&payload.password)
        .map_err(|_| AppError::InternalError("Failed to hash password".into()))?;

    // Check if phone was OTP-verified via Redis
    let phone_verified = if let Some(phone) = phone_number {
        let otp_key = format!("otp_verified:{}", phone);
        let verified: Option<String> = redis::cmd("GET")
            .arg(&otp_key)
            .query_async(&mut state.redis.clone())
            .await
            .unwrap_or(None);
        if verified.is_some() {
            // Consume the verification flag
            let _: () = redis::cmd("DEL")
                .arg(&otp_key)
                .query_async(&mut state.redis.clone())
                .await
                .unwrap_or(());
            true
        } else {
            false
        }
    } else {
        false
    };

    // Create user with tenant
    let user = auth::create_user_with_tenant(
        &state.db,
        &payload.email,
        &payload.name,
        &password_hash,
        phone_number,
        phone_verified,
    )
    .await?;

    let (ip_address, user_agent) = extract_session_metadata(&headers);

    let session = build_auth_session(SessionParams {
        user_id: user.id,
        tenant_id: user.tenant_id,
        role: user.role,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        phone_number: user.phone_number,
        phone_verified: user.phone_verified,
        job_title: user.job_title,
        department: user.department,
        bio: user.bio,
        onboarding_completed: user.onboarding_completed,
        last_login_at: user.last_login_at,
        ip_address,
        user_agent,
        persistent: true, // sign-up always uses persistent cookies
        state: &state,
    })
    .await?;

    let mut response = Json(session.auth_response).into_response();
    response.headers_mut().extend(session.cookie_headers);
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
        return Err(AppError::Unauthorized(
            "Refresh token has been revoked".into(),
        ));
    }

    // Check if token has expired (defense-in-depth alongside JWT exp)
    if stored_token.expires_at < Utc::now() {
        return Err(AppError::Unauthorized("Refresh token has expired".into()));
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

    // Preserve remember-me preference from the original sign-in
    let persistent = stored_token.persistent;

    let (ip_address, user_agent) = extract_session_metadata(&headers);

    let session = build_auth_session(SessionParams {
        user_id: user.id,
        tenant_id: user.tenant_id,
        role: user.role,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        phone_number: user.phone_number,
        phone_verified: user.phone_verified,
        job_title: user.job_title,
        department: user.department,
        bio: user.bio,
        onboarding_completed: user.onboarding_completed,
        last_login_at: user.last_login_at,
        ip_address,
        user_agent,
        persistent,
        state: &state,
    })
    .await?;

    let mut response = Json(session.auth_response).into_response();
    response.headers_mut().extend(session.cookie_headers);
    Ok(response)
}

/// POST /api/auth/sign-out
///
/// Sign out by revoking the current refresh token and session.
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

    // Revoke current session from Redis (scoped to this token)
    let session_key = format!("session:{}:{}", auth.0.user_id, auth.0.token_id);
    let _: () = redis::cmd("DEL")
        .arg(&session_key)
        .query_async(&mut state.redis.clone())
        .await
        .unwrap_or(());

    // Clear cookies regardless
    let clear_headers = build_clear_cookie_headers(&state.config.app_url)?;

    Ok((
        clear_headers,
        Json(MessageResponse {
            message: "Successfully signed out".into(),
        }),
    ))
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
    let clear_headers = build_clear_cookie_headers(&state.config.app_url)?;

    Ok((
        clear_headers,
        Json(MessageResponse {
            message: "Successfully logged out".into(),
        }),
    ))
}

/// POST /api/auth/sign-out-all
///
/// Sign out all sessions for the current user by deleting all session keys
/// matching `session:{user_id}:*` and revoking all refresh tokens.
pub async fn sign_out_all_handler(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<Json<MessageResponse>> {
    let user_id = auth.0.user_id;

    // Find and delete all session keys for this user using SCAN (non-blocking)
    let pattern = format!("session:{}:*", user_id);
    let mut cursor: u64 = 0;
    let mut conn = state.redis.clone();
    loop {
        let (next_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(&pattern)
            .arg("COUNT")
            .arg(100)
            .query_async(&mut conn)
            .await
            .unwrap_or((0, Vec::new()));

        if !keys.is_empty() {
            let _: () = redis::cmd("DEL")
                .arg(&keys)
                .query_async(&mut conn)
                .await
                .unwrap_or(());
        }

        cursor = next_cursor;
        if cursor == 0 {
            break;
        }
    }

    // Revoke all refresh tokens for this user
    auth::revoke_all_user_refresh_tokens(&state.db, user_id).await?;

    Ok(Json(MessageResponse {
        message: "All sessions have been signed out".into(),
    }))
}

// ============================================================================
// Helpers
// ============================================================================

/// Hash a token using SHA-256
pub(crate) fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Extract a named cookie value from the Cookie header.
pub(crate) fn extract_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let cookie_header = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix(name) {
            let value = value.trim_start();
            if let Some(value) = value.strip_prefix('=') {
                return Some(value.trim().to_string());
            }
        }
    }
    None
}

/// Build Set-Cookie headers for access and refresh tokens.
///
/// When `persistent` is true, cookies include `Max-Age` (survive browser restart).
/// When false, `Max-Age` is omitted — the browser treats them as session cookies
/// that are deleted when the browser closes.
pub(crate) fn build_auth_cookie_headers(
    access_token: &str,
    refresh_token: &str,
    access_expiry_secs: i64,
    refresh_expiry_secs: i64,
    app_url: &str,
    persistent: bool,
) -> Result<HeaderMap> {
    let secure_flag = if app_url.starts_with("https://") {
        "; Secure"
    } else {
        ""
    };

    let access_max_age = if persistent {
        format!("; Max-Age={}", access_expiry_secs)
    } else {
        String::new()
    };
    let refresh_max_age = if persistent {
        format!("; Max-Age={}", refresh_expiry_secs)
    } else {
        String::new()
    };

    let access_cookie = format!(
        "access_token={}; HttpOnly; SameSite=Lax; Path=/{}{}",
        access_token, access_max_age, secure_flag
    );
    let refresh_cookie = format!(
        "refresh_token={}; HttpOnly; SameSite=Lax; Path=/{}{}",
        refresh_token, refresh_max_age, secure_flag
    );

    let mut headers = HeaderMap::new();
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&access_cookie)
            .map_err(|_| AppError::InternalError("Invalid access cookie header value".into()))?,
    );
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&refresh_cookie)
            .map_err(|_| AppError::InternalError("Invalid refresh cookie header value".into()))?,
    );
    Ok(headers)
}

/// Build Set-Cookie headers that clear both auth cookies.
pub(crate) fn build_clear_cookie_headers(app_url: &str) -> Result<HeaderMap> {
    let secure_flag = if app_url.starts_with("https://") {
        "; Secure"
    } else {
        ""
    };

    let clear_access = format!(
        "access_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0{}",
        secure_flag
    );
    let clear_refresh = format!(
        "refresh_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0{}",
        secure_flag
    );

    let mut headers = HeaderMap::new();
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&clear_access).map_err(|_| {
            AppError::InternalError("Invalid clear access cookie header value".into())
        })?,
    );
    headers.append(
        SET_COOKIE,
        HeaderValue::from_str(&clear_refresh).map_err(|_| {
            AppError::InternalError("Invalid clear refresh cookie header value".into())
        })?,
    );
    Ok(headers)
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
        .route("/sign-up", post(sign_up_handler))
        .route("/refresh", post(refresh_handler))
        .route("/sign-out", post(sign_out_handler))
        .route("/sign-out-all", post(sign_out_all_handler))
        .route("/logout", post(logout_handler))
        .route(
            "/me",
            get(auth_profile::me_handler)
                .patch(auth_profile::update_profile_handler)
                .delete(auth_password::delete_account_handler),
        )
        .route(
            "/change-password",
            post(auth_password::change_password_handler),
        )
        .route(
            "/forgot-password",
            post(auth_password::forgot_password_handler),
        )
        .route(
            "/reset-password",
            post(auth_password::reset_password_handler),
        )
}

#[cfg(test)]
#[path = "auth_tests.rs"]
mod tests;
