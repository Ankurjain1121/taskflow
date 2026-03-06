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

use crate::errors::{AppError, Result};
use crate::extractors::AuthUserExtractor;
use crate::middleware::store_csrf_token;
use crate::state::AppState;

use super::auth_password;
use super::auth_profile;
use super::common::MessageResponse;

// ============================================================================
// Request/Response DTOs (shared across auth modules)
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
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub bio: Option<String>,
    pub onboarding_completed: bool,
    pub last_login_at: Option<chrono::DateTime<chrono::Utc>>,
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
    Json(payload): Json<SignInRequest>,
) -> Result<Response> {
    // Validate input
    if payload.email.is_empty() || payload.password.is_empty() {
        return Err(AppError::BadRequest(
            "Email and password are required".into(),
        ));
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

    // Update last_login_at
    sqlx::query("UPDATE users SET last_login_at = NOW() WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await?;

    // Extract session metadata from headers
    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string());
    let user_agent_val = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Generate token ID first, issue JWT with it, hash, then INSERT — no "pending" race
    let refresh_expiry = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let token_id = Uuid::new_v4();

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
    auth::create_refresh_token(
        &state.db,
        token_id,
        user.id,
        &token_hash,
        refresh_expiry,
        ip_address.as_deref(),
        user_agent_val.as_deref(),
    )
    .await?;

    // Create session in Redis (30 minutes idle timeout)
    let session_key = format!("session:{}", user.id);
    const SESSION_TTL_SECS: usize = 30 * 60;
    redis::cmd("SET")
        .arg(&session_key)
        .arg("1")
        .arg("EX")
        .arg(SESSION_TTL_SECS)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create session: {}", e)))?;

    // Generate and store CSRF token
    let csrf_token = store_csrf_token(&state, user.id, SESSION_TTL_SECS)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create CSRF token: {}", e)))?;

    // Set HttpOnly cookies
    let cookie_headers = build_auth_cookie_headers(
        &tokens.access_token,
        &tokens.refresh_token,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
        &state.config.app_url,
    )?;

    let response_body = AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        csrf_token,
        user: UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            avatar_url: user.avatar_url,
            phone_number: user.phone_number,
            job_title: user.job_title,
            department: user.department,
            bio: user.bio,
            onboarding_completed: user.onboarding_completed,
            last_login_at: Some(Utc::now()),
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
    headers: HeaderMap,
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

    // Extract session metadata from headers
    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string());
    let user_agent_val = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Generate token ID first, issue JWT, hash, then INSERT — no "pending" race
    let refresh_expiry = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let token_id = Uuid::new_v4();

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
    auth::create_refresh_token(
        &state.db,
        token_id,
        user.id,
        &token_hash,
        refresh_expiry,
        ip_address.as_deref(),
        user_agent_val.as_deref(),
    )
    .await?;

    // Create session in Redis (30 minutes idle timeout)
    let session_key = format!("session:{}", user.id);
    const SESSION_TTL_SECS: usize = 30 * 60;
    redis::cmd("SET")
        .arg(&session_key)
        .arg("1")
        .arg("EX")
        .arg(SESSION_TTL_SECS)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create session: {}", e)))?;

    // Generate and store CSRF token
    let csrf_token = store_csrf_token(&state, user.id, SESSION_TTL_SECS)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create CSRF token: {}", e)))?;

    // Set HttpOnly cookies
    let cookie_headers = build_auth_cookie_headers(
        &tokens.access_token,
        &tokens.refresh_token,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
        &state.config.app_url,
    )?;

    let response_body = AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        csrf_token,
        user: UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            avatar_url: user.avatar_url,
            phone_number: user.phone_number,
            job_title: user.job_title,
            department: user.department,
            bio: user.bio,
            onboarding_completed: user.onboarding_completed,
            last_login_at: user.last_login_at,
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

    // Extract session metadata from headers
    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string());
    let user_agent_val = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Generate token ID first, issue JWT, hash, then INSERT — no "pending" race
    let refresh_expiry = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let new_token_id = Uuid::new_v4();

    let tokens = issue_tokens(
        user.id,
        user.tenant_id,
        user.role,
        new_token_id,
        &state.jwt_keys,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
    )?;

    let token_hash = hash_token(&tokens.refresh_token);
    auth::create_refresh_token(
        &state.db,
        new_token_id,
        user.id,
        &token_hash,
        refresh_expiry,
        ip_address.as_deref(),
        user_agent_val.as_deref(),
    )
    .await?;

    // Generate a new CSRF token
    const SESSION_TTL_SECS: usize = 30 * 60;
    let csrf_token = store_csrf_token(&state, user.id, SESSION_TTL_SECS)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create CSRF token: {}", e)))?;

    // Set HttpOnly cookies
    let cookie_headers = build_auth_cookie_headers(
        &tokens.access_token,
        &tokens.refresh_token,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
        &state.config.app_url,
    )?;

    let response_body = AuthResponse {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        csrf_token,
        user: UserResponse {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            avatar_url: user.avatar_url,
            phone_number: user.phone_number,
            job_title: user.job_title,
            department: user.department,
            bio: user.bio,
            onboarding_completed: user.onboarding_completed,
            last_login_at: user.last_login_at,
        },
    };

    let mut response = Json(response_body).into_response();
    response.headers_mut().extend(cookie_headers);
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

    // Revoke session from Redis
    let session_key = format!("session:{}", auth.0.user_id);
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
fn extract_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
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
/// Sets HttpOnly, SameSite=Lax. Secure flag is based on whether APP_URL uses https.
/// Domain attribute is omitted so cookies scope to the exact host that set them.
fn build_auth_cookie_headers(
    access_token: &str,
    refresh_token: &str,
    access_expiry_secs: i64,
    refresh_expiry_secs: i64,
    app_url: &str,
) -> Result<HeaderMap> {
    let secure_flag = if app_url.starts_with("https://") {
        "; Secure"
    } else {
        ""
    };

    let access_cookie = format!(
        "access_token={}; HttpOnly; SameSite=Lax; Path=/; Max-Age={}{}",
        access_token, access_expiry_secs, secure_flag
    );
    let refresh_cookie = format!(
        "refresh_token={}; HttpOnly; SameSite=Lax; Path=/; Max-Age={}{}",
        refresh_token, refresh_expiry_secs, secure_flag
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
fn build_clear_cookie_headers(app_url: &str) -> Result<HeaderMap> {
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
mod tests {
    use super::*;
    use axum::http::{header::COOKIE, HeaderMap, HeaderValue};

    #[test]
    fn test_hash_token_deterministic() {
        assert_eq!(hash_token("test"), hash_token("test"));
    }

    #[test]
    fn test_hash_token_different_inputs() {
        assert_ne!(hash_token("a"), hash_token("b"));
    }

    #[test]
    fn test_hash_token_hex_format() {
        let result = hash_token("test");
        assert_eq!(result.len(), 64);
        assert!(result.chars().all(|c| c.is_ascii_hexdigit()));
        // Verify it's lowercase hex
        assert_eq!(result, result.to_lowercase());
    }

    #[test]
    fn test_extract_cookie_single() {
        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, HeaderValue::from_static("access_token=abc123"));
        assert_eq!(
            extract_cookie(&headers, "access_token"),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn test_extract_cookie_multiple() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            HeaderValue::from_static("other=x; access_token=abc123; third=y"),
        );
        assert_eq!(
            extract_cookie(&headers, "access_token"),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn test_extract_cookie_missing() {
        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, HeaderValue::from_static("other=x"));
        assert_eq!(extract_cookie(&headers, "access_token"), None);
    }

    #[test]
    fn test_extract_cookie_no_header() {
        let headers = HeaderMap::new();
        assert_eq!(extract_cookie(&headers, "access_token"), None);
    }

    #[test]
    fn test_extract_cookie_refresh_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            HeaderValue::from_static("access_token=aaa; refresh_token=bbb"),
        );
        assert_eq!(
            extract_cookie(&headers, "refresh_token"),
            Some("bbb".to_string())
        );
    }

    #[test]
    fn test_build_auth_cookie_headers_http() {
        let headers = build_auth_cookie_headers("tok", "ref", 3600, 86400, "http://localhost:4200")
            .expect("should build cookie headers");
        let cookies: Vec<String> = headers
            .get_all(SET_COOKIE)
            .iter()
            .map(|v| v.to_str().unwrap().to_string())
            .collect();
        // Neither cookie should contain "Secure"
        for cookie in &cookies {
            assert!(
                !cookie.contains("Secure"),
                "HTTP cookie should not have Secure flag: {}",
                cookie
            );
        }
    }

    #[test]
    fn test_build_auth_cookie_headers_https() {
        let headers =
            build_auth_cookie_headers("tok", "ref", 3600, 86400, "https://taskflow.example.com")
                .expect("should build cookie headers");
        let cookies: Vec<String> = headers
            .get_all(SET_COOKIE)
            .iter()
            .map(|v| v.to_str().unwrap().to_string())
            .collect();
        // Both cookies should contain "Secure"
        for cookie in &cookies {
            assert!(
                cookie.contains("Secure"),
                "HTTPS cookie should have Secure flag: {}",
                cookie
            );
        }
    }

    #[test]
    fn test_build_clear_cookie_headers() {
        let headers = build_clear_cookie_headers("http://localhost:4200")
            .expect("should build clear headers");
        let cookies: Vec<String> = headers
            .get_all(SET_COOKIE)
            .iter()
            .map(|v| v.to_str().unwrap().to_string())
            .collect();
        assert_eq!(cookies.len(), 2);
        for cookie in &cookies {
            assert!(
                cookie.contains("Max-Age=0"),
                "Clear cookie should have Max-Age=0: {}",
                cookie
            );
        }
        // One should be access_token, one should be refresh_token
        assert!(cookies.iter().any(|c| c.starts_with("access_token=")));
        assert!(cookies.iter().any(|c| c.starts_with("refresh_token=")));
    }
}
