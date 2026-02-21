//! Request ID middleware
//!
//! Reads or generates a unique request ID for every incoming request.
//! The ID is set as a tracing span field and returned in the response
//! via the `X-Request-Id` header.

use axum::{
    body::Body,
    http::{HeaderValue, Request},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

const REQUEST_ID_HEADER: &str = "X-Request-Id";

/// Middleware that ensures every request has a unique ID.
///
/// - If the client sends `X-Request-Id`, that value is used.
/// - Otherwise, a new UUID v4 is generated.
/// - The ID is added to the response headers and to the current tracing span.
pub async fn request_id_middleware(req: Request<Body>, next: Next) -> Response {
    let request_id = req
        .headers()
        .get(REQUEST_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty() && s.len() <= 128)
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Add to tracing span
    tracing::Span::current().record("request_id", request_id.as_str());

    let mut response = next.run(req).await;

    // Add request ID to response headers
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert(REQUEST_ID_HEADER, value);
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_id_header_constant() {
        assert_eq!(REQUEST_ID_HEADER, "X-Request-Id");
    }
}
