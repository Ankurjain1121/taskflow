//! IP-based rate limiting middleware
//!
//! Uses Redis INCR + EXPIRE for distributed, fixed-window rate limiting.

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

/// Rate limiter configuration (no in-process state — all state is in Redis)
#[derive(Clone)]
pub struct RateLimiter {
    redis: redis::aio::ConnectionManager,
    max_requests: u32,
    window_secs: u64,
}

impl RateLimiter {
    pub fn new(redis: redis::aio::ConnectionManager, max_requests: u32, window_secs: u64) -> Self {
        Self {
            redis,
            max_requests,
            window_secs,
        }
    }

    /// Check if the IP is allowed using Redis INCR + EXPIRE (fixed window).
    /// Returns Ok(()) if under the limit, or Err(retry_after_secs) if rate limited.
    async fn check_and_record(&self, ip: &str) -> std::result::Result<(), u64> {
        let now_secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let window_ts = now_secs / self.window_secs;
        let key = format!("ratelimit:{}:{}", ip, window_ts);

        let mut conn = self.redis.clone();

        // INCR the counter (creates key with value 1 if it doesn't exist)
        let count: i64 = match redis::cmd("INCR").arg(&key).query_async(&mut conn).await {
            Ok(c) => c,
            Err(e) => {
                // If Redis is down, fail open (allow the request)
                tracing::warn!("Rate limiter Redis INCR failed: {}", e);
                return Ok(());
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
}
