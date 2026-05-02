pub mod audit;
pub mod auth;
pub mod cache_headers;
pub mod csrf;
pub mod metrics_middleware;
pub mod rate_limit;
pub mod request_id;
pub mod security_headers;
pub mod tenant;

pub use audit::{audit_middleware, AuditEntity, AuditRouteId};
pub use auth::{auth_middleware, optional_auth_middleware, AuthUser};
pub use cache_headers::cache_headers_middleware;
pub use csrf::{csrf_middleware, generate_csrf_token, revoke_csrf_token, store_csrf_token};
pub use metrics_middleware::metrics_middleware;
pub use rate_limit::{
    rate_limit_layer, rate_limit_middleware, user_rate_limit_layer, user_rate_limit_middleware,
};
pub use request_id::request_id_middleware;
pub use security_headers::security_headers_middleware;
pub use tenant::{set_tenant_context, with_tenant, with_tenant_tx};

/// Extract client IP from request headers, trusting `X-Forwarded-For` /
/// `X-Real-IP` ONLY when the peer IP is in the trusted-proxy allow-list.
///
/// `peer_ip` is the direct TCP peer (from `ConnectInfo`). When `peer_ip` is
/// `None` or not in the trusted set, header-supplied IPs are ignored to defeat
/// spoofed `X-Forwarded-For` rate-limit bypass (CWE-290 / CWE-348).
///
/// Trust set comes from env `TRUSTED_PROXIES` (comma-separated IPs). Defaults
/// to loopback `127.0.0.1`, `::1` so single-host nginx still works without
/// configuration.
pub fn extract_client_ip(
    headers: &axum::http::HeaderMap,
    peer_ip: Option<&str>,
) -> Option<String> {
    let peer = peer_ip?;

    if !is_trusted_proxy(peer) {
        return Some(peer.to_string());
    }

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

    if let Some(real_ip) = headers.get("X-Real-IP") {
        if let Ok(s) = real_ip.to_str() {
            let ip = s.trim();
            if !ip.is_empty() {
                return Some(ip.to_string());
            }
        }
    }

    Some(peer.to_string())
}

fn is_trusted_proxy(peer_ip: &str) -> bool {
    let raw = std::env::var("TRUSTED_PROXIES").unwrap_or_else(|_| "127.0.0.1,::1".to_string());
    raw.split(',').any(|p| p.trim() == peer_ip)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn test_xff_trusted_peer() {
        // Default trusted set includes 127.0.0.1
        let mut headers = HeaderMap::new();
        headers.insert("X-Forwarded-For", HeaderValue::from_static("1.2.3.4"));
        assert_eq!(
            extract_client_ip(&headers, Some("127.0.0.1")),
            Some("1.2.3.4".to_string())
        );
    }

    #[test]
    fn test_xff_chain_trusted_peer() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "X-Forwarded-For",
            HeaderValue::from_static("1.2.3.4, 5.6.7.8"),
        );
        assert_eq!(
            extract_client_ip(&headers, Some("127.0.0.1")),
            Some("1.2.3.4".to_string())
        );
    }

    #[test]
    fn test_xff_ignored_when_peer_untrusted() {
        // Spoofed XFF from non-trusted peer must be ignored — fall back to peer.
        let mut headers = HeaderMap::new();
        headers.insert("X-Forwarded-For", HeaderValue::from_static("1.2.3.4"));
        assert_eq!(
            extract_client_ip(&headers, Some("9.9.9.9")),
            Some("9.9.9.9".to_string())
        );
    }

    #[test]
    fn test_no_peer_no_ip() {
        let headers = HeaderMap::new();
        assert_eq!(extract_client_ip(&headers, None), None);
    }
}
