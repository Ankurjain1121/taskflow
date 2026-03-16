//! CSRF token protection middleware
//!
//! Implements CSRF token validation for state-changing requests (POST, PUT, DELETE, PATCH).
//! CSRF tokens are generated during login and must be included in the X-CSRF-Token header
//! for all mutations to prevent cross-site request forgery attacks.

use axum::{
    body::Body,
    extract::State,
    http::{header::HeaderMap, Method, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::state::AppState;

/// Error response for CSRF failures
#[derive(Serialize)]
pub struct CsrfErrorResponse {
    error: String,
}

impl CsrfErrorResponse {
    fn invalid_token() -> Self {
        Self {
            error: "Invalid or missing CSRF token".to_string(),
        }
    }
}

/// CSRF token validation middleware
///
/// Validates CSRF tokens on state-changing requests (POST, PUT, DELETE, PATCH).
/// GET, HEAD, and OPTIONS requests skip CSRF validation.
///
/// Token is read from X-CSRF-Token header and validated against Redis.
/// Returns 403 Forbidden if token is invalid or missing on mutations.
pub async fn csrf_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let method = req.method().clone();

    // Skip CSRF validation for safe methods
    if matches!(method, Method::GET | Method::HEAD | Method::OPTIONS) {
        return next.run(req).await;
    }

    // Get CSRF token from header
    let csrf_token = match extract_csrf_token(req.headers()) {
        Some(token) => token,
        None => {
            return (
                StatusCode::FORBIDDEN,
                Json(CsrfErrorResponse::invalid_token()),
            )
                .into_response();
        }
    };

    // Get user ID from extensions (set by auth middleware)
    // Fail-closed: if no AuthUser is present, reject the request
    let user_id = match req.extensions().get::<crate::middleware::auth::AuthUser>() {
        Some(auth_user) => auth_user.user_id,
        None => {
            return (
                StatusCode::FORBIDDEN,
                Json(CsrfErrorResponse::invalid_token()),
            )
                .into_response();
        }
    };

    // Validate CSRF token in Redis
    if !validate_csrf_token(&state, &user_id, &csrf_token).await {
        return (
            StatusCode::FORBIDDEN,
            Json(CsrfErrorResponse::invalid_token()),
        )
            .into_response();
    }

    next.run(req).await
}

/// Extract CSRF token from X-CSRF-Token header
fn extract_csrf_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("X-CSRF-Token")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

/// Validate CSRF token against Redis
/// Token is stored as "csrf:{user_id}:{token_hash}" in Redis with TTL
async fn validate_csrf_token(state: &AppState, user_id: &Uuid, token: &str) -> bool {
    let token_hash = hash_csrf_token(token);
    let csrf_key = format!("csrf:{}:{}", user_id, token_hash);

    // Check if token exists and is valid
    let mut redis_conn = state.redis.clone();
    let exists: Result<bool, _> = redis::cmd("EXISTS")
        .arg(&csrf_key)
        .query_async(&mut redis_conn)
        .await;

    exists.unwrap_or(false)
}

/// Hash CSRF token using SHA-256
fn hash_csrf_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Generate a new CSRF token
pub fn generate_csrf_token() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}

/// Store CSRF token in Redis with user scope and TTL
/// Returns the token to be sent to client
pub async fn store_csrf_token(
    state: &AppState,
    user_id: Uuid,
    ttl_secs: usize,
) -> Result<String, String> {
    let token = generate_csrf_token();
    let token_hash = hash_csrf_token(&token);
    let csrf_key = format!("csrf:{}:{}", user_id, token_hash);

    // Store token in Redis with TTL
    let mut redis_conn = state.redis.clone();
    let _: () = redis::cmd("SET")
        .arg(&csrf_key)
        .arg("1") // Just store a marker value
        .arg("EX")
        .arg(ttl_secs)
        .query_async(&mut redis_conn)
        .await
        .map_err(|e| format!("Redis command error: {}", e))?;

    Ok(token)
}

/// Revoke a CSRF token from Redis
pub async fn revoke_csrf_token(state: &AppState, user_id: Uuid, token: &str) -> Result<(), String> {
    let token_hash = hash_csrf_token(token);
    let csrf_key = format!("csrf:{}:{}", user_id, token_hash);

    let mut redis_conn = state.redis.clone();
    let _: () = redis::cmd("DEL")
        .arg(&csrf_key)
        .query_async(&mut redis_conn)
        .await
        .map_err(|e| format!("Redis command error: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_csrf_token_deterministic() {
        let token = "test-csrf-token";
        assert_eq!(hash_csrf_token(token), hash_csrf_token(token));
    }

    #[test]
    fn test_hash_csrf_token_different_inputs() {
        assert_ne!(hash_csrf_token("token1"), hash_csrf_token("token2"));
    }

    #[test]
    fn test_hash_csrf_token_hex_format() {
        let hash = hash_csrf_token("test");
        assert_eq!(hash.len(), 64); // SHA-256 produces 64 hex chars
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_generate_csrf_token_unique() {
        let token1 = generate_csrf_token();
        let token2 = generate_csrf_token();
        assert_ne!(token1, token2);
    }

    #[test]
    fn test_generate_csrf_token_valid_uuid() {
        let token = generate_csrf_token();
        // Should be valid UUID v4
        assert!(Uuid::parse_str(&token).is_ok());
    }

    #[test]
    fn test_extract_csrf_token_valid() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "X-CSRF-Token",
            "test-token-123".parse().expect("valid header"),
        );
        assert_eq!(
            extract_csrf_token(&headers),
            Some("test-token-123".to_string())
        );
    }

    #[test]
    fn test_extract_csrf_token_missing() {
        let headers = HeaderMap::new();
        assert_eq!(extract_csrf_token(&headers), None);
    }

    #[test]
    fn test_extract_csrf_token_case_sensitive_header() {
        let mut headers = HeaderMap::new();
        headers.insert("x-csrf-token", "token".parse().expect("valid header"));
        // Header names are case-insensitive in HTTP, but we're testing the exact match
        // Axum should normalize this, but let's verify
        assert!(extract_csrf_token(&headers).is_some());
    }
}
