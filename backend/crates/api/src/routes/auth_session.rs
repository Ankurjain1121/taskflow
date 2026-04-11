//! Shared auth session builder
//!
//! Consolidates the duplicated JWT issuance, Redis session creation,
//! CSRF token generation, cookie header building, and AuthResponse
//! construction used by sign-in, sign-up, refresh, and 2FA challenge.

use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use uuid::Uuid;

use taskbolt_auth::jwt::issue_tokens;
use taskbolt_db::models::UserRole;
use taskbolt_db::queries::auth;

use crate::errors::{AppError, Result};
use crate::middleware::store_csrf_token;
use crate::state::AppState;

use super::auth::{
    AuthResponse, SESSION_TTL_SECS, UserResponse, build_auth_cookie_headers, hash_token,
};

/// Parameters needed to build an auth session.
pub struct SessionParams<'a> {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub role: UserRole,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub phone_number: Option<String>,
    pub phone_verified: bool,
    pub job_title: Option<String>,
    pub department: Option<String>,
    pub bio: Option<String>,
    pub onboarding_completed: bool,
    pub last_login_at: Option<chrono::DateTime<chrono::Utc>>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub persistent: bool,
    pub state: &'a AppState,
}

/// Result of building an auth session: response body + cookie headers.
pub struct SessionResult {
    pub auth_response: AuthResponse,
    pub cookie_headers: HeaderMap,
}

/// Build a full auth session: issue JWT, store refresh token in DB,
/// create Redis session, generate CSRF token, and build cookie headers.
pub async fn build_auth_session(params: SessionParams<'_>) -> Result<SessionResult> {
    let state = params.state;

    // Generate token ID, issue JWT, hash, then INSERT — no "pending" race
    let refresh_expiry = Utc::now() + Duration::seconds(state.config.jwt_refresh_expiry_secs);
    let token_id = Uuid::new_v4();

    let tokens = issue_tokens(
        params.user_id,
        params.tenant_id,
        params.role,
        token_id,
        &state.jwt_keys,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
    )?;

    let token_hash = hash_token(&tokens.refresh_token);
    auth::create_refresh_token(
        &state.db,
        token_id,
        params.user_id,
        &token_hash,
        refresh_expiry,
        params.ip_address.as_deref(),
        params.user_agent.as_deref(),
        params.persistent,
    )
    .await?;

    // Create session in Redis (30 minutes idle timeout)
    let session_key = format!("session:{}:{}", params.user_id, token_id);
    redis::cmd("SET")
        .arg(&session_key)
        .arg("1")
        .arg("EX")
        .arg(SESSION_TTL_SECS)
        .query_async::<()>(&mut state.redis.clone())
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create session: {}", e)))?;

    // Generate and store CSRF token
    let csrf_token = store_csrf_token(state, params.user_id, SESSION_TTL_SECS)
        .await
        .map_err(|e| AppError::InternalError(format!("Failed to create CSRF token: {}", e)))?;

    // Set HttpOnly cookies
    let cookie_headers = build_auth_cookie_headers(
        &tokens.access_token,
        &tokens.refresh_token,
        state.config.jwt_access_expiry_secs,
        state.config.jwt_refresh_expiry_secs,
        &state.config.app_url,
        params.persistent,
    )?;

    let auth_response = AuthResponse {
        csrf_token,
        user: UserResponse {
            id: params.user_id,
            name: params.name,
            email: params.email,
            role: params.role,
            tenant_id: params.tenant_id,
            avatar_url: params.avatar_url,
            phone_number: params.phone_number,
            phone_verified: params.phone_verified,
            job_title: params.job_title,
            department: params.department,
            bio: params.bio,
            onboarding_completed: params.onboarding_completed,
            last_login_at: params.last_login_at,
        },
    };

    Ok(SessionResult {
        auth_response,
        cookie_headers,
    })
}

/// Extract session metadata (IP address and user agent) from request headers.
pub fn extract_session_metadata(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(',').next().unwrap_or(v).trim().to_string());
    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(std::string::ToString::to_string);
    (ip_address, user_agent)
}
