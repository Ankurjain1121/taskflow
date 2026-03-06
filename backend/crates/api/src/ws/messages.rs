use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Query parameters for WebSocket connection (token is now optional - can be sent via first message)
#[derive(Debug, Deserialize, Default)]
pub struct WsQuery {
    pub token: Option<String>,
}

/// Client message format
/// Frontend sends: { type: 'subscribe', payload: { channel: 'project:123' } }
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    Auth { payload: AuthPayload },
    Subscribe { payload: ChannelPayload },
    Unsubscribe { payload: ChannelPayload },
    Ping,
    PresenceJoin { payload: PresencePayload },
    PresenceLeave { payload: PresencePayload },
    Heartbeat { payload: PresencePayload },
    LockTask { payload: TaskIdPayload },
    UnlockTask { payload: TaskIdPayload },
}

/// Payload for auth message
#[derive(Debug, Deserialize)]
pub struct AuthPayload {
    pub token: String,
}

/// Payload for subscribe/unsubscribe messages
#[derive(Debug, Deserialize)]
pub struct ChannelPayload {
    pub channel: String,
}

/// Payload for presence messages (join/leave/heartbeat a project)
#[derive(Debug, Deserialize)]
pub struct PresencePayload {
    pub project_id: Uuid,
}

/// Payload for task lock/unlock messages
#[derive(Debug, Deserialize)]
pub struct TaskIdPayload {
    pub task_id: Uuid,
}

/// Server message format
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    Authenticated,
    Subscribed {
        channel: String,
    },
    Unsubscribed {
        channel: String,
    },
    Error {
        message: String,
    },
    Pong,
    #[serde(untagged)]
    Data(serde_json::Value),
}
