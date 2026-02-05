//! Authentication middleware for Axum
//!
//! Extracts and validates JWT tokens from the Authorization header,
//! then inserts the authenticated user into request extensions.

use axum::{
    body::Body,
    extract::State,
    http::{header::AUTHORIZATION, Request, StatusCode},
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
/// Reads the `Authorization: Bearer <token>` header, validates the JWT,
/// and inserts an `AuthUser` into request extensions.
///
/// Returns 401 Unauthorized if:
/// - No Authorization header is present
/// - The header format is invalid (not "Bearer <token>")
/// - The JWT token is invalid or expired
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    // Extract Authorization header
    let auth_header = match request.headers().get(AUTHORIZATION) {
        Some(header) => header,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(AuthErrorResponse::unauthorized()),
            )
                .into_response();
        }
    };

    // Parse header value to string
    let auth_str = match auth_header.to_str() {
        Ok(s) => s,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(AuthErrorResponse::unauthorized()),
            )
                .into_response();
        }
    };

    // Expect "Bearer <token>" format
    let token = match auth_str.strip_prefix("Bearer ") {
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
    let claims = match verify_access_token(token, &state.config.jwt_secret) {
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
    // Try to extract and validate token
    if let Some(auth_header) = request.headers().get(AUTHORIZATION) {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                if let Ok(claims) = verify_access_token(token, &state.config.jwt_secret) {
                    let auth_user = AuthUser {
                        user_id: claims.sub,
                        tenant_id: claims.tenant_id,
                        role: claims.role,
                    };
                    request.extensions_mut().insert(auth_user);
                }
            }
        }
    }

    // Always continue to next handler
    next.run(request).await
}
