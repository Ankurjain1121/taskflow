//! HTTP metrics middleware
//!
//! Records request method, normalized path, status code, and duration for
//! every HTTP request using the `metrics` crate (Prometheus-compatible).

use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;
use std::time::Instant;

use crate::services::app_metrics::record_http_request;

/// Middleware that records HTTP request metrics (count + duration histogram).
///
/// Must be added as a layer on the Axum router. Uses the global metrics recorder.
pub async fn metrics_middleware(request: Request, next: Next) -> Response {
    let method = request.method().to_string();
    let path = normalize_path(request.uri().path());

    let start = Instant::now();
    let response = next.run(request).await;
    let duration = start.elapsed();

    let status = response.status().as_u16();
    record_http_request(&method, &path, status, duration.as_secs_f64());

    response
}

/// Normalize request paths to reduce cardinality.
///
/// Replaces UUID segments and numeric IDs with placeholders so that
/// `/api/tasks/550e8400-e29b-41d4-a716-446655440000` becomes `/api/tasks/{id}`.
fn normalize_path(path: &str) -> String {
    let segments: Vec<&str> = path.split('/').collect();
    let normalized: Vec<String> = segments
        .iter()
        .map(|segment| {
            if segment.is_empty() {
                String::new()
            } else if is_uuid(segment) || is_numeric_id(segment) {
                "{id}".to_string()
            } else {
                (*segment).to_string()
            }
        })
        .collect();
    normalized.join("/")
}

/// Check if a string looks like a UUID (8-4-4-4-12 hex pattern).
fn is_uuid(s: &str) -> bool {
    if s.len() != 36 {
        return false;
    }
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let expected_lens = [8, 4, 4, 4, 12];
    parts
        .iter()
        .zip(expected_lens.iter())
        .all(|(part, &len)| part.len() == len && part.chars().all(|c| c.is_ascii_hexdigit()))
}

/// Check if a string is a numeric ID.
fn is_numeric_id(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path_with_uuid() {
        let path = "/api/tasks/550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(normalize_path(path), "/api/tasks/{id}");
    }

    #[test]
    fn test_normalize_path_with_numeric_id() {
        let path = "/api/projects/42/columns";
        assert_eq!(normalize_path(path), "/api/projects/{id}/columns");
    }

    #[test]
    fn test_normalize_path_no_ids() {
        let path = "/api/health";
        assert_eq!(normalize_path(path), "/api/health");
    }

    #[test]
    fn test_normalize_path_multiple_uuids() {
        let path = "/api/projects/550e8400-e29b-41d4-a716-446655440000/tasks/660e8400-e29b-41d4-a716-446655440000";
        assert_eq!(normalize_path(path), "/api/projects/{id}/tasks/{id}");
    }

    #[test]
    fn test_is_uuid_valid() {
        assert!(is_uuid("550e8400-e29b-41d4-a716-446655440000"));
    }

    #[test]
    fn test_is_uuid_invalid() {
        assert!(!is_uuid("not-a-uuid"));
        assert!(!is_uuid("550e8400"));
        assert!(!is_uuid(""));
    }

    #[test]
    fn test_is_numeric_id() {
        assert!(is_numeric_id("42"));
        assert!(is_numeric_id("0"));
        assert!(!is_numeric_id(""));
        assert!(!is_numeric_id("abc"));
    }
}
