use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use metrics_exporter_prometheus::PrometheusHandle;
use sqlx::{postgres::PgPoolOptions, PgPool};
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::config::Config;
use crate::ws::PubSubRelay;
use taskflow_auth::jwt::JwtKeys;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub jwt_keys: Arc<JwtKeys>,
    pub redis: redis::aio::ConnectionManager,
    pub project_channels: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
    pub pubsub_relay: PubSubRelay,
    pub s3_client: aws_sdk_s3::Client,
    pub ws_connection_count: Arc<AtomicUsize>,
    pub prometheus_handle: Option<Arc<PrometheusHandle>>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        // Connect to PostgreSQL with configured pool
        let db = PgPoolOptions::new()
            .max_connections(config.db_max_connections)
            .min_connections(config.db_min_connections)
            .acquire_timeout(Duration::from_secs(5))
            .idle_timeout(Duration::from_secs(300))
            .max_lifetime(Duration::from_secs(1800))
            .connect(&config.app_database_url)
            .await?;

        // Run pending migrations
        sqlx::migrate!("../db/src/migrations").run(&db).await?;
        tracing::info!("Database migrations applied");

        // Connect to Redis
        let redis_client = redis::Client::open(config.redis_url.as_str())?;
        let redis = redis_client.get_connection_manager().await?;
        tracing::info!("Redis connected");

        // Set up S3 client for MinIO
        let s3_config = aws_sdk_s3::config::Builder::new()
            .endpoint_url(&config.minio_endpoint)
            .region(aws_sdk_s3::config::Region::new("us-east-1"))
            .credentials_provider(aws_sdk_s3::config::Credentials::new(
                &config.minio_access_key,
                &config.minio_secret_key,
                None,
                None,
                "minio",
            ))
            .force_path_style(true)
            .build();
        let s3_client = aws_sdk_s3::Client::from_conf(s3_config);

        let project_channels = Arc::new(DashMap::new());

        // Spawn background GC for project channels (removes channels with no receivers)
        Self::spawn_channel_gc(project_channels.clone());

        // Spawn shared Redis pubsub relay (single connection for all WebSocket clients)
        let pubsub_relay = PubSubRelay::spawn(config.redis_url.as_str());
        tracing::info!("PubSub relay started (shared Redis connection)");

        // Build JWT keys (RS256 if RSA keys provided, else HS256 fallback)
        let jwt_keys = Arc::new(JwtKeys::from_config(
            &config.jwt_secret,
            &config.jwt_refresh_secret,
            config.jwt_rsa_private_key.as_deref(),
            config.jwt_rsa_public_key.as_deref(),
        )?);

        // Initialize Prometheus metrics recorder
        let prometheus_handle =
            match metrics_exporter_prometheus::PrometheusBuilder::new().install_recorder() {
                Ok(handle) => {
                    tracing::info!("Prometheus metrics recorder installed");
                    Some(Arc::new(handle))
                }
                Err(e) => {
                    tracing::warn!("Failed to install Prometheus recorder: {e}");
                    None
                }
            };

        Ok(Self {
            db,
            config: Arc::new(config),
            jwt_keys,
            redis,
            project_channels,
            pubsub_relay,
            s3_client,
            ws_connection_count: Arc::new(AtomicUsize::new(0)),
            prometheus_handle,
        })
    }

    /// Spawn a background task that periodically removes board channels with no active receivers.
    fn spawn_channel_gc(channels: Arc<DashMap<Uuid, broadcast::Sender<String>>>) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                let before = channels.len();
                channels.retain(|_id, sender| sender.receiver_count() > 0);
                let removed = before - channels.len();
                if removed > 0 {
                    tracing::info!(
                        removed,
                        remaining = channels.len(),
                        "GC: cleaned board channels"
                    );
                }
            }
        });
    }

    /// Get or create a broadcast channel for a project
    pub fn get_project_channel(&self, project_id: Uuid) -> broadcast::Sender<String> {
        self.project_channels
            .entry(project_id)
            .or_insert_with(|| broadcast::channel(256).0)
            .clone()
    }

    /// Alias for backward compat — use get_project_channel instead
    pub fn get_board_channel(&self, board_id: Uuid) -> broadcast::Sender<String> {
        self.get_project_channel(board_id)
    }
}
