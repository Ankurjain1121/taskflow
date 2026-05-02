//! IP-based rate limiting middleware
//!
//! Uses Redis INCR + EXPIRE for distributed, fixed-window rate limiting.
//! Falls back to an in-memory DashMap when Redis is unavailable, preventing
//! unlimited brute-force during Redis outages.

use std::sync::Arc;

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use dashmap::DashMap;

/// In-memory fallback counter entry: (count, window_ts).
/// When the window_ts changes, the count resets.
type FallbackEntry = (u64, u64);

/// Rate limiter with Redis primary and in-memory fallback.
#[derive(Clone)]
pub struct RateLimiter {
    redis: redis::aio::ConnectionManager,
    max_requests: u32,
    window_secs: u64,
    /// In-memory fallback counters used when Redis is unreachable.
    fallback: Arc<DashMap<String, FallbackEntry>>,
}

impl RateLimiter {
    pub fn new(redis: redis::aio::ConnectionManager, max_requests: u32, window_secs: u64) -> Self {
        let fallback = Arc::new(DashMap::new());

        // Spawn background cleanup task for stale in-memory fallback entries
        {
            let fallback = fallback.clone();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
                // Skip the first immediate tick
                interval.tick().await;
                loop {
                    interval.tick().await;
                    let now_secs = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();
                    let current_window = now_secs / window_secs;
                    fallback.retain(|_key, (_count, window_ts)| *window_ts >= current_window);
                }
            });
        }

        Self {
            redis,
            max_requests,
            window_secs,
            fallback,
        }
    }

    /// Check if the key is allowed using Redis INCR + EXPIRE (fixed window).
    /// Falls back to in-memory counters when Redis is down.
    /// Returns Ok(()) if under the limit, or Err(retry_after_secs) if rate limited.
    async fn check_and_record(&self, ip: &str) -> std::result::Result<(), u64> {
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let window_ts = now_secs / self.window_secs;
        let key = format!("ratelimit:{}:{}:{}", self.max_requests, ip, window_ts);

        let mut conn = self.redis.clone();

        // INCR the counter (creates key with value 1 if it doesn't exist)
        let count: i64 = match redis::cmd("INCR").arg(&key).query_async(&mut conn).await {
            Ok(c) => c,
            Err(e) => {
                // Redis is down — use in-memory fallback instead of failing open
                tracing::warn!(
                    "Rate limiter Redis INCR failed, using in-memory fallback: {}",
                    e
                );
                return self.check_fallback(ip, window_ts, now_secs);
            }
        };

        // Set expiry only on first increment (count == 1 means new key)
        if count == 1 {
            let _: Result<(), _> = redis::cmd("EXPIRE")
                .arg(&key)
                .arg(self.window_secs + 1) // +1 to avoid edge case at window boundary
                .query_async(&mut conn)
                .await;
        }

        if count > self.max_requests as i64 {
            // Calculate retry-after: time remaining in the current window
            let window_end = (window_ts + 1) * self.window_secs;
            let retry_after = window_end.saturating_sub(now_secs).max(1);
            return Err(retry_after);
        }

        Ok(())
    }

    /// In-memory fallback rate check using DashMap.
    /// Uses the same fixed-window algorithm as the Redis path.
    fn check_fallback(
        &self,
        ip: &str,
        window_ts: u64,
        now_secs: u64,
    ) -> std::result::Result<(), u64> {
        let fallback_key = format!("{}:{}", self.max_requests, ip);

        let count = {
            let mut entry = self.fallback.entry(fallback_key).or_insert((0, window_ts));
            let (ref mut count, ref mut stored_window) = *entry;

            // Reset counter if the window has advanced
            if *stored_window != window_ts {
                *count = 0;
                *stored_window = window_ts;
            }

            *count += 1;
            *count
        };

        if count > self.max_requests as u64 {
            let window_end = (window_ts + 1) * self.window_secs;
            let retry_after = window_end.saturating_sub(now_secs).max(1);
            return Err(retry_after);
        }

        Ok(())
    }

    /// Periodically clean up stale entries from the in-memory fallback map.
    /// Call this from a background task to prevent unbounded memory growth.
    pub fn cleanup_stale_entries(&self) {
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let current_window = now_secs / self.window_secs;

        self.fallback
            .retain(|_key, (_count, window_ts)| *window_ts >= current_window);
    }
}

/// Extract client IP address from request. Trusts `X-Forwarded-For` only when
/// the peer is in `TRUSTED_PROXIES` (defaults to `127.0.0.1,::1`).
fn extract_ip(req: &Request<Body>) -> String {
    let peer_ip = req
        .extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip().to_string());

    if let Some(ip) = super::extract_client_ip(req.headers(), peer_ip.as_deref()) {
        return ip;
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

    if let Err(retry_after) = limiter.check_and_record(&ip).await {
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
/// Usage: `.layer(rate_limit_layer(redis_conn, 5, 60))` for 5 requests per 60 seconds.
pub fn rate_limit_layer(
    redis: redis::aio::ConnectionManager,
    max_requests: u32,
    window_secs: u64,
) -> tower::util::MapRequestLayer<impl Fn(Request<Body>) -> Request<Body> + Clone> {
    let limiter = RateLimiter::new(redis, max_requests, window_secs);
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
    pub fn new(redis: redis::aio::ConnectionManager, max_requests: u32, window_secs: u64) -> Self {
        Self {
            inner: RateLimiter::new(redis, max_requests, window_secs),
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

    if let Err(retry_after) = limiter.inner.check_and_record(&key).await {
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
/// Usage: `.layer(user_rate_limit_layer(redis_conn, 100, 60))` for 100 requests per 60 seconds per user.
pub fn user_rate_limit_layer(
    redis: redis::aio::ConnectionManager,
    max_requests: u32,
    window_secs: u64,
) -> tower::util::MapRequestLayer<impl Fn(Request<Body>) -> Request<Body> + Clone> {
    let limiter = UserRateLimiter::new(redis, max_requests, window_secs);
    tower::util::MapRequestLayer::new(move |mut req: Request<Body>| {
        req.extensions_mut().insert(limiter.clone());
        req
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a test-only struct that mirrors the fallback fields of
    /// `RateLimiter` without needing a Redis connection.
    struct FallbackLimiter {
        max_requests: u32,
        window_secs: u64,
        fallback: Arc<DashMap<String, FallbackEntry>>,
    }

    impl FallbackLimiter {
        fn new(max_requests: u32, window_secs: u64) -> Self {
            Self {
                max_requests,
                window_secs,
                fallback: Arc::new(DashMap::new()),
            }
        }

        /// Mirrors `RateLimiter::check_fallback` exactly.
        fn check_fallback(
            &self,
            ip: &str,
            window_ts: u64,
            now_secs: u64,
        ) -> std::result::Result<(), u64> {
            let fallback_key = format!("{}:{}", self.max_requests, ip);

            let count = {
                let mut entry = self.fallback.entry(fallback_key).or_insert((0, window_ts));
                let (ref mut count, ref mut stored_window) = *entry;

                if *stored_window != window_ts {
                    *count = 0;
                    *stored_window = window_ts;
                }

                *count += 1;
                *count
            };

            if count > self.max_requests as u64 {
                let window_end = (window_ts + 1) * self.window_secs;
                let retry_after = window_end.saturating_sub(now_secs).max(1);
                return Err(retry_after);
            }

            Ok(())
        }

        /// Mirrors `RateLimiter::cleanup_stale_entries`.
        fn cleanup_stale_entries(&self) {
            let now_secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let current_window = now_secs / self.window_secs;

            self.fallback
                .retain(|_key, (_count, window_ts)| *window_ts >= current_window);
        }
    }

    // ── DashMap fallback rate-limiter tests ──────────────────────────

    #[test]
    fn test_fallback_allows_under_limit() {
        let limiter = FallbackLimiter::new(5, 60);
        let window_ts = 100;
        let now_secs = 6000;

        for i in 0..5 {
            let result = limiter.check_fallback("192.168.1.1", window_ts, now_secs);
            assert!(
                result.is_ok(),
                "Request {} should be allowed under the limit",
                i + 1
            );
        }
    }

    #[test]
    fn test_fallback_blocks_over_limit() {
        let max = 3u32;
        let limiter = FallbackLimiter::new(max, 60);
        let window_ts = 200;
        let now_secs = 12_000;

        // First `max` requests succeed
        for _ in 0..max {
            assert!(limiter
                .check_fallback("10.0.0.1", window_ts, now_secs)
                .is_ok());
        }

        // The (max+1)th request should be rate-limited
        let result = limiter.check_fallback("10.0.0.1", window_ts, now_secs);
        assert!(result.is_err(), "Should be rate-limited after max requests");

        // Verify retry_after is reasonable (time remaining in window)
        let retry_after = result.unwrap_err();
        assert!(retry_after >= 1, "retry_after should be at least 1");
    }

    #[test]
    fn test_fallback_resets_on_new_window() {
        let max = 2u32;
        let limiter = FallbackLimiter::new(max, 60);
        let window_ts_1 = 300;
        let now_secs_1 = 18_000;

        // Fill up the limit in window 1
        for _ in 0..max {
            assert!(limiter
                .check_fallback("10.0.0.2", window_ts_1, now_secs_1)
                .is_ok());
        }
        assert!(limiter
            .check_fallback("10.0.0.2", window_ts_1, now_secs_1)
            .is_err());

        // Advance to window 2 — counter should reset
        let window_ts_2 = 301;
        let now_secs_2 = 18_060;
        let result = limiter.check_fallback("10.0.0.2", window_ts_2, now_secs_2);
        assert!(
            result.is_ok(),
            "Counter should reset when the window advances"
        );
    }

    #[test]
    fn test_cleanup_removes_stale_entries() {
        let limiter = FallbackLimiter::new(10, 60);

        // Manually insert a stale entry with an old window_ts
        limiter.fallback.insert("10:old-ip".to_string(), (5, 1)); // window_ts = 1 (ancient)

        // Insert a current entry (current_window = now_secs / 60)
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let current_window = now_secs / 60;
        limiter
            .fallback
            .insert("10:current-ip".to_string(), (3, current_window));

        assert_eq!(limiter.fallback.len(), 2);

        limiter.cleanup_stale_entries();

        // Stale entry should be removed, current entry should remain
        assert_eq!(limiter.fallback.len(), 1);
        assert!(limiter.fallback.contains_key("10:current-ip"));
        assert!(!limiter.fallback.contains_key("10:old-ip"));
    }

    // ── IP extraction tests ─────────────────────────────────────────

    fn req_with_peer(peer: &str) -> axum::http::request::Builder {
        Request::builder().extension(axum::extract::ConnectInfo(std::net::SocketAddr::new(
            peer.parse().expect("peer ip"),
            0,
        )))
    }

    #[test]
    fn test_extract_ip_xff_honored_for_trusted_peer() {
        let req = req_with_peer("127.0.0.1")
            .header("X-Forwarded-For", "203.0.113.50, proxy.ip, nginx.ip")
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip(&req);
        assert_eq!(ip, "203.0.113.50");
    }

    #[test]
    fn test_extract_ip_xff_ignored_for_untrusted_peer() {
        let req = req_with_peer("9.9.9.9")
            .header("X-Forwarded-For", "1.2.3.4")
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip(&req);
        assert_eq!(ip, "9.9.9.9");
    }

    #[test]
    fn test_extract_ip_no_headers_no_connect_info() {
        let req = Request::builder()
            .body(Body::empty())
            .expect("build request");
        let ip = extract_ip(&req);
        assert_eq!(ip, "unknown");
    }
}
