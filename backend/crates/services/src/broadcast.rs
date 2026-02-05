use redis::AsyncCommands;
use serde::Serialize;
use serde_json::{json, Value};
use uuid::Uuid;

/// Error type for broadcast operations
#[derive(Debug, thiserror::Error)]
pub enum BroadcastError {
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// Service for broadcasting updates via Redis pub/sub
#[derive(Clone)]
pub struct BroadcastService {
    redis: redis::aio::ConnectionManager,
}

impl BroadcastService {
    /// Create a new broadcast service
    pub fn new(redis: redis::aio::ConnectionManager) -> Self {
        Self { redis }
    }

    /// Broadcast an update to all subscribers of a board channel
    ///
    /// # Arguments
    /// * `board_id` - The board's UUID
    /// * `event` - Event name (e.g., "task:created", "task:updated", "task:moved", "task:deleted")
    /// * `data` - JSON data to broadcast
    pub async fn broadcast_board_update(
        &self,
        board_id: Uuid,
        event: &str,
        data: Value,
    ) -> Result<(), BroadcastError> {
        let channel = format!("board:{}", board_id);
        let message = json!({
            "event": event,
            "data": data
        });

        let message_str = serde_json::to_string(&message)?;

        tracing::debug!(
            channel = %channel,
            event = %event,
            "Broadcasting board update"
        );

        let mut conn = self.redis.clone();
        conn.publish::<_, _, ()>(&channel, &message_str).await?;

        Ok(())
    }

    /// Broadcast an update to a specific user's channel
    ///
    /// # Arguments
    /// * `user_id` - The user's UUID
    /// * `event` - Event name (e.g., "notification:new", "task:assigned")
    /// * `data` - JSON data to broadcast
    pub async fn broadcast_user_update(
        &self,
        user_id: Uuid,
        event: &str,
        data: Value,
    ) -> Result<(), BroadcastError> {
        let channel = format!("user:{}", user_id);
        let message = json!({
            "event": event,
            "data": data
        });

        let message_str = serde_json::to_string(&message)?;

        tracing::debug!(
            channel = %channel,
            event = %event,
            "Broadcasting user update"
        );

        let mut conn = self.redis.clone();
        conn.publish::<_, _, ()>(&channel, &message_str).await?;

        Ok(())
    }

    /// Broadcast a typed event to a board channel
    pub async fn broadcast_board_event<T: Serialize>(
        &self,
        board_id: Uuid,
        event: &T,
    ) -> Result<(), BroadcastError> {
        let channel = format!("board:{}", board_id);
        let message_str = serde_json::to_string(event)?;

        tracing::debug!(
            channel = %channel,
            "Broadcasting typed board event"
        );

        let mut conn = self.redis.clone();
        conn.publish::<_, _, ()>(&channel, &message_str).await?;

        Ok(())
    }

    /// Broadcast an update to all subscribers of a workspace channel
    ///
    /// # Arguments
    /// * `workspace_id` - The workspace's UUID
    /// * `event` - Event name (e.g., "task:updated", "workload:changed")
    /// * `data` - JSON data to broadcast
    pub async fn broadcast_workspace_update(
        &self,
        workspace_id: Uuid,
        event: &str,
        data: Value,
    ) -> Result<(), BroadcastError> {
        let channel = format!("workspace:{}", workspace_id);
        let message = json!({
            "event": event,
            "data": data
        });

        let message_str = serde_json::to_string(&message)?;

        tracing::debug!(
            channel = %channel,
            event = %event,
            "Broadcasting workspace update"
        );

        let mut conn = self.redis.clone();
        conn.publish::<_, _, ()>(&channel, &message_str).await?;

        Ok(())
    }
}

/// Standard event names for task operations
pub mod events {
    pub const TASK_CREATED: &str = "task:created";
    pub const TASK_UPDATED: &str = "task:updated";
    pub const TASK_MOVED: &str = "task:moved";
    pub const TASK_DELETED: &str = "task:deleted";
    pub const TASK_ASSIGNED: &str = "task:assigned";
    pub const TASK_UNASSIGNED: &str = "task:unassigned";
    pub const COMMENT_CREATED: &str = "comment:created";
    pub const COLUMN_CREATED: &str = "column:created";
    pub const COLUMN_UPDATED: &str = "column:updated";
    pub const COLUMN_DELETED: &str = "column:deleted";
    pub const WORKLOAD_CHANGED: &str = "workload:changed";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_names() {
        assert_eq!(events::TASK_CREATED, "task:created");
        assert_eq!(events::TASK_DELETED, "task:deleted");
    }
}
