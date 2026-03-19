//! HTTP caching utilities for Cache-Control headers and ETags
//!
//! Provides helpers for:
//! - Cache-Control header generation based on endpoint type
//! - ETag generation from JSON response bodies
//! - Conditional request handling (If-None-Match)

use axum::http::{HeaderMap, HeaderValue};
use sha2::{Digest, Sha256};

/// Endpoint caching category
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CacheType {
    /// Public read-only data: max-age=60
    PublicRead,
    /// Dynamic data that changes frequently: max-age=0, must-revalidate
    Dynamic,
    /// Mutations (POST/PUT/DELETE): no-cache, no-store
    NoCache,
}

impl CacheType {
    /// Get the Cache-Control header value for this type
    pub fn header_value(&self) -> &'static str {
        match self {
            CacheType::PublicRead => "private, max-age=60",
            CacheType::Dynamic => "private, max-age=0, must-revalidate",
            CacheType::NoCache => "no-cache, no-store, must-revalidate",
        }
    }
}

/// Generate an ETag from a JSON response body
///
/// Uses SHA256 hash of the response string to produce a strong ETag.
/// Example: `"a1b2c3d4e5f6..."` (32-char hex digest)
pub fn generate_etag(response_body: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(response_body.as_bytes());
    let digest = hasher.finalize();
    format!("{:x}", digest)
}

/// Check if a request has a matching ETag (If-None-Match header)
///
/// Returns true if the request's If-None-Match matches the given etag,
/// indicating the client already has the current version.
pub fn check_if_none_match(headers: &HeaderMap, etag: &str) -> bool {
    headers
        .get("if-none-match")
        .and_then(|h| h.to_str().ok())
        .map(|val| val.trim_matches('"') == etag || val == "*")
        .unwrap_or(false)
}

/// Add cache control headers to a HeaderMap
pub fn add_cache_headers(headers: &mut HeaderMap, cache_type: CacheType) {
    let value = HeaderValue::from_static(cache_type.header_value());
    headers.insert("cache-control", value);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_type_headers() {
        assert_eq!(CacheType::PublicRead.header_value(), "private, max-age=60");
        assert_eq!(
            CacheType::Dynamic.header_value(),
            "private, max-age=0, must-revalidate"
        );
        assert_eq!(
            CacheType::NoCache.header_value(),
            "no-cache, no-store, must-revalidate"
        );
    }

    #[test]
    fn test_etag_generation() {
        let json1 = r#"{"id":"123","name":"Test"}"#;
        let json2 = r#"{"id":"123","name":"Test"}"#;
        let json3 = r#"{"id":"456","name":"Test"}"#;

        // Same content should produce same etag
        let etag1 = generate_etag(json1);
        let etag2 = generate_etag(json2);
        assert_eq!(etag1, etag2);

        // Different content should produce different etag
        let etag3 = generate_etag(json3);
        assert_ne!(etag1, etag3);

        // ETag should be hex string (lowercase, 64 chars for SHA256)
        assert!(etag1.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(etag1.len(), 64);
    }

    #[test]
    fn test_check_if_none_match() {
        let etag = "a1b2c3d4e5f6";
        let mut headers = HeaderMap::new();

        // No header should return false
        assert!(!check_if_none_match(&headers, etag));

        // Matching etag should return true
        headers.insert(
            "if-none-match",
            HeaderValue::from_static("\"a1b2c3d4e5f6\""),
        );
        assert!(check_if_none_match(&headers, etag));

        // Different etag should return false
        let mut headers = HeaderMap::new();
        headers.insert("if-none-match", HeaderValue::from_static("\"different\""));
        assert!(!check_if_none_match(&headers, etag));

        // Wildcard should match any
        let mut headers = HeaderMap::new();
        headers.insert("if-none-match", HeaderValue::from_static("*"));
        assert!(check_if_none_match(&headers, etag));
    }

    #[test]
    fn test_add_cache_headers() {
        let mut headers = HeaderMap::new();
        add_cache_headers(&mut headers, CacheType::PublicRead);

        assert_eq!(
            headers.get("cache-control").unwrap().to_str().unwrap(),
            "private, max-age=60"
        );
    }
}
