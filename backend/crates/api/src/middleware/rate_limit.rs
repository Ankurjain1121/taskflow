//! IP-based rate limiting middleware
//!
//! Uses a DashMap to track request counts per IP with a sliding window.

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
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

    /// Check if the IP is allowed; returns true if under the limit.
    fn check_and_record(&self, ip: &str) -> bool {
        let now = Instant::now();
        let window = std::time::Duration::from_secs(self.window_secs);

        let mut entry = self.entries.entry(ip.to_string()).or_insert_with(|| RateEntry {
            timestamps: Vec::new(),
        });

        // Remove timestamps outside the window
        entry.timestamps.retain(|t| now.duration_since(*t) < window);

        if entry.timestamps.len() >= self.max_requests as usize {
            return false;
        }

        entry.timestamps.push(now);
        true
    }
}

/// Extract IP address from request, preferring the actual peer address
fn extract_ip(req: &Request<Body>) -> String {
    // Prefer the actual peer address from the connection (cannot be spoofed)
    if let Some(connect_info) = req.extensions().get::<axum::extract::ConnectInfo<std::net::SocketAddr>>() {
        return connect_info.0.ip().to_string();
    }

    // Fallback to X-Forwarded-For only if peer address not available
    // (e.g., behind a reverse proxy that strips ConnectInfo)
    if let Some(forwarded) = req.headers().get("X-Forwarded-For") {
        if let Ok(s) = forwarded.to_str() {
            return s.split(',').next().unwrap_or(s).trim().to_string();
        }
    }

    if let Some(real_ip) = req.headers().get("X-Real-IP") {
        if let Ok(s) = real_ip.to_str() {
            return s.to_string();
        }
    }

    "unknown".to_string()
}

/// Rate limiting middleware that checks IP-based limits.
/// Attach via `axum::middleware::from_fn`.
pub async fn rate_limit_middleware(
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let limiter = req
        .extensions()
        .get::<RateLimiter>()
        .cloned()
        .ok_or(StatusCode::INTERNAL_SERVER_ERROR)?;

    let ip = extract_ip(&req);

    if !limiter.check_and_record(&ip) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
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
