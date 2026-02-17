use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use uuid::Uuid;

use taskflow_auth::jwt::verify_access_token;

use crate::errors::AppError;
use crate::state::AppState;

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct WsParams {
    token: String,
}

#[derive(Deserialize)]
#[serde(tag = "action")]
#[allow(dead_code)]
enum WsClientMessage {
    #[serde(rename = "subscribe")]
    Subscribe { channel: String },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { channel: String },
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// GET /api/ws?token=<jwt>
///
/// WebSocket endpoint. JWT auth is done via query parameter because
/// WebSocket connections cannot use Authorization headers from the browser.
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(params): Query<WsParams>,
) -> Result<Response, AppError> {
    let claims = verify_access_token(&params.token, &state.config.jwt_secret)?;
    let user_id = claims.sub;

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, user_id)))
}

async fn handle_socket(socket: WebSocket, state: AppState, _user_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    // Track active board subscriptions: channel -> broadcast receiver task handle
    let mut subscription_handles: std::collections::HashMap<String, tokio::task::JoinHandle<()>> =
        std::collections::HashMap::new();

    // Channel to forward broadcast messages to the WebSocket sender
    let (ws_tx, mut ws_rx) = tokio::sync::mpsc::channel::<String>(256);

    // Spawn a task that forwards messages from the mpsc channel to the WebSocket
    let forward_handle = tokio::spawn(async move {
        while let Some(msg) = ws_rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Process incoming WebSocket messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                let text_str: &str = &text;
                if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(text_str) {
                    match client_msg {
                        WsClientMessage::Subscribe { channel } => {
                            // Parse channel format: "board:<uuid>"
                            if let Some(board_id_str) = channel.strip_prefix("board:") {
                                if let Ok(board_id) = board_id_str.parse::<Uuid>() {
                                    // Skip if already subscribed
                                    if subscription_handles.contains_key(&channel) {
                                        continue;
                                    }

                                    let tx = state.get_board_channel(board_id);
                                    let mut rx = tx.subscribe();
                                    let ws_tx_clone = ws_tx.clone();

                                    let handle = tokio::spawn(async move {
                                        while let Ok(msg) = rx.recv().await {
                                            if ws_tx_clone.send(msg).await.is_err() {
                                                break;
                                            }
                                        }
                                    });

                                    subscription_handles.insert(channel, handle);
                                }
                            }
                        }
                        WsClientMessage::Unsubscribe { channel } => {
                            if let Some(handle) = subscription_handles.remove(&channel) {
                                handle.abort();
                            }
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // Clean up
    for (_channel, handle) in subscription_handles {
        handle.abort();
    }
    forward_handle.abort();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn ws_routes() -> Router<AppState> {
    Router::new().route("/api/ws", get(ws_handler))
}
