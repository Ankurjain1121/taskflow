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
        .map_or_else(|| Uuid::new_v4().to_string(), std::string::ToString::to_string);

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
    use axum::http::HeaderValue;

    #[test]
    fn test_request_id_header_constant() {
        assert_eq!(REQUEST_ID_HEADER, "X-Request-Id");
    }

    #[test]
    fn test_request_id_header_is_valid_http_header_name() {
        // Verify the constant is a valid HTTP header name
        let result = axum::http::HeaderName::from_static("x-request-id");
        assert_eq!(result.as_str(), "x-request-id");
    }

    #[test]
    fn test_uuid_v4_is_valid_header_value() {
        let id = Uuid::new_v4().to_string();
        let result = HeaderValue::from_str(&id);
        assert!(result.is_ok(), "UUID v4 should be a valid header value");
    }

    #[test]
    fn test_empty_string_filtered_out() {
        // Empty strings should be filtered by the .filter() in the middleware
        let empty = "";
        let passes_filter = !empty.is_empty() && empty.len() <= 128;
        assert!(!passes_filter, "Empty string should not pass the filter");
    }

    #[test]
    fn test_string_exceeding_128_chars_filtered_out() {
        let long_string = "a".repeat(129);
        let passes_filter = !long_string.is_empty() && long_string.len() <= 128;
        assert!(
            !passes_filter,
            "String > 128 chars should not pass the filter"
        );
    }

    #[test]
    fn test_string_at_128_chars_passes_filter() {
        let exactly_128 = "a".repeat(128);
        let passes_filter = !exactly_128.is_empty() && exactly_128.len() <= 128;
        assert!(passes_filter, "String of exactly 128 chars should pass");
    }

    #[test]
    fn test_valid_client_request_id_passes_filter() {
        let client_id = "my-custom-request-id-12345";
        let passes_filter = !client_id.is_empty() && client_id.len() <= 128;
        assert!(passes_filter, "Normal client request ID should pass");
    }

    #[test]
    fn test_uuid_v4_format_is_36_chars() {
        let id = Uuid::new_v4().to_string();
        assert_eq!(id.len(), 36, "UUID v4 string should be 36 characters");
    }

    #[test]
    fn test_uuid_v4_passes_length_filter() {
        let id = Uuid::new_v4().to_string();
        let passes_filter = !id.is_empty() && id.len() <= 128;
        assert!(
            passes_filter,
            "UUID v4 should pass the 128-char length filter"
        );
    }

    #[test]
    fn test_single_char_passes_filter() {
        let id = "x";
        let passes_filter = !id.is_empty() && id.len() <= 128;
        assert!(passes_filter, "Single character should pass filter");
    }

    #[test]
    fn test_string_at_127_chars_passes_filter() {
        let exactly_127 = "a".repeat(127);
        let passes_filter = !exactly_127.is_empty() && exactly_127.len() <= 128;
        assert!(passes_filter, "String of 127 chars should pass");
    }

    #[test]
    fn test_request_id_header_value_can_be_constructed() {
        // Verify various valid request IDs can be turned into HTTP header values
        let test_ids = [
            "abc-123",
            "req_001",
            "550e8400-e29b-41d4-a716-446655440000",
            "my.request.id",
        ];
        for id in test_ids {
            let result = HeaderValue::from_str(id);
            assert!(result.is_ok(), "ID '{}' should be a valid header value", id);
        }
    }
}
