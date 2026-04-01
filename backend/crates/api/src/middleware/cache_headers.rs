//! HTTP Cache-Control headers middleware
//!
//! Automatically adds appropriate Cache-Control headers to responses
//! based on the request method and path.

use axum::{extract::Request, http::Method, middleware::Next, response::Response};

use crate::services::http_cache::CacheType;

/// Determine cache type based on HTTP method and path
fn determine_cache_type(method: &Method, path: &str) -> CacheType {
    match *method {
        Method::GET => {
            // Dynamic data that shouldn't be cached (lists, searches)
            if path.contains("/tasks")
                || path.contains("/search")
                || path.contains("/reports")
                || path.contains("/dashboard")
                || path.contains("/metrics")
            {
                CacheType::Dynamic
            } else {
                // Static read-only resources (board details, user info)
                CacheType::PublicRead
            }
        }
        Method::HEAD => CacheType::PublicRead,
        // All mutations and anything else should not be cached
        _ => CacheType::NoCache,
    }
}

/// Middleware that adds Cache-Control headers to responses
///
/// Usage: Add to your router with `layer(from_fn(cache_headers_middleware))`
pub async fn cache_headers_middleware(request: Request, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path();

    let cache_type = determine_cache_type(&method, path);

    let mut response = next.run(request).await;

    // Add Cache-Control header
    let value = axum::http::HeaderValue::from_static(cache_type.header_value());
    response.headers_mut().insert("cache-control", value);

    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_cache_type() {
        // Dynamic resources
        assert_eq!(
            determine_cache_type(&Method::GET, "/api/boards/123/tasks"),
            CacheType::Dynamic
        );
        assert_eq!(
            determine_cache_type(&Method::GET, "/api/tasks/123"),
            CacheType::Dynamic
        );
        assert_eq!(
            determine_cache_type(&Method::GET, "/api/search?q=test"),
            CacheType::Dynamic
        );
        assert_eq!(
            determine_cache_type(&Method::GET, "/api/dashboard/metrics"),
            CacheType::Dynamic
        );

        // Static resources
        assert_eq!(
            determine_cache_type(&Method::GET, "/api/boards/123"),
            CacheType::PublicRead
        );
        assert_eq!(
            determine_cache_type(&Method::GET, "/api/workspaces/123"),
            CacheType::PublicRead
        );

        // Mutations should not be cached
        assert_eq!(
            determine_cache_type(&Method::POST, "/api/tasks"),
            CacheType::NoCache
        );
        assert_eq!(
            determine_cache_type(&Method::PUT, "/api/tasks/123"),
            CacheType::NoCache
        );
        assert_eq!(
            determine_cache_type(&Method::PATCH, "/api/tasks/123"),
            CacheType::NoCache
        );
        assert_eq!(
            determine_cache_type(&Method::DELETE, "/api/tasks/123"),
            CacheType::NoCache
        );
    }
}
