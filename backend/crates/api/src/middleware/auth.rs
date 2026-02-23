//! Authentication middleware for Axum
//!
//! Extracts and validates JWT tokens from the Authorization header,
//! then inserts the authenticated user into request extensions.

use axum::{
    body::Body,
    extract::State,
    http::{
        header::{AUTHORIZATION, COOKIE},
        Request, StatusCode,
    },
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
    pub token_id: Uuid,
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
        token_id: claims.token_id.unwrap_or_default(),
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
                token_id: claims.token_id.unwrap_or_default(),
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
                return Some(value.trim().to_string());
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    // --- extract_token_from_auth_header tests ---

    #[test]
    fn test_extract_bearer_token() {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            "Bearer my-jwt-token-123"
                .parse()
                .expect("valid header value"),
        );
        let token = extract_token_from_auth_header(&headers);
        assert_eq!(token, Some("my-jwt-token-123".to_string()));
    }

    #[test]
    fn test_extract_bearer_token_missing_header() {
        let headers = HeaderMap::new();
        let token = extract_token_from_auth_header(&headers);
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_bearer_token_wrong_scheme() {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            "Basic dXNlcjpwYXNz".parse().expect("valid header value"),
        );
        let token = extract_token_from_auth_header(&headers);
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_bearer_token_empty_after_prefix() {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            "Bearer ".parse().expect("valid header value"),
        );
        let token = extract_token_from_auth_header(&headers);
        assert_eq!(token, Some("".to_string()));
    }

    #[test]
    fn test_extract_bearer_case_sensitive() {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            "bearer my-token".parse().expect("valid header value"),
        );
        let token = extract_token_from_auth_header(&headers);
        // "bearer" (lowercase) should NOT match "Bearer " prefix
        assert_eq!(token, None);
    }

    // --- extract_token_from_cookie tests ---

    #[test]
    fn test_extract_cookie_single() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "access_token=jwt-abc-123"
                .parse()
                .expect("valid header value"),
        );
        let token = extract_token_from_cookie(&headers);
        assert_eq!(token, Some("jwt-abc-123".to_string()));
    }

    #[test]
    fn test_extract_cookie_multiple_cookies() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "theme=dark; access_token=jwt-xyz-789; lang=en"
                .parse()
                .expect("valid header value"),
        );
        let token = extract_token_from_cookie(&headers);
        assert_eq!(token, Some("jwt-xyz-789".to_string()));
    }

    #[test]
    fn test_extract_cookie_missing() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "theme=dark; lang=en".parse().expect("valid header value"),
        );
        let token = extract_token_from_cookie(&headers);
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_cookie_no_cookie_header() {
        let headers = HeaderMap::new();
        let token = extract_token_from_cookie(&headers);
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_cookie_with_spaces_around_equals() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "access_token = jwt-spaced"
                .parse()
                .expect("valid header value"),
        );
        let token = extract_token_from_cookie(&headers);
        // The implementation trims between "access_token" and "=",
        // and also trims the value after "=" to handle whitespace
        assert_eq!(token, Some("jwt-spaced".to_string()));
    }

    #[test]
    fn test_extract_cookie_similar_name_no_match() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "access_token_v2=wrong; other=val"
                .parse()
                .expect("valid header value"),
        );
        // "access_token_v2" starts with "access_token" but then has "_v2" before "="
        // The middleware strips "access_token" prefix, trims, and checks for "=".
        // "access_token_v2=wrong" -> strip "access_token" -> "_v2=wrong" -> trim -> "_v2=wrong" -> no "=" prefix
        let token = extract_token_from_cookie(&headers);
        assert_eq!(token, None);
    }

    // --- AuthUser struct tests ---

    #[test]
    fn test_auth_user_clone() {
        let user = AuthUser {
            user_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: UserRole::Member,
            token_id: Uuid::new_v4(),
        };
        let cloned = user.clone();
        assert_eq!(cloned.user_id, user.user_id);
        assert_eq!(cloned.tenant_id, user.tenant_id);
        assert_eq!(cloned.token_id, user.token_id);
    }

    #[test]
    fn test_auth_user_debug() {
        let user = AuthUser {
            user_id: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: UserRole::Admin,
            token_id: Uuid::new_v4(),
        };
        let debug = format!("{:?}", user);
        assert!(debug.contains("AuthUser"), "got: {}", debug);
        assert!(debug.contains("user_id"), "got: {}", debug);
    }

    // --- AuthErrorResponse tests ---

    #[test]
    fn test_auth_error_response_unauthorized() {
        let resp = AuthErrorResponse::unauthorized();
        assert_eq!(resp.error, "Unauthorized");
    }

    #[test]
    fn test_auth_error_response_serializes() {
        let resp = AuthErrorResponse::unauthorized();
        let json = serde_json::to_string(&resp).expect("should serialize");
        assert!(json.contains("Unauthorized"), "got: {}", json);
    }
}
