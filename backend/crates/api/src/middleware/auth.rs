//! Authentication middleware for Axum
//!
//! Extracts and validates JWT tokens from the Authorization header,
//! then inserts the authenticated user into request extensions.

use axum::{
    body::Body,
    extract::State,
    http::{header::{AUTHORIZATION, COOKIE}, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use taskflow_auth::jwt::verify_access_token;
use taskflow_db::models::UserRole;

use crate::state::AppState;

/// Authenticated user extracted from JWT token
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub role: UserRole,
}

/// Error response for authentication failures
#[derive(Serialize)]
struct AuthErrorResponse {
    error: String,
}

impl AuthErrorResponse {
    fn unauthorized() -> Self {
        Self {
            error: "Unauthorized".to_string(),
        }
    }
}

/// Middleware that validates JWT tokens and extracts user info
///
/// Tries to read the access token from:
/// 1. Cookie header (`access_token` cookie) - preferred for browser clients
/// 2. Authorization header (`Bearer <token>`) - fallback for API clients
///
/// Returns 401 Unauthorized if no valid token is found.
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    // Try Cookie header first, then Authorization header
    let token = extract_token_from_cookie(request.headers())
        .or_else(|| extract_token_from_auth_header(request.headers()));

    let token = match token {
        Some(t) => t,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(AuthErrorResponse::unauthorized()),
            )
                .into_response();
        }
    };

    // Verify JWT token
    let claims = match verify_access_token(&token, &state.jwt_keys) {
        Ok(c) => c,
        Err(e) => {
            tracing::debug!("JWT verification failed: {:?}", e);
            return (
                StatusCode::UNAUTHORIZED,
                Json(AuthErrorResponse::unauthorized()),
            )
                .into_response();
        }
    };

    // Insert AuthUser into request extensions
    let auth_user = AuthUser {
        user_id: claims.sub,
        tenant_id: claims.tenant_id,
        role: claims.role,
    };
    request.extensions_mut().insert(auth_user);

    // Continue to the next handler
    next.run(request).await
}

/// Optional auth middleware that doesn't fail if no token is present
///
/// If a valid token is present, inserts AuthUser into extensions.
/// If no token or invalid token, continues without inserting AuthUser.
pub async fn optional_auth_middleware(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    // Try Cookie header first, then Authorization header
    let token = extract_token_from_cookie(request.headers())
        .or_else(|| extract_token_from_auth_header(request.headers()));

    if let Some(token) = token {
        if let Ok(claims) = verify_access_token(&token, &state.jwt_keys) {
            let auth_user = AuthUser {
                user_id: claims.sub,
                tenant_id: claims.tenant_id,
                role: claims.role,
            };
            request.extensions_mut().insert(auth_user);
        }
    }

    // Always continue to next handler
    next.run(request).await
}

/// Extract the `access_token` cookie value from the Cookie header.
fn extract_token_from_cookie(headers: &axum::http::HeaderMap) -> Option<String> {
    let cookie_header = headers.get(COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("access_token") {
            let value = value.trim_start();
            if let Some(value) = value.strip_prefix('=') {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Extract the Bearer token from the Authorization header.
fn extract_token_from_auth_header(headers: &axum::http::HeaderMap) -> Option<String> {
    let auth_header = headers.get(AUTHORIZATION)?.to_str().ok()?;
    auth_header.strip_prefix("Bearer ").map(|t| t.to_string())
}
