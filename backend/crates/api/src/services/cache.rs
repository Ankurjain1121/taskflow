//! Redis-based caching service
//!
//! Provides a simple get/set cache with TTL for hot query results.
//! Pattern: check cache -> return if hit -> query DB -> store in cache -> return.

use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};

/// Get a cached value by key. Returns None if not found or on error.
pub async fn cache_get<T: DeserializeOwned>(
    redis: &redis::aio::ConnectionManager,
    key: &str,
) -> Option<T> {
    let mut conn = redis.clone();
    let result: Option<String> = conn.get(key).await.ok()?;
    result.and_then(|s| serde_json::from_str(&s).ok())
}

/// Set a cached value with TTL in seconds.
pub async fn cache_set<T: Serialize>(
    redis: &redis::aio::ConnectionManager,
    key: &str,
    value: &T,
    ttl_secs: u64,
) {
    if let Ok(json) = serde_json::to_string(value) {
        let mut conn = redis.clone();
        let _: Result<(), _> = conn.set_ex(key, json, ttl_secs).await;
    }
}

/// Delete a cached key (for invalidation).
pub async fn cache_del(redis: &redis::aio::ConnectionManager, key: &str) {
    let mut conn = redis.clone();
    let _: Result<(), _> = conn.del(key).await;
}

/// Delete all cached keys matching a pattern (for bulk invalidation).
pub async fn cache_del_pattern(redis: &redis::aio::ConnectionManager, pattern: &str) {
    let mut conn = redis.clone();
    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(pattern)
        .query_async(&mut conn)
        .await
        .unwrap_or_default();

    if !keys.is_empty() {
        let mut conn = redis.clone();
        for key in keys {
            let _: Result<(), _> = conn.del(&key).await;
        }
    }
}

/// Build a cache key for workspace project lists.
pub fn workspace_projects_key(workspace_id: &uuid::Uuid) -> String {
    format!("cache:ws:{}:projects", workspace_id)
}

/// Build a cache key for user preferences.
pub fn user_prefs_key(user_id: &uuid::Uuid) -> String {
    format!("cache:user:{}:prefs", user_id)
}

/// Build a cache key for dashproject stats.
pub fn dashboard_stats_key(user_id: &uuid::Uuid, workspace_id: Option<&uuid::Uuid>) -> String {
    match workspace_id {
        Some(ws_id) => format!("cache:dash:{}:{}", user_id, ws_id),
        None => format!("cache:dash:{}:all", user_id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_key_formats() {
        let uid = uuid::Uuid::nil();
        let wid = uuid::Uuid::nil();
        assert_eq!(
            workspace_projects_key(&wid),
            "cache:ws:00000000-0000-0000-0000-000000000000:projects"
        );
        assert_eq!(
            user_prefs_key(&uid),
            "cache:user:00000000-0000-0000-0000-000000000000:prefs"
        );
        assert_eq!(
            dashboard_stats_key(&uid, Some(&wid)),
            "cache:dash:00000000-0000-0000-0000-000000000000:00000000-0000-0000-0000-000000000000"
        );
        assert_eq!(
            dashboard_stats_key(&uid, None),
            "cache:dash:00000000-0000-0000-0000-000000000000:all"
        );
    }
}
