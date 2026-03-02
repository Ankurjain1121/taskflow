use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    http::header::COOKIE,
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::errors::{AppError, Result};
use crate::state::AppState;
use taskflow_auth::jwt::verify_access_token;
use taskflow_db::models::WsBoardEvent;
use taskflow_db::queries::boards::is_board_member;
use taskflow_services::{BroadcastService, PresenceService};

/// Query parameters for WebSocket connection (token is now optional - can be sent via first message)
#[derive(Debug, Deserialize, Default)]
pub struct WsQuery {
    pub token: Option<String>,
}

/// Client message format
/// Frontend sends: { type: 'subscribe', payload: { channel: 'board:123' } }
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

/// Payload for presence messages (join/leave/heartbeat a board)
#[derive(Debug, Deserialize)]
pub struct PresencePayload {
    pub board_id: Uuid,
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

/// WebSocket upgrade handler
/// GET /api/ws or GET /api/ws?token=<jwt>
///
/// Authentication can be done via:
/// 1. Cookie header (`access_token` cookie) - preferred for browser clients
/// 2. Query param: ?token=<jwt> (legacy, less secure)
/// 3. First message: {"type": "auth", "payload": {"token": "<jwt>"}} (fallback)
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    headers: axum::http::HeaderMap,
    State(state): State<AppState>,
) -> Result<Response> {
    // Try cookie first (browser automatically sends cookies with WS upgrade)
    if let Some(token) = extract_cookie_token(&headers) {
        if let Ok(claims) = verify_access_token(&token, &state.jwt_keys) {
            tracing::info!(
                user_id = %claims.sub,
                "WebSocket connection upgrade requested (token from cookie)"
            );

            return Ok(ws.on_upgrade(move |socket| {
                handle_socket(socket, state, Some((claims.sub, claims.tenant_id)))
            }));
        }
    }

    // If token provided in query param, validate immediately (legacy method)
    if let Some(token) = &query.token {
        let claims = verify_access_token(token, &state.jwt_keys)
            .map_err(|_| AppError::Unauthorized("Invalid or expired token".into()))?;

        tracing::info!(
            user_id = %claims.sub,
            "WebSocket connection upgrade requested (token in query)"
        );

        return Ok(ws.on_upgrade(move |socket| {
            handle_socket(socket, state, Some((claims.sub, claims.tenant_id)))
        }));
    }

    // No token in cookie or query - will authenticate via first message
    tracing::info!("WebSocket connection upgrade requested (pending auth via message)");
    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, None)))
}

/// Extract the `access_token` cookie value from the Cookie header.
fn extract_cookie_token(headers: &axum::http::HeaderMap) -> Option<String> {
    let cookie_header = headers.get(COOKIE)?.to_str().ok()?;
    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(value) = part.strip_prefix("access_token") {
            let value = value.trim_start();
            if let Some(value) = value.strip_prefix('=') {
                return Some(value.to_string());
            }
        }
    }
    None
}

/// Handle the WebSocket connection
/// `auth_info` is Some if already authenticated via query param, None if needs auth via message
async fn handle_socket(socket: WebSocket, state: AppState, auth_info: Option<(Uuid, Uuid)>) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Channel for sending messages to the WebSocket
    let (tx, mut rx) = mpsc::channel::<String>(100);

    // Authenticate if not already done
    let (user_id, tenant_id) = match auth_info {
        Some(info) => info,
        None => {
            // Wait for auth message as the first message
            match wait_for_auth(&mut ws_receiver, &state, &tx).await {
                Some(info) => info,
                None => {
                    // Auth failed or connection closed, cleanup
                    return;
                }
            }
        }
    };

    tracing::info!(user_id = %user_id, "WebSocket authenticated");

    // Create presence + broadcast services
    let presence = PresenceService::new(state.redis.clone());
    let broadcast = BroadcastService::new(state.redis.clone());

    // Fetch user display_name for lock broadcasts
    let user_name: String = sqlx::query_scalar("SELECT display_name FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| "Unknown".to_string());

    // Track subscribed channels and boards joined for presence
    let mut subscribed_channels: HashSet<String> = HashSet::new();
    let mut presence_boards: HashSet<Uuid> = HashSet::new();

    // Clone redis connection for pub/sub
    let redis_client = match redis::Client::open(state.config.redis_url.as_str()) {
        Ok(client) => client,
        Err(e) => {
            tracing::error!("Failed to create Redis client: {}", e);
            return;
        }
    };

    let pubsub_conn = match redis_client.get_async_pubsub().await {
        Ok(conn) => conn,
        Err(e) => {
            tracing::error!("Failed to get Redis pubsub connection: {}", e);
            return;
        }
    };

    // Wrap pubsub in Arc<Mutex> for shared access
    let pubsub = std::sync::Arc::new(tokio::sync::Mutex::new(pubsub_conn));
    let pubsub_clone = pubsub.clone();

    // Task to forward messages from channel to WebSocket
    let tx_clone = tx.clone();
    let forward_task = tokio::spawn(async move {
        loop {
            // Acquire lock, get next message with timeout, then release lock immediately.
            // The timeout ensures the lock is periodically released so the main loop
            // can subscribe/unsubscribe without deadlocking.
            let msg = {
                let mut guard = pubsub_clone.lock().await;
                let mut stream = guard.on_message();
                let result =
                    tokio::time::timeout(std::time::Duration::from_millis(100), stream.next())
                        .await;
                drop(stream);
                drop(guard);
                match result {
                    Ok(msg) => msg,
                    Err(_) => continue, // Timeout — release lock and retry
                }
            };

            match msg {
                Some(msg) => {
                    let payload: String = match msg.get_payload() {
                        Ok(p) => p,
                        Err(e) => {
                            tracing::error!("Failed to get message payload: {}", e);
                            continue;
                        }
                    };

                    if tx_clone.send(payload).await.is_err() {
                        break;
                    }
                }
                None => {
                    // Connection closed
                    break;
                }
            }
        }
    });

    // Task to send messages from the channel to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Main loop to handle incoming WebSocket messages
    while let Some(result) = ws_receiver.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                let client_msg: ClientMessage = match serde_json::from_str(&text) {
                    Ok(m) => m,
                    Err(e) => {
                        let error_msg = ServerMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                        continue;
                    }
                };

                match client_msg {
                    ClientMessage::Auth { .. } => {
                        // Already authenticated, ignore subsequent auth messages
                        let error_msg = ServerMessage::Error {
                            message: "Already authenticated".into(),
                        };
                        let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                    }
                    ClientMessage::Subscribe { payload } => {
                        let channel = payload.channel;
                        // Validate channel format and permissions
                        match validate_channel_access(&channel, user_id, tenant_id, &state.db).await
                        {
                            Ok(true) => {}
                            Ok(false) => {
                                let error_msg = ServerMessage::Error {
                                    message: "Invalid or unauthorized channel".into(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                                continue;
                            }
                            Err(e) => {
                                tracing::error!("Channel validation error: {}", e);
                                let error_msg = ServerMessage::Error {
                                    message: "Failed to validate channel access".into(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                                continue;
                            }
                        }

                        // Subscribe to Redis channel
                        {
                            let mut guard = pubsub.lock().await;
                            if let Err(e) = guard.subscribe(&channel).await {
                                tracing::error!(
                                    "Failed to subscribe to channel {}: {}",
                                    channel,
                                    e
                                );
                                let error_msg = ServerMessage::Error {
                                    message: "Failed to subscribe".into(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                                continue;
                            }
                        }

                        subscribed_channels.insert(channel.clone());
                        tracing::info!(
                            user_id = %user_id,
                            channel = %channel,
                            "User subscribed to channel"
                        );

                        let response = ServerMessage::Subscribed { channel };
                        let _ = tx.send(serde_json::to_string(&response).unwrap()).await;
                    }
                    ClientMessage::Unsubscribe { payload } => {
                        let channel = payload.channel;
                        if subscribed_channels.remove(&channel) {
                            let mut guard = pubsub.lock().await;
                            let _ = guard.unsubscribe(&channel).await;

                            tracing::info!(
                                user_id = %user_id,
                                channel = %channel,
                                "User unsubscribed from channel"
                            );

                            let response = ServerMessage::Unsubscribed { channel };
                            let _ = tx.send(serde_json::to_string(&response).unwrap()).await;
                        }
                    }
                    ClientMessage::Ping => {
                        let response = ServerMessage::Pong;
                        let _ = tx.send(serde_json::to_string(&response).unwrap()).await;
                    }
                    ClientMessage::PresenceJoin { payload } => {
                        let board_id = payload.board_id;
                        if let Err(e) = presence.join_board(board_id, user_id).await {
                            tracing::error!("Presence join error: {}", e);
                        } else {
                            presence_boards.insert(board_id);
                            // Broadcast updated viewer list
                            if let Ok(viewers) = presence.get_board_viewers(board_id).await {
                                let event = WsBoardEvent::PresenceUpdate {
                                    board_id,
                                    user_ids: viewers,
                                };
                                if let Err(e) =
                                    broadcast.broadcast_board_event(board_id, &event).await
                                {
                                    tracing::error!("Presence broadcast error: {}", e);
                                }
                            }
                        }
                    }
                    ClientMessage::PresenceLeave { payload } => {
                        let board_id = payload.board_id;
                        if let Err(e) = presence.leave_board(board_id, user_id).await {
                            tracing::error!("Presence leave error: {}", e);
                        } else {
                            presence_boards.remove(&board_id);
                            // Broadcast updated viewer list
                            if let Ok(viewers) = presence.get_board_viewers(board_id).await {
                                let event = WsBoardEvent::PresenceUpdate {
                                    board_id,
                                    user_ids: viewers,
                                };
                                if let Err(e) =
                                    broadcast.broadcast_board_event(board_id, &event).await
                                {
                                    tracing::error!("Presence broadcast error: {}", e);
                                }
                            }
                        }
                    }
                    ClientMessage::Heartbeat { payload } => {
                        let board_id = payload.board_id;
                        match presence.heartbeat(board_id, user_id).await {
                            Ok(active_users) => {
                                let event = WsBoardEvent::PresenceUpdate {
                                    board_id,
                                    user_ids: active_users,
                                };
                                if let Err(e) =
                                    broadcast.broadcast_board_event(board_id, &event).await
                                {
                                    tracing::error!("Heartbeat broadcast error: {}", e);
                                }
                            }
                            Err(e) => {
                                tracing::error!("Heartbeat error: {}", e);
                            }
                        }
                    }
                    ClientMessage::LockTask { payload } => {
                        let task_id = payload.task_id;
                        match presence.lock_task(task_id, user_id, &user_name).await {
                            Ok(true) => {
                                // Track the lock for cleanup
                                if let Err(e) = presence.track_user_lock(user_id, task_id).await {
                                    tracing::error!("Track user lock error: {}", e);
                                }
                                // Broadcast lock acquired to all board channels
                                // We need the task's board_id to broadcast
                                if let Ok(Some(board_id)) =
                                    taskflow_db::queries::get_task_board_id(&state.db, task_id)
                                        .await
                                {
                                    let event = WsBoardEvent::TaskLocked {
                                        task_id,
                                        user_id,
                                        user_name: user_name.clone(),
                                    };
                                    if let Err(e) =
                                        broadcast.broadcast_board_event(board_id, &event).await
                                    {
                                        tracing::error!("Lock broadcast error: {}", e);
                                    }
                                }
                            }
                            Ok(false) => {
                                let error_msg = ServerMessage::Error {
                                    message: "Task is already locked by another user".into(),
                                };
                                let _ = tx
                                    .send(serde_json::to_string(&error_msg).unwrap_or_default())
                                    .await;
                            }
                            Err(e) => {
                                tracing::error!("Lock task error: {}", e);
                            }
                        }
                    }
                    ClientMessage::UnlockTask { payload } => {
                        let task_id = payload.task_id;
                        if let Err(e) = presence.unlock_task(task_id, user_id).await {
                            tracing::error!("Unlock task error: {}", e);
                        } else {
                            if let Err(e) = presence.untrack_user_lock(user_id, task_id).await {
                                tracing::error!("Untrack user lock error: {}", e);
                            }
                            // Broadcast unlock
                            if let Ok(Some(board_id)) =
                                taskflow_db::queries::get_task_board_id(&state.db, task_id).await
                            {
                                let event = WsBoardEvent::TaskUnlocked { task_id, user_id };
                                if let Err(e) =
                                    broadcast.broadcast_board_event(board_id, &event).await
                                {
                                    tracing::error!("Unlock broadcast error: {}", e);
                                }
                            }
                        }
                    }
                }
            }
            Message::Ping(data) => {
                // Axum handles pong automatically
                tracing::trace!("Received ping: {:?}", data);
            }
            Message::Pong(_) => {
                // Ignore pong responses
            }
            Message::Close(_) => {
                tracing::info!(user_id = %user_id, "WebSocket closed by client");
                break;
            }
            Message::Binary(_) => {
                // We don't handle binary messages
                let error_msg = ServerMessage::Error {
                    message: "Binary messages not supported".into(),
                };
                let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
            }
        }
    }

    // Clean up
    forward_task.abort();
    send_task.abort();

    // Cleanup presence: leave all boards this user joined
    for board_id in &presence_boards {
        if let Err(e) = presence.leave_board(*board_id, user_id).await {
            tracing::error!("Presence cleanup error for board {}: {}", board_id, e);
        } else {
            // Broadcast updated viewer list after removal
            if let Ok(viewers) = presence.get_board_viewers(*board_id).await {
                let event = WsBoardEvent::PresenceUpdate {
                    board_id: *board_id,
                    user_ids: viewers,
                };
                if let Err(e) = broadcast.broadcast_board_event(*board_id, &event).await {
                    tracing::error!("Presence cleanup broadcast error: {}", e);
                }
            }
        }
    }

    // Cleanup locks held by this user
    if let Err(e) = presence.cleanup_user_locks(user_id).await {
        tracing::error!("Lock cleanup error for user {}: {}", user_id, e);
    }

    // Unsubscribe from all channels
    {
        let mut guard = pubsub.lock().await;
        for channel in subscribed_channels {
            let _ = guard.unsubscribe(&channel).await;
        }
    }

    tracing::info!(user_id = %user_id, "WebSocket connection closed");
}

/// Wait for auth message and validate token
/// Returns Some((user_id, tenant_id)) on success, None on failure
async fn wait_for_auth(
    ws_receiver: &mut futures_util::stream::SplitStream<WebSocket>,
    state: &AppState,
    tx: &mpsc::Sender<String>,
) -> Option<(Uuid, Uuid)> {
    // Set a timeout for auth (10 seconds)
    let timeout = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        while let Some(result) = ws_receiver.next().await {
            let msg = match result {
                Ok(msg) => msg,
                Err(e) => {
                    tracing::error!("WebSocket error during auth: {}", e);
                    return None;
                }
            };

            match msg {
                Message::Text(text) => {
                    let client_msg: ClientMessage = match serde_json::from_str(&text) {
                        Ok(m) => m,
                        Err(e) => {
                            let error_msg = ServerMessage::Error {
                                message: format!("Invalid message format: {}", e),
                            };
                            let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                            continue;
                        }
                    };

                    match client_msg {
                        ClientMessage::Auth { payload } => {
                            match verify_access_token(&payload.token, &state.jwt_keys) {
                                Ok(claims) => {
                                    let response = ServerMessage::Authenticated;
                                    let _ =
                                        tx.send(serde_json::to_string(&response).unwrap()).await;
                                    return Some((claims.sub, claims.tenant_id));
                                }
                                Err(_) => {
                                    let error_msg = ServerMessage::Error {
                                        message: "Invalid or expired token".into(),
                                    };
                                    let _ =
                                        tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                                    return None;
                                }
                            }
                        }
                        _ => {
                            let error_msg = ServerMessage::Error {
                                message: "Authentication required. Send auth message first.".into(),
                            };
                            let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
                        }
                    }
                }
                Message::Close(_) => {
                    tracing::info!("WebSocket closed during auth");
                    return None;
                }
                _ => {
                    // Ignore other message types during auth
                }
            }
        }
        None
    });

    match timeout.await {
        Ok(result) => result,
        Err(_) => {
            tracing::warn!("WebSocket auth timeout");
            let error_msg = ServerMessage::Error {
                message: "Authentication timeout".into(),
            };
            let _ = tx.send(serde_json::to_string(&error_msg).unwrap()).await;
            None
        }
    }
}

/// Validate channel format and authorization
/// Channels are formatted as "board:{uuid}" or "user:{uuid}"
async fn validate_channel_access(
    channel: &str,
    user_id: Uuid,
    _tenant_id: Uuid,
    pool: &sqlx::PgPool,
) -> std::result::Result<bool, sqlx::Error> {
    let parts: Vec<&str> = channel.split(':').collect();
    if parts.len() != 2 {
        return Ok(false);
    }

    let channel_type = parts[0];
    let channel_id = match Uuid::parse_str(parts[1]) {
        Ok(id) => id,
        Err(_) => return Ok(false),
    };

    match channel_type {
        "board" => {
            // Verify user is a member of the board
            is_board_member(pool, channel_id, user_id).await
        }
        "user" => {
            // Users can only subscribe to their own channel
            Ok(channel_id == user_id)
        }
        "workspace" => {
            // Verify user is a member of the workspace
            let is_member = sqlx::query_scalar::<_, bool>(
                r#"
                SELECT EXISTS(
                    SELECT 1 FROM workspace_members
                    WHERE workspace_id = $1 AND user_id = $2
                )
                "#,
            )
            .bind(channel_id)
            .bind(user_id)
            .fetch_one(pool)
            .await?;
            Ok(is_member)
        }
        _ => Ok(false),
    }
}

/// Validate channel format only (for testing - does not check database)
#[cfg(test)]
fn is_valid_channel(channel: &str, user_id: Uuid, _tenant_id: Uuid) -> bool {
    let parts: Vec<&str> = channel.split(':').collect();
    if parts.len() != 2 {
        return false;
    }

    let channel_type = parts[0];
    let channel_id = match Uuid::parse_str(parts[1]) {
        Ok(id) => id,
        Err(_) => return false,
    };

    match channel_type {
        "board" => true, // Format valid, actual auth done by validate_channel_access
        "user" => channel_id == user_id,
        "workspace" => true, // Format valid, actual auth done by validate_channel_access
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_message_deserialize() {
        // Test subscribe message format (frontend sends: { type: 'subscribe', payload: { channel: '...' } })
        let json = r#"{"type": "subscribe", "payload": {"channel": "board:00000000-0000-0000-0000-000000000001"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Subscribe { payload } => {
                assert!(payload.channel.starts_with("board:"));
            }
            _ => panic!("Expected Subscribe message"),
        }

        // Test auth message format
        let auth_json = r#"{"type": "auth", "payload": {"token": "test-token-123"}}"#;
        let auth_msg: ClientMessage = serde_json::from_str(auth_json).unwrap();
        match auth_msg {
            ClientMessage::Auth { payload } => {
                assert_eq!(payload.token, "test-token-123");
            }
            _ => panic!("Expected Auth message"),
        }
    }

    #[test]
    fn test_presence_join_message_deserialize() {
        let json = r#"{"type": "presence_join", "payload": {"board_id": "00000000-0000-0000-0000-000000000001"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::PresenceJoin { payload } => {
                assert_eq!(
                    payload.board_id,
                    Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
                );
            }
            _ => panic!("Expected PresenceJoin message"),
        }
    }

    #[test]
    fn test_heartbeat_message_deserialize() {
        let json = r#"{"type": "heartbeat", "payload": {"board_id": "00000000-0000-0000-0000-000000000001"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Heartbeat { payload } => {
                assert_eq!(
                    payload.board_id,
                    Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
                );
            }
            _ => panic!("Expected Heartbeat message"),
        }
    }

    #[test]
    fn test_lock_task_message_deserialize() {
        let json = r#"{"type": "lock_task", "payload": {"task_id": "00000000-0000-0000-0000-000000000001"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::LockTask { payload } => {
                assert_eq!(
                    payload.task_id,
                    Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
                );
            }
            _ => panic!("Expected LockTask message"),
        }
    }

    #[test]
    fn test_unlock_task_message_deserialize() {
        let json = r#"{"type": "unlock_task", "payload": {"task_id": "00000000-0000-0000-0000-000000000001"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::UnlockTask { payload } => {
                assert_eq!(
                    payload.task_id,
                    Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
                );
            }
            _ => panic!("Expected UnlockTask message"),
        }
    }

    #[test]
    fn test_is_valid_channel() {
        let user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        let tenant_id = Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap();

        // Valid board channel
        assert!(is_valid_channel(
            "board:00000000-0000-0000-0000-000000000003",
            user_id,
            tenant_id
        ));

        // Valid user channel (own channel)
        assert!(is_valid_channel(
            "user:00000000-0000-0000-0000-000000000001",
            user_id,
            tenant_id
        ));

        // Invalid user channel (other user)
        assert!(!is_valid_channel(
            "user:00000000-0000-0000-0000-000000000003",
            user_id,
            tenant_id
        ));

        // Invalid format
        assert!(!is_valid_channel("invalid", user_id, tenant_id));
        assert!(!is_valid_channel("board:", user_id, tenant_id));
    }
}
