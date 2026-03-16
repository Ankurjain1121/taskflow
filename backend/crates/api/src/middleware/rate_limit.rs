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

    /// Spawn a background task that periodically evicts expired entries.
    fn spawn_gc(&self) {
        let entries = self.entries.clone();
        let window_secs = self.window_secs;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
            loop {
                interval.tick().await;
                let now = Instant::now();
                let window = std::time::Duration::from_secs(window_secs);
                let before = entries.len();
                entries.retain(|_key, entry| {
                    entry
                        .timestamps
                        .iter()
                        .any(|t| now.duration_since(*t) < window)
                });
                let removed = before - entries.len();
                if removed > 0 {
                    tracing::info!(removed, "GC: cleaned rate limiter entries");
                }
            }
        });
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
/// Delegates to the shared `extract_client_ip` utility (first entry in
/// X-Forwarded-For behind single-hop nginx), with a fallback to the peer
/// address from `ConnectInfo`.
fn extract_ip(req: &Request<Body>) -> String {
    if let Some(ip) = super::extract_client_ip(req.headers()) {
        return ip;
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
    limiter.spawn_gc();
    tower::util::MapRequestLayer::new(move |mut req: Request<Body>| {
        req.extensions_mut().insert(limiter.clone());
        req
    })
}

// ============================================================================
// Per-user rate limiting (keyed by user_id from AuthUser)
// ============================================================================

/// Per-user rate limiter state shared across requests.
/// Uses user_id (UUID) as the key instead of IP address.
#[derive(Clone)]
pub struct UserRateLimiter {
    inner: RateLimiter,
}

impl UserRateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            inner: RateLimiter::new(max_requests, window_secs),
        }
    }
}

/// Per-user rate limiting middleware.
/// Must be applied AFTER the auth middleware so AuthUser is available in extensions.
/// Falls back to IP-based limiting for unauthenticated requests.
pub async fn user_rate_limit_middleware(
    req: Request<Body>,
    next: Next,
) -> std::result::Result<Response, Response> {
    let limiter = req
        .extensions()
        .get::<UserRateLimiter>()
        .cloned()
        .ok_or_else(|| StatusCode::INTERNAL_SERVER_ERROR.into_response())?;

    // Use user_id if available (authenticated), otherwise fall back to IP
    let key = if let Some(auth_user) = req.extensions().get::<crate::middleware::auth::AuthUser>() {
        format!("user:{}", auth_user.user_id)
    } else {
        format!("ip:{}", extract_ip(&req))
    };

    if let Err(retry_after) = limiter.inner.check_and_record(&key) {
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

/// Create an Axum layer that injects a UserRateLimiter for per-user rate limiting.
/// Usage: `.layer(user_rate_limit_layer(100, 60))` for 100 requests per 60 seconds per user.
pub fn user_rate_limit_layer(
    max_requests: u32,
    window_secs: u64,
) -> tower::util::MapRequestLayer<impl Fn(Request<Body>) -> Request<Body> + Clone> {
    let limiter = UserRateLimiter::new(max_requests, window_secs);
    limiter.inner.spawn_gc();
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

    #[test]
    fn test_rate_limiter_high_limit() {
        let limiter = RateLimiter::new(100, 60);
        for i in 0..100 {
            assert!(
                limiter.check_and_record("192.168.1.1").is_ok(),
                "Request {} should be allowed under limit 100",
                i + 1
            );
        }
        assert!(
            limiter.check_and_record("192.168.1.1").is_err(),
            "Request 101 should be blocked"
        );
    }

    #[test]
    fn test_rate_limiter_clone_shares_state() {
        let limiter = RateLimiter::new(2, 60);
        let cloned = limiter.clone();

        assert!(limiter.check_and_record("8.8.8.8").is_ok());
        assert!(cloned.check_and_record("8.8.8.8").is_ok());
        // Both clones share state, so the 3rd request should be blocked
        assert!(limiter.check_and_record("8.8.8.8").is_err());
    }

    #[test]
    fn test_rate_limiter_retry_after_is_reasonable() {
        let limiter = RateLimiter::new(1, 120);
        assert!(limiter.check_and_record("10.0.0.1").is_ok());

        let result = limiter.check_and_record("10.0.0.1");
        assert!(result.is_err());
        let retry_after = result.expect_err("should be rate limited");
        // retry_after should be between 1 and window_secs + 1
        assert!(
            (1..=121).contains(&retry_after),
            "Retry-After {} should be between 1 and 121",
            retry_after
        );
    }

    #[test]
    fn test_extract_ip_forwarded_for_first_entry() {
        let req = Request::builder()
            .header("X-Forwarded-For", "real-client.ip, proxy.ip, nginx.ip")
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip(&req);
        // Should take the FIRST IP (the original client behind single-hop nginx)
        assert_eq!(ip, "real-client.ip");
    }

    #[test]
    fn test_extract_ip_forwarded_for_single_ip() {
        let req = Request::builder()
            .header("X-Forwarded-For", "1.2.3.4")
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip(&req);
        assert_eq!(ip, "1.2.3.4");
    }

    #[test]
    fn test_extract_ip_no_headers_no_connect_info() {
        let req = Request::builder()
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip(&req);
        assert_eq!(ip, "unknown");
    }

    #[test]
    fn test_rate_limit_layer_creates_valid_layer() {
        // Verify the layer can be constructed without panicking
        let _layer = rate_limit_layer(10, 60);
    }

    // --- Per-user rate limiting tests ---

    #[test]
    fn test_user_rate_limiter_tracks_by_user_id() {
        let limiter = UserRateLimiter::new(2, 60);
        let user_a = "user:aaaa-bbbb";
        let user_b = "user:cccc-dddd";

        assert!(limiter.inner.check_and_record(user_a).is_ok());
        assert!(limiter.inner.check_and_record(user_a).is_ok());
        assert!(
            limiter.inner.check_and_record(user_a).is_err(),
            "User A should be blocked after 2 requests"
        );

        // User B should have independent counter
        assert!(
            limiter.inner.check_and_record(user_b).is_ok(),
            "User B should still be allowed"
        );
    }

    #[test]
    fn test_user_rate_limit_layer_creates_valid_layer() {
        let _layer = user_rate_limit_layer(100, 60);
    }
}
