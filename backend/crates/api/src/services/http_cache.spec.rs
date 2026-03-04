//! HTTP cache integration tests
//!
//! Tests for Cache-Control headers and ETag generation.

#[cfg(test)]
mod tests {
    use axum::http::HeaderMap;
    use crate::services::http_cache::{CacheType, generate_etag, check_if_none_match};

    #[test]
    fn test_etag_consistency() {
        // Same input should always produce same ETag
        let json = r#"{"id":"123","name":"Test Board"}"#;
        let etag1 = generate_etag(json);
        let etag2 = generate_etag(json);
        assert_eq!(etag1, etag2, "ETags should be consistent");
    }

    #[test]
    fn test_etag_differentiation() {
        // Different inputs should produce different ETags
        let json1 = r#"{"id":"123","name":"Test Board 1"}"#;
        let json2 = r#"{"id":"123","name":"Test Board 2"}"#;
        let etag1 = generate_etag(json1);
        let etag2 = generate_etag(json2);
        assert_ne!(etag1, etag2, "Different content should produce different ETags");
    }

    #[test]
    fn test_etag_length() {
        // SHA256 produces 64-char hex string
        let json = r#"{"test": "data"}"#;
        let etag = generate_etag(json);
        assert_eq!(etag.len(), 64, "SHA256 ETag should be 64 chars");
        assert!(etag.chars().all(|c| c.is_ascii_hexdigit()), "ETag should be valid hex");
    }

    #[test]
    fn test_if_none_match_header_parsing() {
        // Etag without quotes in header (standard format)
        let mut headers = HeaderMap::new();
        let etag = "abc123def456";

        // When header has quoted value
        if let Ok(value) = axum::http::HeaderValue::from_str(&format!("\"{}\"", etag)) {
            headers.insert("if-none-match", value);
        }

        assert!(check_if_none_match(&headers, etag), "Should match quoted ETag");
    }

    #[test]
    fn test_cache_types() {
        assert_eq!(CacheType::PublicRead.header_value(), "public, max-age=60");
        assert_eq!(CacheType::Dynamic.header_value(), "public, max-age=0, must-revalidate");
        assert_eq!(CacheType::NoCache.header_value(), "no-cache, no-store, must-revalidate");
    }
}
