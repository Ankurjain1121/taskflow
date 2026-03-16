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

    /// Broadcast an update to all subscribers of a project channel
    ///
    /// # Arguments
    /// * `project_id` - The project's UUID
    /// * `event` - Event name (e.g., "task:created", "task:updated", "task:moved", "task:deleted")
    /// * `data` - JSON data to broadcast
    pub async fn broadcast_project_update(
        &self,
        project_id: Uuid,
        event: &str,
        data: Value,
    ) -> Result<(), BroadcastError> {
        let channel = format!("project:{}", project_id);
        let message = json!({
            "event": event,
            "data": data
        });

        let message_str = serde_json::to_string(&message)?;

        tracing::debug!(
            channel = %channel,
            event = %event,
            "Broadcasting project update"
        );

        let mut conn = self.redis.clone();
        conn.publish::<_, _, ()>(&channel, &message_str).await?;

        Ok(())
    }

    /// Alias for backward compat
    pub async fn broadcast_board_update(
        &self,
        board_id: Uuid,
        event: &str,
        data: Value,
    ) -> Result<(), BroadcastError> {
        self.broadcast_project_update(board_id, event, data).await
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

    /// Broadcast a typed event to a project channel
    pub async fn broadcast_project_event<T: Serialize>(
        &self,
        project_id: Uuid,
        event: &T,
    ) -> Result<(), BroadcastError> {
        let channel = format!("project:{}", project_id);
        let message_str = serde_json::to_string(event)?;

        tracing::debug!(
            channel = %channel,
            "Broadcasting typed project event"
        );

        let mut conn = self.redis.clone();
        conn.publish::<_, _, ()>(&channel, &message_str).await?;

        Ok(())
    }

    /// Alias for backward compat
    pub async fn broadcast_board_event<T: Serialize>(
        &self,
        board_id: Uuid,
        event: &T,
    ) -> Result<(), BroadcastError> {
        self.broadcast_project_event(board_id, event).await
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

    #[test]
    fn test_all_event_constants_colon_separated() {
        let all_events = [
            events::TASK_CREATED,
            events::TASK_UPDATED,
            events::TASK_MOVED,
            events::TASK_DELETED,
            events::TASK_ASSIGNED,
            events::TASK_UNASSIGNED,
            events::COMMENT_CREATED,
            events::COLUMN_CREATED,
            events::COLUMN_UPDATED,
            events::COLUMN_DELETED,
            events::WORKLOAD_CHANGED,
        ];
        for event in all_events {
            assert!(
                event.contains(':'),
                "Event '{}' does not follow 'entity:action' format",
                event
            );
            let parts: Vec<&str> = event.split(':').collect();
            assert_eq!(
                parts.len(),
                2,
                "Event '{}' has unexpected number of segments",
                event
            );
            assert!(!parts[0].is_empty(), "Event '{}' has empty entity", event);
            assert!(!parts[1].is_empty(), "Event '{}' has empty action", event);
        }
    }

    #[test]
    fn test_event_names_complete() {
        assert_eq!(events::TASK_UPDATED, "task:updated");
        assert_eq!(events::TASK_MOVED, "task:moved");
        assert_eq!(events::TASK_ASSIGNED, "task:assigned");
        assert_eq!(events::TASK_UNASSIGNED, "task:unassigned");
        assert_eq!(events::COMMENT_CREATED, "comment:created");
        assert_eq!(events::COLUMN_CREATED, "column:created");
        assert_eq!(events::COLUMN_UPDATED, "column:updated");
        assert_eq!(events::COLUMN_DELETED, "column:deleted");
        assert_eq!(events::WORKLOAD_CHANGED, "workload:changed");
    }

    #[test]
    fn test_broadcast_error_display_serialization() {
        let err = BroadcastError::Serialization(
            serde_json::from_str::<serde_json::Value>("bad json").unwrap_err(),
        );
        let msg = format!("{}", err);
        assert!(msg.contains("Serialization error"), "got: {}", msg);
    }

    #[test]
    fn test_broadcast_error_debug() {
        let err = BroadcastError::Serialization(
            serde_json::from_str::<serde_json::Value>("bad json").unwrap_err(),
        );
        let debug = format!("{:?}", err);
        assert!(debug.contains("Serialization"), "got: {}", debug);
    }

    #[test]
    fn test_channel_format_project() {
        let project_id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let channel = format!("project:{}", project_id);
        assert_eq!(channel, "project:550e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn test_channel_format_user() {
        let user_id = Uuid::parse_str("660e8400-e29b-41d4-a716-446655440000").unwrap();
        let channel = format!("user:{}", user_id);
        assert_eq!(channel, "user:660e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn test_channel_format_workspace() {
        let ws_id = Uuid::parse_str("770e8400-e29b-41d4-a716-446655440000").unwrap();
        let channel = format!("workspace:{}", ws_id);
        assert_eq!(channel, "workspace:770e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn test_broadcast_message_json_structure() {
        let event = "task:created";
        let data = json!({"id": "abc", "title": "Test"});
        let message = json!({
            "event": event,
            "data": data
        });
        let message_str = serde_json::to_string(&message).expect("serialize message");
        let parsed: serde_json::Value = serde_json::from_str(&message_str).expect("parse message");
        assert_eq!(parsed["event"], "task:created");
        assert_eq!(parsed["data"]["id"], "abc");
        assert_eq!(parsed["data"]["title"], "Test");
    }

    #[test]
    fn test_broadcast_message_with_complex_data() {
        let data = json!({
            "task_id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Important Task",
            "column_id": "660e8400-e29b-41d4-a716-446655440000",
            "priority": "high",
            "assignees": ["user1", "user2"],
            "labels": [{"id": "l1", "name": "Bug", "color": "#ff0000"}]
        });
        let message = json!({
            "event": events::TASK_UPDATED,
            "data": data
        });
        let message_str = serde_json::to_string(&message).expect("serialize complex message");
        let parsed: serde_json::Value = serde_json::from_str(&message_str).expect("parse message");
        assert_eq!(parsed["event"], "task:updated");
        assert_eq!(parsed["data"]["priority"], "high");
        assert_eq!(
            parsed["data"]["assignees"].as_array().expect("array").len(),
            2
        );
    }

    #[test]
    fn test_broadcast_message_with_null_data() {
        let message = json!({
            "event": events::TASK_DELETED,
            "data": null
        });
        let message_str = serde_json::to_string(&message).expect("serialize null data message");
        let parsed: serde_json::Value = serde_json::from_str(&message_str).expect("parse message");
        assert_eq!(parsed["event"], "task:deleted");
        assert!(parsed["data"].is_null());
    }

    #[test]
    fn test_broadcast_message_roundtrip_preserves_types() {
        let data = json!({
            "count": 42,
            "active": true,
            "ratio": 1.5,
            "name": "test"
        });
        let message = json!({
            "event": events::TASK_UPDATED,
            "data": data
        });
        let serialized = serde_json::to_string(&message).expect("serialize");
        let parsed: serde_json::Value = serde_json::from_str(&serialized).expect("parse");
        assert!(parsed["data"]["count"].is_number());
        assert!(parsed["data"]["active"].is_boolean());
        assert!(parsed["data"]["ratio"].is_f64());
        assert!(parsed["data"]["name"].is_string());
    }

    #[test]
    fn test_event_names_no_duplicates() {
        let all_events = [
            events::TASK_CREATED,
            events::TASK_UPDATED,
            events::TASK_MOVED,
            events::TASK_DELETED,
            events::TASK_ASSIGNED,
            events::TASK_UNASSIGNED,
            events::COMMENT_CREATED,
            events::COLUMN_CREATED,
            events::COLUMN_UPDATED,
            events::COLUMN_DELETED,
            events::WORKLOAD_CHANGED,
        ];
        let mut seen = std::collections::HashSet::new();
        for event in all_events {
            assert!(
                seen.insert(event),
                "Duplicate event name found: '{}'",
                event
            );
        }
    }

    #[test]
    fn test_broadcast_error_from_redis_error() {
        // Verify the From<redis::RedisError> impl exists and produces the Redis variant
        let redis_err = redis::RedisError::from(std::io::Error::new(
            std::io::ErrorKind::ConnectionRefused,
            "connection refused",
        ));
        let err: BroadcastError = BroadcastError::Redis(redis_err);
        let msg = format!("{}", err);
        assert!(msg.contains("Redis error"), "got: {}", msg);
    }
}
