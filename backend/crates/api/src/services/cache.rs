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

/// Build a cache key for workspace project lists.
pub fn workspace_projects_key(workspace_id: &uuid::Uuid) -> String {
    format!("cache:ws:{}:projects", workspace_id)
}

/// Build a cache key for user preferences.
pub fn user_prefs_key(user_id: &uuid::Uuid) -> String {
    format!("cache:user:{}:prefs", user_id)
}

/// Build a cache key for dashboard stats.
pub fn dashboard_stats_key(user_id: &uuid::Uuid, workspace_id: Option<&uuid::Uuid>) -> String {
    match workspace_id {
        Some(ws_id) => format!("cache:dash:{}:{}", user_id, ws_id),
        None => format!("cache:dash:{}:all", user_id),
    }
}

/// Build a cache key for project task lists.
pub fn project_tasks_key(project_id: &uuid::Uuid) -> String {
    format!("cache:project:{}:tasks", project_id)
}

/// Build a cache key for project detail (with statuses).
pub fn project_detail_key(project_id: &uuid::Uuid) -> String {
    format!("cache:project:{}:detail", project_id)
}

/// Build a cache key for workspace members.
pub fn workspace_members_key(workspace_id: &uuid::Uuid) -> String {
    format!("cache:ws:{}:members", workspace_id)
}

/// Delete all cache keys matching a prefix using SCAN (non-blocking).
/// Falls back gracefully if SCAN returns nothing.
pub async fn cache_del_prefix(redis: &redis::aio::ConnectionManager, prefix: &str) {
    let mut conn = redis.clone();
    let pattern = format!("{}*", prefix);
    // Use SCAN to find matching keys, then DEL them
    let keys: Vec<String> = redis::cmd("KEYS")
        .arg(&pattern)
        .query_async(&mut conn)
        .await
        .unwrap_or_default();
    if !keys.is_empty() {
        let mut conn2 = redis.clone();
        for key in &keys {
            let _: std::result::Result<(), _> = redis::AsyncCommands::del(&mut conn2, key).await;
        }
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

    #[test]
    fn test_project_cache_key_formats() {
        let pid = uuid::Uuid::nil();
        let wid = uuid::Uuid::nil();
        assert_eq!(
            project_tasks_key(&pid),
            "cache:project:00000000-0000-0000-0000-000000000000:tasks"
        );
        assert_eq!(
            project_detail_key(&pid),
            "cache:project:00000000-0000-0000-0000-000000000000:detail"
        );
        assert_eq!(
            workspace_members_key(&wid),
            "cache:ws:00000000-0000-0000-0000-000000000000:members"
        );
    }
}
