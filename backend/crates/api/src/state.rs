use std::sync::Arc;

use dashmap::DashMap;
use sqlx::PgPool;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub redis: redis::aio::ConnectionManager,
    pub board_channels: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
    pub s3_client: aws_sdk_s3::Client,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self, Box<dyn std::error::Error>> {
        // Connect to PostgreSQL
        let db = PgPool::connect(&config.app_database_url).await?;

        // Run pending migrations
        sqlx::migrate!("../db/src/migrations")
            .run(&db)
            .await?;
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

        let board_channels = Arc::new(DashMap::new());

        Ok(Self {
            db,
            config: Arc::new(config),
            redis,
            board_channels,
            s3_client,
        })
    }

    /// Get or create a broadcast channel for a board
    pub fn get_board_channel(&self, board_id: Uuid) -> broadcast::Sender<String> {
        self.board_channels
            .entry(board_id)
            .or_insert_with(|| broadcast::channel(256).0)
            .clone()
    }
}
