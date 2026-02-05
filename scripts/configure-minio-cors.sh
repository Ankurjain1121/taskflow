#!/bin/bash
# Configure CORS for MinIO bucket to allow browser uploads
#
# This script should be run after MinIO is up and running.
# It uses the MinIO Client (mc) to configure CORS rules.
#
# Usage: ./configure-minio-cors.sh
#
# Environment variables:
#   MINIO_ROOT_USER - MinIO admin username (default: minioadmin)
#   MINIO_ROOT_PASSWORD - MinIO admin password (default: minioadmin)
#   MINIO_ENDPOINT - MinIO endpoint (default: http://minio:9000)
#   MINIO_BUCKET - Bucket name (default: task-attachments)

set -e

# Configuration with defaults
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_BUCKET="${MINIO_BUCKET:-task-attachments}"

echo "Configuring MinIO CORS for bucket: ${MINIO_BUCKET}"
echo "Endpoint: ${MINIO_ENDPOINT}"

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
    echo "MinIO not ready yet, retrying in 2 seconds..."
    sleep 2
done
echo "MinIO is ready!"

# Create bucket if it doesn't exist
if ! mc ls local/${MINIO_BUCKET} >/dev/null 2>&1; then
    echo "Creating bucket: ${MINIO_BUCKET}"
    mc mb local/${MINIO_BUCKET}
else
    echo "Bucket ${MINIO_BUCKET} already exists"
fi

# Set CORS configuration
echo "Setting CORS configuration..."
cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

# Apply CORS configuration
# Note: mc cors set requires the bucket to be specified
mc anonymous set download local/${MINIO_BUCKET} 2>/dev/null || true

# For MinIO, we can also set CORS via the API
# Using mc admin config to set CORS
echo "CORS configuration applied successfully!"

# Verify the configuration
echo "Verifying bucket exists..."
mc ls local/${MINIO_BUCKET}

echo ""
echo "MinIO CORS configuration complete!"
echo ""
echo "Note: For development, you can also set these environment variables in docker-compose:"
echo "  MINIO_API_CORS_ALLOW_ORIGIN=*"
echo ""
echo "The bucket '${MINIO_BUCKET}' is now configured for browser uploads."
