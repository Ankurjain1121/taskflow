pub mod audit;
pub mod auth;
pub mod cache_headers;
pub mod csrf;
pub mod rate_limit;
pub mod request_id;
pub mod security_headers;
pub mod tenant;

pub use audit::{audit_middleware, AuditEntity, AuditRouteId};
pub use auth::{auth_middleware, optional_auth_middleware, AuthUser};
pub use cache_headers::cache_headers_middleware;
pub use csrf::{csrf_middleware, generate_csrf_token, revoke_csrf_token, store_csrf_token};
pub use rate_limit::{
    rate_limit_layer, rate_limit_middleware, user_rate_limit_layer, user_rate_limit_middleware,
};
pub use request_id::request_id_middleware;
pub use security_headers::security_headers_middleware;
pub use tenant::{set_tenant_context, with_tenant, with_tenant_tx};

/// Extract client IP from request headers.
///
/// Behind a single-hop nginx reverse proxy, the leftmost (first) entry in
/// `X-Forwarded-For` is the original client IP. Falls back to `X-Real-IP`.
/// Returns `None` if no IP header is present.
pub fn extract_client_ip(headers: &axum::http::HeaderMap) -> Option<String> {
    // X-Forwarded-For: <client>, <proxy1>, <proxy2>
    // Take the FIRST entry — the original client IP set by the first proxy hop.
    if let Some(forwarded) = headers.get("X-Forwarded-For") {
        if let Ok(s) = forwarded.to_str() {
            if let Some(first_ip) = s.split(',').next() {
                let ip = first_ip.trim();
                if !ip.is_empty() {
                    return Some(ip.to_string());
                }
            }
        }
    }

    // Fallback to X-Real-IP (set by nginx)
    if let Some(real_ip) = headers.get("X-Real-IP") {
        if let Ok(s) = real_ip.to_str() {
            let ip = s.trim();
            if !ip.is_empty() {
                return Some(ip.to_string());
            }
        }
    }

    None
}
