//! IP-based rate limiting middleware
//!
//! Uses a DashMap to track request counts per IP with a sliding window.

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use dashmap::DashMap;
use std::sync::Arc;
use std::time::Instant;

/// Tracks request timestamps for an IP
#[derive(Clone)]
struct RateEntry {
    timestamps: Vec<Instant>,
}

/// Rate limiter state shared across requests
#[derive(Clone)]
pub struct RateLimiter {
    entries: Arc<DashMap<String, RateEntry>>,
    max_requests: u32,
    window_secs: u64,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            entries: Arc::new(DashMap::new()),
            max_requests,
            window_secs,
        }
    }

    /// Check if the IP is allowed. Returns Ok(()) if under the limit,
    /// or Err(retry_after_secs) if rate limited.
    fn check_and_record(&self, ip: &str) -> std::result::Result<(), u64> {
        let now = Instant::now();
        let window = std::time::Duration::from_secs(self.window_secs);

        let mut entry = self
            .entries
            .entry(ip.to_string())
            .or_insert_with(|| RateEntry {
                timestamps: Vec::new(),
            });

        // Remove timestamps outside the window
        entry.timestamps.retain(|t| now.duration_since(*t) < window);

        if entry.timestamps.len() >= self.max_requests as usize {
            // Calculate how long until the oldest request expires
            let oldest = entry.timestamps[0];
            let elapsed = now.duration_since(oldest);
            let retry_after = self.window_secs.saturating_sub(elapsed.as_secs()) + 1;
            return Err(retry_after);
        }

        entry.timestamps.push(now);
        Ok(())
    }
}

/// Extract client IP address from request.
/// When behind a reverse proxy (Caddy), the peer address is the proxy's IP.
/// We trust X-Forwarded-For set by Caddy, but take the LAST entry (the one
/// added by the trusted reverse proxy) to prevent client spoofing.
fn extract_ip(req: &Request<Body>) -> String {
    // When behind a reverse proxy, use X-Forwarded-For (last entry = real client IP)
    if let Some(forwarded) = req.headers().get("X-Forwarded-For") {
        if let Ok(s) = forwarded.to_str() {
            // Take the LAST IP — the one appended by the trusted reverse proxy (Caddy)
            if let Some(last_ip) = s.rsplit(',').next() {
                let ip = last_ip.trim();
                if !ip.is_empty() {
                    return ip.to_string();
                }
            }
        }
    }

    // Fallback to peer address (direct connection without reverse proxy)
    if let Some(connect_info) = req
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
    {
        return connect_info.0.ip().to_string();
    }

    "unknown".to_string()
}

/// Rate limiting middleware that checks IP-based limits.
/// Attach via `axum::middleware::from_fn`.
/// Returns 429 Too Many Requests with Retry-After header when limit exceeded.
pub async fn rate_limit_middleware(
    req: Request<Body>,
    next: Next,
) -> std::result::Result<Response, Response> {
    let limiter = req
        .extensions()
        .get::<RateLimiter>()
        .cloned()
        .ok_or_else(|| StatusCode::INTERNAL_SERVER_ERROR.into_response())?;

    let ip = extract_ip(&req);

    if let Err(retry_after) = limiter.check_and_record(&ip) {
        let response = (
            StatusCode::TOO_MANY_REQUESTS,
            [("Retry-After", retry_after.to_string())],
            "Too many requests. Please try again later.",
        )
            .into_response();
        return Err(response);
    }

    Ok(next.run(req).await)
}

/// Create an Axum layer that injects a RateLimiter and applies rate limiting.
/// Usage: `.layer(rate_limit_layer(5, 60))` for 5 requests per 60 seconds.
pub fn rate_limit_layer(
    max_requests: u32,
    window_secs: u64,
) -> tower::util::MapRequestLayer<impl Fn(Request<Body>) -> Request<Body> + Clone> {
    let limiter = RateLimiter::new(max_requests, window_secs);
    tower::util::MapRequestLayer::new(move |mut req: Request<Body>| {
        req.extensions_mut().insert(limiter.clone());
        req
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter_allows_under_limit() {
        let limiter = RateLimiter::new(5, 60);
        for i in 0..4 {
            assert!(
                limiter.check_and_record("192.168.1.1").is_ok(),
                "Request {} should be allowed",
                i + 1
            );
        }
    }

    #[test]
    fn test_rate_limiter_blocks_over_limit() {
        let limiter = RateLimiter::new(3, 60);
        assert!(
            limiter.check_and_record("10.0.0.1").is_ok(),
            "Request 1 should be allowed"
        );
        assert!(
            limiter.check_and_record("10.0.0.1").is_ok(),
            "Request 2 should be allowed"
        );
        assert!(
            limiter.check_and_record("10.0.0.1").is_ok(),
            "Request 3 should be allowed"
        );
        assert!(
            limiter.check_and_record("10.0.0.1").is_err(),
            "Request 4 should be blocked"
        );
    }

    #[test]
    fn test_rate_limiter_blocks_with_retry_after() {
        let limiter = RateLimiter::new(1, 60);
        assert!(limiter.check_and_record("10.0.0.1").is_ok());
        let result = limiter.check_and_record("10.0.0.1");
        assert!(result.is_err(), "Should be rate limited");
        let retry_after = result.unwrap_err();
        assert!(retry_after > 0, "Retry-After should be positive");
        assert!(retry_after <= 61, "Retry-After should be within window");
    }

    #[test]
    fn test_rate_limiter_different_ips() {
        let limiter = RateLimiter::new(2, 60);
        assert!(limiter.check_and_record("1.1.1.1").is_ok());
        assert!(limiter.check_and_record("1.1.1.1").is_ok());
        assert!(
            limiter.check_and_record("1.1.1.1").is_err(),
            "IP 1 should be blocked"
        );

        // Different IP should have its own independent counter
        assert!(
            limiter.check_and_record("2.2.2.2").is_ok(),
            "IP 2 should still be allowed"
        );
        assert!(
            limiter.check_and_record("2.2.2.2").is_ok(),
            "IP 2 second request should be allowed"
        );
        assert!(
            limiter.check_and_record("2.2.2.2").is_err(),
            "IP 2 third request should be blocked"
        );
    }

    #[test]
    fn test_rate_limiter_single_request_limit() {
        let limiter = RateLimiter::new(1, 60);
        assert!(
            limiter.check_and_record("10.0.0.1").is_ok(),
            "First request should be allowed"
        );
        assert!(
            limiter.check_and_record("10.0.0.1").is_err(),
            "Second request should be blocked"
        );
    }
}
