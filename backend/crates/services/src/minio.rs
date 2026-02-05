//! MinIO service for S3-compatible object storage operations
//!
//! Provides presigned URL generation, object management, and bucket operations
//! for file attachments using the rust-s3 crate.

use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::region::Region;
use std::sync::Arc;
use thiserror::Error;

/// Errors that can occur during MinIO operations
#[derive(Debug, Error)]
pub enum MinioError {
    #[error("S3 error: {0}")]
    S3Error(String),
    #[error("Presigning error: {0}")]
    PresigningError(String),
    #[error("Object not found: {0}")]
    NotFound(String),
    #[error("Bucket creation failed: {0}")]
    BucketCreationFailed(String),
    #[error("Credentials error: {0}")]
    CredentialsError(String),
}

/// Configuration for MinIO service
#[derive(Clone, Debug)]
pub struct MinioConfig {
    /// Internal endpoint for S3 operations (e.g., http://minio:9000 in Docker)
    pub endpoint: String,
    /// Public URL for presigned URLs (e.g., http://localhost:9000)
    pub public_url: String,
    /// Access key (username)
    pub access_key: String,
    /// Secret key (password)
    pub secret_key: String,
    /// Bucket name for attachments
    pub bucket: String,
}

/// MinIO service for S3-compatible object storage
#[derive(Clone)]
pub struct MinioService {
    /// Internal bucket for bucket operations and object management
    internal_bucket: Arc<Bucket>,
    /// Bucket configured with public URL for presigned URL generation
    public_bucket: Arc<Bucket>,
    /// Public URL for presigned URLs
    public_url: String,
}

impl MinioService {
    /// Create a new MinioService with the given configuration
    pub async fn new(config: MinioConfig) -> Result<Self, MinioError> {
        let credentials = Credentials::new(
            Some(&config.access_key),
            Some(&config.secret_key),
            None,
            None,
            None,
        )
        .map_err(|e| MinioError::CredentialsError(e.to_string()))?;

        // Internal region for bucket operations
        let internal_region = Region::Custom {
            region: "us-east-1".to_string(),
            endpoint: config.endpoint.clone(),
        };

        // Public region for presigned URLs
        let public_region = Region::Custom {
            region: "us-east-1".to_string(),
            endpoint: config.public_url.clone(),
        };

        // Create internal bucket
        let internal_bucket = Bucket::new(&config.bucket, internal_region, credentials.clone())
            .map_err(|e| MinioError::S3Error(e.to_string()))?
            .with_path_style();

        // Create public bucket for presigned URLs
        let public_bucket = Bucket::new(&config.bucket, public_region, credentials)
            .map_err(|e| MinioError::S3Error(e.to_string()))?
            .with_path_style();

        Ok(Self {
            internal_bucket: Arc::new(*internal_bucket),
            public_bucket: Arc::new(*public_bucket),
            public_url: config.public_url,
        })
    }

    /// Ensure the bucket exists, creating it if necessary
    pub async fn ensure_bucket(&self) -> Result<(), MinioError> {
        let bucket_name = self.internal_bucket.name();
        // Try to list objects to check if bucket exists
        match self.internal_bucket.list("".to_string(), Some("/".to_string())).await {
            Ok(_) => {
                tracing::info!("MinIO bucket '{}' already exists", bucket_name);
                Ok(())
            }
            Err(_) => {
                // Bucket doesn't exist, create it
                tracing::info!("Creating MinIO bucket '{}'", bucket_name);
                Bucket::create_with_path_style(
                    &bucket_name,
                    self.internal_bucket.region().clone(),
                    self.internal_bucket.credentials().await
                        .map_err(|e| MinioError::CredentialsError(e.to_string()))?,
                    s3::bucket::BucketConfiguration::default(),
                )
                .await
                .map_err(|e| {
                    MinioError::BucketCreationFailed(format!(
                        "Failed to create bucket '{}': {}",
                        bucket_name,
                        e
                    ))
                })?;
                tracing::info!(
                    "MinIO bucket '{}' created successfully",
                    bucket_name
                );
                Ok(())
            }
        }
    }

    /// Generate a presigned PUT URL for uploading a file
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    /// * `content_type` - The MIME type of the file
    /// * `expires_secs` - How long the URL should be valid (in seconds)
    ///
    /// # Returns
    /// A presigned URL that can be used for HTTP PUT upload
    pub async fn presigned_put_url(
        &self,
        key: &str,
        _content_type: &str,
        expires_secs: u64,
    ) -> Result<String, MinioError> {
        // Use public_bucket to generate URLs with public endpoint
        let url = self
            .public_bucket
            .presign_put(key, expires_secs as u32, None, None)
            .await
            .map_err(|e| MinioError::PresigningError(e.to_string()))?;

        Ok(url)
    }

    /// Generate a presigned GET URL for downloading a file
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    /// * `expires_secs` - How long the URL should be valid (in seconds)
    ///
    /// # Returns
    /// A presigned URL that can be used for HTTP GET download
    pub async fn presigned_get_url(
        &self,
        key: &str,
        expires_secs: u64,
    ) -> Result<String, MinioError> {
        // Use public_bucket to generate URLs with public endpoint
        let url = self
            .public_bucket
            .presign_get(key, expires_secs as u32, None)
            .await
            .map_err(|e| MinioError::PresigningError(e.to_string()))?;

        Ok(url)
    }

    /// Check if an object exists (verify upload completed)
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    ///
    /// # Returns
    /// Ok(()) if the object exists, Err(NotFound) otherwise
    pub async fn stat_object(&self, key: &str) -> Result<(), MinioError> {
        self.internal_bucket
            .head_object(key)
            .await
            .map_err(|e| MinioError::NotFound(format!("Object '{}' not found: {}", key, e)))?;

        Ok(())
    }

    /// Delete an object from the bucket
    ///
    /// # Arguments
    /// * `key` - The object key (path) in the bucket
    ///
    /// # Note
    /// This operation is idempotent - deleting a non-existent object succeeds
    pub async fn delete_object(&self, key: &str) -> Result<(), MinioError> {
        self.internal_bucket
            .delete_object(key)
            .await
            .map_err(|e| MinioError::S3Error(format!("Failed to delete '{}': {}", key, e)))?;

        tracing::info!(
            "Deleted object '{}' from bucket '{}'",
            key,
            self.internal_bucket.name()
        );
        Ok(())
    }

    /// Get the public URL base for reference
    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    /// Get the bucket name
    pub fn bucket(&self) -> String {
        self.internal_bucket.name()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_minio_config() {
        let config = MinioConfig {
            endpoint: "http://minio:9000".to_string(),
            public_url: "http://localhost:9000".to_string(),
            access_key: "minioadmin".to_string(),
            secret_key: "minioadmin".to_string(),
            bucket: "test-bucket".to_string(),
        };

        assert_eq!(config.endpoint, "http://minio:9000");
        assert_eq!(config.public_url, "http://localhost:9000");
    }
}
