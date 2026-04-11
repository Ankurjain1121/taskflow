//! Unit tests for auth module helpers (hash_token, extract_cookie, cookie builders, password strength)

use axum::http::{HeaderMap, HeaderValue, header::COOKIE, header::SET_COOKIE};

use super::{
    build_auth_cookie_headers, build_clear_cookie_headers, extract_cookie, hash_token,
    is_password_strong,
};

#[test]
fn test_hash_token_deterministic() {
    assert_eq!(hash_token("test"), hash_token("test"));
}

#[test]
fn test_hash_token_different_inputs() {
    assert_ne!(hash_token("a"), hash_token("b"));
}

#[test]
fn test_hash_token_hex_format() {
    let result = hash_token("test");
    assert_eq!(result.len(), 64);
    assert!(result.chars().all(|c| c.is_ascii_hexdigit()));
    // Verify it's lowercase hex
    assert_eq!(result, result.to_lowercase());
}

#[test]
fn test_extract_cookie_single() {
    let mut headers = HeaderMap::new();
    headers.insert(COOKIE, HeaderValue::from_static("access_token=abc123"));
    assert_eq!(
        extract_cookie(&headers, "access_token"),
        Some("abc123".to_string())
    );
}

#[test]
fn test_extract_cookie_multiple() {
    let mut headers = HeaderMap::new();
    headers.insert(
        COOKIE,
        HeaderValue::from_static("other=x; access_token=abc123; third=y"),
    );
    assert_eq!(
        extract_cookie(&headers, "access_token"),
        Some("abc123".to_string())
    );
}

#[test]
fn test_extract_cookie_missing() {
    let mut headers = HeaderMap::new();
    headers.insert(COOKIE, HeaderValue::from_static("other=x"));
    assert_eq!(extract_cookie(&headers, "access_token"), None);
}

#[test]
fn test_extract_cookie_no_header() {
    let headers = HeaderMap::new();
    assert_eq!(extract_cookie(&headers, "access_token"), None);
}

#[test]
fn test_extract_cookie_refresh_token() {
    let mut headers = HeaderMap::new();
    headers.insert(
        COOKIE,
        HeaderValue::from_static("access_token=aaa; refresh_token=bbb"),
    );
    assert_eq!(
        extract_cookie(&headers, "refresh_token"),
        Some("bbb".to_string())
    );
}

#[test]
fn test_build_auth_cookie_headers_http() {
    let headers =
        build_auth_cookie_headers("tok", "ref", 3600, 86400, "http://localhost:4200", true)
            .expect("should build cookie headers");
    let cookies: Vec<String> = headers
        .get_all(SET_COOKIE)
        .iter()
        .map(|v| v.to_str().unwrap().to_string())
        .collect();
    // Neither cookie should contain "Secure"
    for cookie in &cookies {
        assert!(
            !cookie.contains("Secure"),
            "HTTP cookie should not have Secure flag: {}",
            cookie
        );
    }
}

#[test]
fn test_build_auth_cookie_headers_https() {
    let headers = build_auth_cookie_headers(
        "tok",
        "ref",
        3600,
        86400,
        "https://taskbolt.example.com",
        true,
    )
    .expect("should build cookie headers");
    let cookies: Vec<String> = headers
        .get_all(SET_COOKIE)
        .iter()
        .map(|v| v.to_str().unwrap().to_string())
        .collect();
    // Both cookies should contain "Secure"
    for cookie in &cookies {
        assert!(
            cookie.contains("Secure"),
            "HTTPS cookie should have Secure flag: {}",
            cookie
        );
    }
}

#[test]
fn test_build_clear_cookie_headers() {
    let headers =
        build_clear_cookie_headers("http://localhost:4200").expect("should build clear headers");
    let cookies: Vec<String> = headers
        .get_all(SET_COOKIE)
        .iter()
        .map(|v| v.to_str().unwrap().to_string())
        .collect();
    assert_eq!(cookies.len(), 2);
    for cookie in &cookies {
        assert!(
            cookie.contains("Max-Age=0"),
            "Clear cookie should have Max-Age=0: {}",
            cookie
        );
    }
    // One should be access_token, one should be refresh_token
    assert!(cookies.iter().any(|c| c.starts_with("access_token=")));
    assert!(cookies.iter().any(|c| c.starts_with("refresh_token=")));
}

// === is_password_strong tests ===

#[test]
fn test_password_strong_valid() {
    assert!(is_password_strong("Abcdefg1"));
}

#[test]
fn test_password_strong_long() {
    assert!(is_password_strong("MyStr0ngPass"));
}

#[test]
fn test_password_strong_too_short() {
    assert!(!is_password_strong("Abcde1"));
}

#[test]
fn test_password_strong_7_chars() {
    assert!(!is_password_strong("Abcdef1"));
}

#[test]
fn test_password_strong_no_upper() {
    assert!(!is_password_strong("abcdefg1"));
}

#[test]
fn test_password_strong_no_lower() {
    assert!(!is_password_strong("ABCDEFG1"));
}

#[test]
fn test_password_strong_no_digit() {
    assert!(!is_password_strong("Abcdefgh"));
}

#[test]
fn test_password_strong_empty() {
    assert!(!is_password_strong(""));
}

#[test]
fn test_password_strong_spaces() {
    assert!(is_password_strong("Ab cde1g"));
}

#[test]
fn test_password_strong_minimum_valid() {
    // Exactly 8 chars with upper, lower, digit
    assert!(is_password_strong("Abcdefg1"));
}

#[test]
fn test_password_strong_special_chars_only() {
    // Special chars but no digit
    assert!(!is_password_strong("Abcdefg!"));
}

#[test]
fn test_password_strong_with_special_chars() {
    assert!(is_password_strong("Abcdef1!"));
}

#[test]
fn test_password_strong_very_long() {
    let long_pass = format!("Aa1{}", "x".repeat(200));
    assert!(is_password_strong(&long_pass));
}

#[test]
fn test_password_strong_unicode_uppercase() {
    // Unicode uppercase letter should count
    assert!(is_password_strong("\u{00C9}bcdefg1"));
}

#[test]
fn test_password_strong_unicode_lowercase() {
    // Unicode lowercase should count
    assert!(is_password_strong("A\u{00E9}cdefg1"));
}

#[test]
fn test_password_strong_digits_only_no_alpha() {
    assert!(!is_password_strong("12345678"));
}

#[test]
fn test_password_strong_all_same_case_upper_with_digit() {
    assert!(!is_password_strong("ABCDEFG1"));
}

#[test]
fn test_password_strong_all_same_case_lower_with_digit() {
    assert!(!is_password_strong("abcdefg1"));
}
