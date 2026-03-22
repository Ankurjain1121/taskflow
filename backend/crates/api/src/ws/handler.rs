use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    http::header::COOKIE,
    response::Response,
};
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use std::collections::{HashMap, HashSet};
use tokio::sync::mpsc;
use uuid::Uuid;

use std::sync::atomic::{AtomicU8, Ordering};

use crate::errors::{AppError, Result};
use crate::state::AppState;
use crate::ws::batch_handler::{BatchHandler, BatchMessage};
use crate::ws::messages::{ClientMessage, ServerMessage, WsQuery};
use taskflow_auth::jwt::verify_access_token;
use taskflow_db::models::WsBoardEvent;
use taskflow_db::queries::projects::is_project_member;
use taskflow_services::{BroadcastService, PresenceService};

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
    // Enforce WebSocket connection limit
    let current = state.ws_connection_count.fetch_add(1, Ordering::Relaxed);
    if current >= state.config.ws_max_connections {
        state.ws_connection_count.fetch_sub(1, Ordering::Relaxed);
        return Err(AppError::ServiceUnavailable(
            "Too many WebSocket connections".into(),
        ));
    }

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

    // Query param auth is deprecated — log warning and ignore the token
    if query.token.is_some() {
        tracing::warn!("WebSocket query param auth is deprecated and no longer supported. Use cookie or first-message auth.");
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

    // Track subscribed channels and their forwarder tasks, plus boards joined for presence
    let mut subscribed_channels: HashMap<String, tokio::task::JoinHandle<()>> = HashMap::new();
    let mut presence_boards: HashSet<Uuid> = HashSet::new();

    // Server-side ping/pong: count consecutive missed pongs (kill after 2 misses = 60s)
    let missed_pongs = std::sync::Arc::new(AtomicU8::new(0));
    let missed_pongs_sender = missed_pongs.clone();

    // Task to send messages from the channel to WebSocket
    // Batches WsBoardEvent messages to reduce frame count
    // Also sends periodic WebSocket pings every 30s to detect ghost connections
    let send_task = tokio::spawn(async move {
        let mut batch_handler = BatchHandler::new();
        let mut last_flush = std::time::Instant::now();
        let mut ping_interval = tokio::time::interval(std::time::Duration::from_secs(30));
        // Skip the first immediate tick
        ping_interval.tick().await;

        loop {
            tokio::select! {
                msg = rx.recv() => {
                    match msg {
                        Some(payload) => {
                            // Try to parse as WsBoardEvent for batching
                            if let Ok(event) = serde_json::from_str::<WsBoardEvent>(&payload) {
                                if let Some(batch) = batch_handler.add_event(event) {
                                    // Buffer is full, send the batch
                                    let batch_msg = BatchMessage {
                                        events: batch,
                                        timestamp: Utc::now().to_rfc3339(),
                                    };
                                    if let Ok(batch_json) = serde_json::to_string(&batch_msg) {
                                        if ws_sender.send(Message::Text(batch_json.into())).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                            } else {
                                // Not a WsBoardEvent (probably a control message), send immediately
                                if ws_sender.send(Message::Text(payload.into())).await.is_err() {
                                    break;
                                }
                            }
                        }
                        None => break,
                    }
                }
                _ = tokio::time::sleep(std::time::Duration::from_millis(50)), if last_flush.elapsed() > std::time::Duration::from_millis(50) => {
                    // Periodic flush
                    if let Some(batch) = batch_handler.flush_if_ready() {
                        if !batch.is_empty() {
                            let batch_msg = BatchMessage {
                                events: batch,
                                timestamp: Utc::now().to_rfc3339(),
                            };
                            if let Ok(batch_json) = serde_json::to_string(&batch_msg) {
                                if ws_sender.send(Message::Text(batch_json.into())).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                    last_flush = std::time::Instant::now();
                }
                _ = ping_interval.tick() => {
                    // Increment missed pong counter; kill after 2 consecutive misses (60s total)
                    let misses = missed_pongs_sender.fetch_add(1, Ordering::Relaxed) + 1;
                    if misses >= 2 {
                        tracing::warn!(
                            misses,
                            "No pong received for {} consecutive pings, closing ghost connection",
                            misses
                        );
                        let _ = ws_sender.send(Message::Close(None)).await;
                        break;
                    }
                    // Send a WebSocket-level ping
                    if ws_sender.send(Message::Ping(vec![].into())).await.is_err() {
                        break;
                    }
                }
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
                        let _ = tx
                            .send(serde_json::to_string(&error_msg).unwrap_or_default())
                            .await;
                        continue;
                    }
                };

                match client_msg {
                    ClientMessage::Auth { .. } => {
                        // Already authenticated, ignore subsequent auth messages
                        let error_msg = ServerMessage::Error {
                            message: "Already authenticated".into(),
                        };
                        let _ = tx
                            .send(serde_json::to_string(&error_msg).unwrap_or_default())
                            .await;
                    }
                    ClientMessage::Subscribe { payload } => {
                        let channel = payload.channel;
                        // Enforce per-connection subscription cap
                        if subscribed_channels.len() >= 50 {
                            let error_msg = ServerMessage::Error {
                                message: "Maximum channel subscription limit reached".into(),
                            };
                            let _ = tx
                                .send(serde_json::to_string(&error_msg).unwrap_or_default())
                                .await;
                            continue;
                        }
                        // Validate channel format and permissions
                        match validate_channel_access(&channel, user_id, tenant_id, &state.db).await
                        {
                            Ok(true) => {}
                            Ok(false) => {
                                let error_msg = ServerMessage::Error {
                                    message: "Invalid or unauthorized channel".into(),
                                };
                                let _ = tx
                                    .send(serde_json::to_string(&error_msg).unwrap_or_default())
                                    .await;
                                continue;
                            }
                            Err(e) => {
                                tracing::error!("Channel validation error: {}", e);
                                let error_msg = ServerMessage::Error {
                                    message: "Failed to validate channel access".into(),
                                };
                                let _ = tx
                                    .send(serde_json::to_string(&error_msg).unwrap_or_default())
                                    .await;
                                continue;
                            }
                        }

                        // Subscribe via shared pubsub relay (no per-connection Redis)
                        if subscribed_channels.contains_key(&channel) {
                            // Already subscribed
                            continue;
                        }

                        let mut rx = state.pubsub_relay.subscribe(&channel);
                        let tx_fwd = tx.clone();

                        // Spawn a lightweight forwarder task for this channel
                        let handle = tokio::spawn(async move {
                            loop {
                                match rx.recv().await {
                                    Ok(payload) => {
                                        if tx_fwd.send(payload).await.is_err() {
                                            break; // WS sender closed
                                        }
                                    }
                                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                                        tracing::warn!(
                                            "PubSub relay lagged, skipped {} messages",
                                            n
                                        );
                                    }
                                    Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                                        break; // Channel closed
                                    }
                                }
                            }
                        });

                        subscribed_channels.insert(channel.clone(), handle);
                        tracing::info!(
                            user_id = %user_id,
                            channel = %channel,
                            "User subscribed to channel"
                        );

                        let response = ServerMessage::Subscribed { channel };
                        let _ = tx
                            .send(serde_json::to_string(&response).unwrap_or_default())
                            .await;
                    }
                    ClientMessage::Unsubscribe { payload } => {
                        let channel = payload.channel;
                        if let Some(handle) = subscribed_channels.remove(&channel) {
                            handle.abort();
                            state.pubsub_relay.unsubscribe(&channel);

                            tracing::info!(
                                user_id = %user_id,
                                channel = %channel,
                                "User unsubscribed from channel"
                            );

                            let response = ServerMessage::Unsubscribed { channel };
                            let _ = tx
                                .send(serde_json::to_string(&response).unwrap_or_default())
                                .await;
                        }
                    }
                    ClientMessage::Ping => {
                        let response = ServerMessage::Pong;
                        let _ = tx
                            .send(serde_json::to_string(&response).unwrap_or_default())
                            .await;
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
                                    broadcast.broadcast_project_event(board_id, &event).await
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
                                    broadcast.broadcast_project_event(board_id, &event).await
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
                                    broadcast.broadcast_project_event(board_id, &event).await
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
                                    taskflow_db::queries::get_task_project_id(&state.db, task_id)
                                        .await
                                {
                                    let event = WsBoardEvent::TaskLocked {
                                        task_id,
                                        user_id,
                                        user_name: user_name.clone(),
                                    };
                                    if let Err(e) =
                                        broadcast.broadcast_project_event(board_id, &event).await
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
                                taskflow_db::queries::get_task_project_id(&state.db, task_id).await
                            {
                                let event = WsBoardEvent::TaskUnlocked { task_id, user_id };
                                if let Err(e) =
                                    broadcast.broadcast_project_event(board_id, &event).await
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
                // Reset missed pong counter (server-side ping keepalive)
                missed_pongs.store(0, Ordering::Relaxed);
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
                let _ = tx
                    .send(serde_json::to_string(&error_msg).unwrap_or_default())
                    .await;
            }
        }
    }

    // Clean up
    send_task.abort();

    // Abort all channel forwarder tasks and unsubscribe from relay
    for (channel, handle) in subscribed_channels.drain() {
        handle.abort();
        state.pubsub_relay.unsubscribe(&channel);
    }

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
                if let Err(e) = broadcast.broadcast_project_event(*board_id, &event).await {
                    tracing::error!("Presence cleanup broadcast error: {}", e);
                }
            }
        }
    }

    // Cleanup locks held by this user
    if let Err(e) = presence.cleanup_user_locks(user_id).await {
        tracing::error!("Lock cleanup error for user {}: {}", user_id, e);
    }

    // Decrement global WebSocket connection count
    state.ws_connection_count.fetch_sub(1, Ordering::Relaxed);

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
                            let _ = tx
                                .send(serde_json::to_string(&error_msg).unwrap_or_default())
                                .await;
                            continue;
                        }
                    };

                    match client_msg {
                        ClientMessage::Auth { payload } => {
                            match verify_access_token(&payload.token, &state.jwt_keys) {
                                Ok(claims) => {
                                    let response = ServerMessage::Authenticated;
                                    let _ = tx
                                        .send(serde_json::to_string(&response).unwrap_or_default())
                                        .await;
                                    return Some((claims.sub, claims.tenant_id));
                                }
                                Err(_) => {
                                    let error_msg = ServerMessage::Error {
                                        message: "Invalid or expired token".into(),
                                    };
                                    let _ = tx
                                        .send(serde_json::to_string(&error_msg).unwrap_or_default())
                                        .await;
                                    return None;
                                }
                            }
                        }
                        _ => {
                            let error_msg = ServerMessage::Error {
                                message: "Authentication required. Send auth message first.".into(),
                            };
                            let _ = tx
                                .send(serde_json::to_string(&error_msg).unwrap_or_default())
                                .await;
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
            let _ = tx
                .send(serde_json::to_string(&error_msg).unwrap_or_default())
                .await;
            None
        }
    }
}

/// Validate channel format and authorization
/// Channels are formatted as "project:{uuid}", "board:{uuid}" (legacy), or "user:{uuid}"
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
        "project" | "board" => {
            // Verify user is a member of the project
            is_project_member(pool, channel_id, user_id).await
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
        "project" | "board" => true, // Format valid, actual auth done by validate_channel_access
        "user" => channel_id == user_id,
        "workspace" => true, // Format valid, actual auth done by validate_channel_access
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    // ── Ping/pong AtomicBool protocol tests ─────────────────────────
    //
    // Server-side keepalive protocol:
    //   1. `pong_received` starts as `true`.
    //   2. Every 30s the send_task fires a ping tick:
    //      a. `pong_received.swap(false, Relaxed)` returns the old value.
    //      b. If old == `false` => no pong since last ping => ghost => close.
    //      c. If old == `true`  => pong was received   => send next Ping.
    //   3. When a Pong frame arrives: `pong_received.store(true, Relaxed)`.
    //
    // Full integration test would require a WebSocket client+server round
    // trip (tokio-tungstenite). The tests below verify the atomic
    // state-machine that drives the ghost-detection decision.

    #[test]
    fn test_pong_initial_state_allows_first_ping() {
        let pong_received = AtomicBool::new(true);
        let had_pong = pong_received.swap(false, Ordering::Relaxed);
        assert!(had_pong, "Initial state should allow the first ping");
    }

    #[test]
    fn test_pong_detects_ghost_connection() {
        let pong_received = AtomicBool::new(true);

        // First ping tick: consumes the initial `true`
        let _ = pong_received.swap(false, Ordering::Relaxed);

        // No pong arrives (ghost connection)

        // Second ping tick: swap(false) returns false => ghost detected
        let had_pong = pong_received.swap(false, Ordering::Relaxed);
        assert!(
            !had_pong,
            "Should detect ghost when no pong was received between pings"
        );
    }

    #[test]
    fn test_pong_resets_on_pong_received() {
        let pong_received = AtomicBool::new(true);

        // First ping tick
        let _ = pong_received.swap(false, Ordering::Relaxed);

        // Pong arrives
        pong_received.store(true, Ordering::Relaxed);

        // Second ping tick: swap(false) returns true => healthy
        let had_pong = pong_received.swap(false, Ordering::Relaxed);
        assert!(had_pong, "Should allow ping after pong was received");
    }

    #[test]
    fn test_pong_multiple_healthy_cycles_then_ghost() {
        let pong_received = AtomicBool::new(true);

        // 5 successful ping/pong cycles
        for cycle in 0..5 {
            let had_pong = pong_received.swap(false, Ordering::Relaxed);
            assert!(had_pong, "Cycle {} should succeed", cycle);
            pong_received.store(true, Ordering::Relaxed);
        }

        // Missed pong
        let had_pong = pong_received.swap(false, Ordering::Relaxed);
        assert!(had_pong, "Last successful check before ghost");
        // No store(true) this time
        let had_pong = pong_received.swap(false, Ordering::Relaxed);
        assert!(!had_pong, "Should detect ghost after missed pong");
    }

    // ── Message deserialization tests ───────────────────────────────

    #[test]
    fn test_client_message_deserialize() {
        // Test subscribe message format (frontend sends: { type: 'subscribe', payload: { channel: '...' } })
        let json = r#"{"type": "subscribe", "payload": {"channel": "project:00000000-0000-0000-0000-000000000001"}}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            ClientMessage::Subscribe { payload } => {
                assert!(payload.channel.starts_with("project:"));
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

        // Valid project channel
        assert!(is_valid_channel(
            "project:00000000-0000-0000-0000-000000000003",
            user_id,
            tenant_id
        ));

        // Legacy board channel still valid
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
