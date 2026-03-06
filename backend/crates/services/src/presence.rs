use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum PresenceError {
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskLockInfo {
    pub user_id: Uuid,
    pub user_name: String,
}

/// Service for managing user presence on projects and task-level locks via Redis.
#[derive(Clone)]
pub struct PresenceService {
    redis: redis::aio::ConnectionManager,
}

impl PresenceService {
    pub fn new(redis: redis::aio::ConnectionManager) -> Self {
        Self { redis }
    }

    fn project_key(project_id: Uuid) -> String {
        format!("presence:project:{}", project_id)
    }

    fn lock_key(task_id: Uuid) -> String {
        format!("lock:task:{}", task_id)
    }

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// Register a user as viewing a project.
    pub async fn join_project(&self, project_id: Uuid, user_id: Uuid) -> Result<(), PresenceError> {
        let mut conn = self.redis.clone();
        let key = Self::project_key(project_id);
        let ts = Self::now_secs().to_string();
        conn.hset::<_, _, _, ()>(&key, user_id.to_string(), &ts)
            .await?;
        // Expire the whole hash after 5 min as a safety net
        conn.expire::<_, ()>(&key, 300).await?;
        Ok(())
    }

    /// Remove a user from a project's viewer list.
    pub async fn leave_project(
        &self,
        project_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), PresenceError> {
        let mut conn = self.redis.clone();
        let key = Self::project_key(project_id);
        conn.hdel::<_, _, ()>(&key, user_id.to_string()).await?;
        Ok(())
    }

    /// Refresh a user's heartbeat. Also cleans stale entries (>30s).
    pub async fn heartbeat(
        &self,
        project_id: Uuid,
        user_id: Uuid,
    ) -> Result<Vec<Uuid>, PresenceError> {
        let mut conn = self.redis.clone();
        let key = Self::project_key(project_id);
        let ts = Self::now_secs();
        let ts_str = ts.to_string();
        conn.hset::<_, _, _, ()>(&key, user_id.to_string(), &ts_str)
            .await?;
        conn.expire::<_, ()>(&key, 300).await?;

        // Get all entries and clean stale ones
        let entries: Vec<(String, String)> = conn.hgetall(&key).await?;
        let cutoff = ts.saturating_sub(30);
        let mut active: Vec<Uuid> = Vec::new();
        let mut stale: Vec<String> = Vec::new();

        for (uid_str, ts_val) in &entries {
            let entry_ts: u64 = ts_val.parse().unwrap_or(0);
            if entry_ts >= cutoff {
                if let Ok(uid) = Uuid::parse_str(uid_str) {
                    active.push(uid);
                }
            } else {
                stale.push(uid_str.clone());
            }
        }

        // Remove stale entries
        for s in stale {
            conn.hdel::<_, _, ()>(&key, &s).await?;
        }

        Ok(active)
    }

    /// Get current viewers of a project (cleaning stale entries).
    pub async fn get_project_viewers(&self, project_id: Uuid) -> Result<Vec<Uuid>, PresenceError> {
        let mut conn = self.redis.clone();
        let key = Self::project_key(project_id);
        let entries: Vec<(String, String)> = conn.hgetall(&key).await?;
        let cutoff = Self::now_secs().saturating_sub(30);
        let mut active: Vec<Uuid> = Vec::new();

        for (uid_str, ts_val) in &entries {
            let entry_ts: u64 = ts_val.parse().unwrap_or(0);
            if entry_ts >= cutoff {
                if let Ok(uid) = Uuid::parse_str(uid_str) {
                    active.push(uid);
                }
            }
        }

        Ok(active)
    }

    /// Acquire a task-level editing lock (SET NX EX 300).
    /// Returns Ok(true) if lock acquired, Ok(false) if already locked by another user.
    pub async fn lock_task(
        &self,
        task_id: Uuid,
        user_id: Uuid,
        user_name: &str,
    ) -> Result<bool, PresenceError> {
        let mut conn = self.redis.clone();
        let key = Self::lock_key(task_id);
        let info = TaskLockInfo {
            user_id,
            user_name: user_name.to_string(),
        };
        let value = serde_json::to_string(&info)?;

        // SET key value NX EX 300
        let result: Option<String> = redis::cmd("SET")
            .arg(&key)
            .arg(&value)
            .arg("NX")
            .arg("EX")
            .arg(300)
            .query_async(&mut conn)
            .await?;

        Ok(result.is_some())
    }

    /// Release a task lock (only if owned by the given user).
    pub async fn unlock_task(&self, task_id: Uuid, user_id: Uuid) -> Result<(), PresenceError> {
        let mut conn = self.redis.clone();
        let key = Self::lock_key(task_id);

        // Only delete if we own the lock
        let current: Option<String> = conn.get(&key).await?;
        if let Some(val) = current {
            if let Ok(info) = serde_json::from_str::<TaskLockInfo>(&val) {
                if info.user_id == user_id {
                    conn.del::<_, ()>(&key).await?;
                }
            }
        }

        Ok(())
    }

    /// Get who holds the lock on a task (if anyone).
    pub async fn get_task_lock(
        &self,
        task_id: Uuid,
    ) -> Result<Option<TaskLockInfo>, PresenceError> {
        let mut conn = self.redis.clone();
        let key = Self::lock_key(task_id);
        let val: Option<String> = conn.get(&key).await?;
        match val {
            Some(v) => Ok(serde_json::from_str(&v)?),
            None => Ok(None),
        }
    }

    /// Remove all locks held by a user (for cleanup on disconnect).
    /// We store a secondary index: `user_locks:{user_id}` → set of task_ids.
    pub async fn cleanup_user_locks(&self, user_id: Uuid) -> Result<(), PresenceError> {
        let mut conn = self.redis.clone();
        let index_key = format!("user_locks:{}", user_id);
        let task_ids: Vec<String> = conn.smembers(&index_key).await.unwrap_or_default();

        for tid_str in &task_ids {
            if let Ok(tid) = Uuid::parse_str(tid_str) {
                self.unlock_task(tid, user_id).await?;
            }
        }

        conn.del::<_, ()>(&index_key).await?;
        Ok(())
    }

    /// Track a lock in the user's lock index.
    pub async fn track_user_lock(&self, user_id: Uuid, task_id: Uuid) -> Result<(), PresenceError> {
        let mut conn = self.redis.clone();
        let key = format!("user_locks:{}", user_id);
        conn.sadd::<_, _, ()>(&key, task_id.to_string()).await?;
        conn.expire::<_, ()>(&key, 300).await?;
        Ok(())
    }

    /// Remove a lock from the user's lock index.
    pub async fn untrack_user_lock(
        &self,
        user_id: Uuid,
        task_id: Uuid,
    ) -> Result<(), PresenceError> {
        let mut conn = self.redis.clone();
        let key = format!("user_locks:{}", user_id);
        conn.srem::<_, _, ()>(&key, task_id.to_string()).await?;
        Ok(())
    }
}
