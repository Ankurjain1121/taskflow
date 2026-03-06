use std::sync::Arc;

use dashmap::DashMap;
use futures_util::StreamExt;
use tokio::sync::{broadcast, mpsc};

/// Commands sent from WS handlers to the background pubsub relay task.
enum RelayCmd {
    Subscribe(String),
    Unsubscribe(String),
}

/// Handle for WebSocket handlers to interact with the shared pubsub relay.
///
/// Instead of each WebSocket connection creating its own Redis pubsub connection,
/// all connections share a single Redis pubsub connection managed by a background task.
/// WebSocket handlers subscribe/unsubscribe via this handle and receive messages
/// through tokio broadcast channels.
#[derive(Clone)]
pub struct PubSubRelay {
    cmd_tx: mpsc::UnboundedSender<RelayCmd>,
    channels: Arc<DashMap<String, ChannelState>>,
}

struct ChannelState {
    sender: broadcast::Sender<String>,
    /// Number of active WebSocket subscribers for this channel.
    /// When this reaches 0, we unsubscribe from Redis.
    ref_count: usize,
}

impl PubSubRelay {
    /// Create a new PubSubRelay and spawn the background relay task.
    ///
    /// The background task creates a single Redis pubsub connection and manages
    /// all subscriptions, relaying messages to broadcast channels.
    pub fn spawn(redis_url: &str) -> Self {
        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
        let channels: Arc<DashMap<String, ChannelState>> = Arc::new(DashMap::new());

        let relay = Self {
            cmd_tx,
            channels: channels.clone(),
        };

        let redis_url = redis_url.to_string();
        tokio::spawn(async move {
            run_relay_loop(redis_url, cmd_rx, channels).await;
        });

        relay
    }

    /// Create a dummy relay for testing (no background task).
    #[cfg(test)]
    pub fn dummy() -> Self {
        let (cmd_tx, _cmd_rx) = mpsc::unbounded_channel();
        Self {
            cmd_tx,
            channels: Arc::new(DashMap::new()),
        }
    }

    /// Subscribe to a Redis channel. Returns a broadcast receiver that will
    /// receive all messages published to this channel.
    ///
    /// Multiple WebSocket connections can subscribe to the same channel;
    /// the relay only subscribes once on Redis and ref-counts locally.
    pub fn subscribe(&self, channel: &str) -> broadcast::Receiver<String> {
        let mut entry = self.channels.entry(channel.to_string()).or_insert_with(|| {
            // First subscriber for this channel — tell background task to subscribe on Redis
            let _ = self.cmd_tx.send(RelayCmd::Subscribe(channel.to_string()));
            let (sender, _) = broadcast::channel(256);
            ChannelState {
                sender,
                ref_count: 0,
            }
        });
        entry.ref_count += 1;
        entry.sender.subscribe()
    }

    /// Unsubscribe from a Redis channel. Decrements the ref count and
    /// removes the channel (unsubscribing from Redis) when no subscribers remain.
    pub fn unsubscribe(&self, channel: &str) {
        let should_remove = {
            if let Some(mut entry) = self.channels.get_mut(channel) {
                entry.ref_count = entry.ref_count.saturating_sub(1);
                entry.ref_count == 0
            } else {
                false
            }
        };

        if should_remove {
            self.channels.remove(channel);
            let _ = self.cmd_tx.send(RelayCmd::Unsubscribe(channel.to_string()));
        }
    }
}

/// Background loop that manages a single Redis pubsub connection.
///
/// It processes subscribe/unsubscribe commands from WS handlers and relays
/// incoming Redis pubsub messages to the appropriate broadcast channels.
async fn run_relay_loop(
    redis_url: String,
    mut cmd_rx: mpsc::UnboundedReceiver<RelayCmd>,
    channels: Arc<DashMap<String, ChannelState>>,
) {
    loop {
        match run_relay_once(&redis_url, &mut cmd_rx, &channels).await {
            Ok(()) => {
                // cmd_rx closed — server shutting down
                tracing::info!("PubSub relay shutting down (command channel closed)");
                return;
            }
            Err(e) => {
                tracing::error!("PubSub relay error: {}. Reconnecting in 1s...", e);
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        }
    }
}

/// Run one iteration of the relay. Returns Ok(()) when cmd_rx is closed (shutdown),
/// or Err on Redis errors (caller should reconnect).
async fn run_relay_once(
    redis_url: &str,
    cmd_rx: &mut mpsc::UnboundedReceiver<RelayCmd>,
    channels: &Arc<DashMap<String, ChannelState>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = redis::Client::open(redis_url)?;
    let mut pubsub = client.get_async_pubsub().await?;
    tracing::info!("PubSub relay connected to Redis");

    // Re-subscribe to any channels that were active before reconnect
    let active_channels: Vec<String> = channels.iter().map(|e| e.key().clone()).collect();
    for ch in &active_channels {
        pubsub.subscribe(ch).await?;
        tracing::debug!(channel = %ch, "PubSub relay re-subscribed after reconnect");
    }

    // We need to handle both commands and pubsub messages.
    // Redis pubsub `on_message()` borrows `pubsub` mutably, so we can't also
    // call subscribe/unsubscribe while iterating.
    //
    // Strategy: drain commands in a non-blocking batch, then poll for one
    // pubsub message with a short timeout, repeat.
    //
    // This avoids the lock contention pattern from the old per-connection approach.
    let mut pending_subs: Vec<String> = Vec::new();
    let mut pending_unsubs: Vec<String> = Vec::new();

    loop {
        // 1. Drain all pending commands (non-blocking)
        loop {
            match cmd_rx.try_recv() {
                Ok(RelayCmd::Subscribe(ch)) => pending_subs.push(ch),
                Ok(RelayCmd::Unsubscribe(ch)) => pending_unsubs.push(ch),
                Err(mpsc::error::TryRecvError::Empty) => break,
                Err(mpsc::error::TryRecvError::Disconnected) => return Ok(()),
            }
        }

        // 2. Apply pending subscribe/unsubscribe commands
        for ch in pending_subs.drain(..) {
            if let Err(e) = pubsub.subscribe(&ch).await {
                tracing::error!(channel = %ch, "Redis subscribe failed: {}", e);
            } else {
                tracing::debug!(channel = %ch, "PubSub relay subscribed");
            }
        }
        for ch in pending_unsubs.drain(..) {
            if let Err(e) = pubsub.unsubscribe(&ch).await {
                tracing::error!(channel = %ch, "Redis unsubscribe failed: {}", e);
            } else {
                tracing::debug!(channel = %ch, "PubSub relay unsubscribed");
            }
        }

        // 3. Poll for Redis pubsub messages (with timeout so we can process commands)
        let mut stream = pubsub.on_message();
        let msg_result =
            tokio::time::timeout(std::time::Duration::from_millis(50), stream.next()).await;
        drop(stream); // Release borrow on pubsub so we can subscribe/unsubscribe next iteration

        match msg_result {
            Ok(Some(msg)) => {
                let channel_name: String = msg.get_channel_name().to_string();
                let payload: String = match msg.get_payload() {
                    Ok(p) => p,
                    Err(e) => {
                        tracing::error!("Failed to get pubsub payload: {}", e);
                        continue;
                    }
                };

                // Relay to broadcast channel
                if let Some(entry) = channels.get(&channel_name) {
                    // send() returns Err only if there are no receivers, which is fine
                    let _ = entry.sender.send(payload);
                }
            }
            Ok(None) => {
                // Stream ended — Redis connection dropped
                return Err("Redis pubsub stream ended".into());
            }
            Err(_) => {
                // Timeout — no message, loop back to check commands
                // Also check if cmd_rx is closed
                if cmd_rx.is_closed() {
                    return Ok(());
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pubsub_relay_dummy_subscribe_unsubscribe() {
        let relay = PubSubRelay::dummy();

        // Subscribe creates a channel entry with ref_count=1
        let _rx = relay.subscribe("project:test-id");
        assert!(relay.channels.contains_key("project:test-id"));
        assert_eq!(
            relay.channels.get("project:test-id").map(|e| e.ref_count),
            Some(1)
        );

        // Second subscribe increments ref_count
        let _rx2 = relay.subscribe("project:test-id");
        assert_eq!(
            relay.channels.get("project:test-id").map(|e| e.ref_count),
            Some(2)
        );

        // First unsubscribe decrements but doesn't remove
        relay.unsubscribe("project:test-id");
        assert!(relay.channels.contains_key("project:test-id"));
        assert_eq!(
            relay.channels.get("project:test-id").map(|e| e.ref_count),
            Some(1)
        );

        // Second unsubscribe removes the channel
        relay.unsubscribe("project:test-id");
        assert!(!relay.channels.contains_key("project:test-id"));
    }

    #[test]
    fn test_pubsub_relay_unsubscribe_nonexistent() {
        let relay = PubSubRelay::dummy();
        // Should not panic
        relay.unsubscribe("nonexistent");
    }

    #[test]
    fn test_pubsub_relay_multiple_channels() {
        let relay = PubSubRelay::dummy();

        let _rx1 = relay.subscribe("project:aaa");
        let _rx2 = relay.subscribe("user:bbb");
        let _rx3 = relay.subscribe("workspace:ccc");

        assert_eq!(relay.channels.len(), 3);

        relay.unsubscribe("user:bbb");
        assert_eq!(relay.channels.len(), 2);
        assert!(!relay.channels.contains_key("user:bbb"));
    }
}
