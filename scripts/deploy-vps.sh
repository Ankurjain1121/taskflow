#!/bin/bash
# =============================================================================
# TaskFlow - VPS Deployment Script
# =============================================================================
# Usage: ./scripts/deploy-vps.sh
#
# Prerequisites:
#   - Docker and Docker Compose installed
#   - .env file configured with production values
#   - DNS pointing to this server
# =============================================================================

set -e

echo "=============================================="
echo "  TaskFlow VPS Deployment"
echo "=============================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Copy .env.production to .env and update values:"
    echo "  cp .env.production .env"
    echo "  nano .env"
    exit 1
fi

# Load environment
source .env

# Check required variables
if [ "$DOMAIN" = "taskflow.yourdomain.com" ] || [ -z "$DOMAIN" ]; then
    echo "ERROR: DOMAIN not set in .env!"
    echo "Set your actual domain: DOMAIN=taskflow.yourdomain.com"
    exit 1
fi

if [[ "$JWT_SECRET" == *"CHANGE_ME"* ]]; then
    echo "ERROR: JWT_SECRET not changed from default!"
    echo "Generate a secure secret: openssl rand -hex 32"
    exit 1
fi

echo ""
echo "Configuration:"
echo "  Domain: $DOMAIN"
echo "  Database: $POSTGRES_DB"
echo ""

# Create Docker network if not exists
echo "Creating Docker network..."
docker network create taskflow-network 2>/dev/null || true

# Pull latest images
echo "Pulling latest images..."
docker compose -f docker-compose.yml -f docker-compose.vps.yml pull

# Build custom images
echo "Building application images..."
docker compose -f docker-compose.yml -f docker-compose.vps.yml build

# Start infrastructure services first
echo "Starting infrastructure services..."
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d postgres redis mongodb minio

# Wait for PostgreSQL
echo "Waiting for PostgreSQL to be ready..."
until docker compose exec -T postgres pg_isready -U ${POSTGRES_USER:-postgres}; do
    sleep 2
done

# Run migrations
echo "Running database migrations..."
docker compose -f docker-compose.yml -f docker-compose.vps.yml up migrate

# Setup MinIO bucket
echo "Setting up MinIO bucket..."
docker compose -f docker-compose.yml -f docker-compose.vps.yml up minio-setup

# Start application services
echo "Starting application services..."
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d backend frontend

# Wait for backend to be healthy
echo "Waiting for backend to be healthy..."
sleep 10

# Start Caddy
echo "Starting Caddy (reverse proxy with HTTPS)..."
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d caddy

echo ""
echo "=============================================="
echo "  Deployment Complete!"
echo "=============================================="
echo ""
echo "Your application is now available at:"
echo "  https://$DOMAIN"
echo ""
echo "Caddy will automatically obtain SSL certificates."
echo "First request may take a few seconds while certificates are issued."
echo ""
echo "Useful commands:"
echo "  View logs:     docker compose -f docker-compose.yml -f docker-compose.vps.yml logs -f"
echo "  Stop:          docker compose -f docker-compose.yml -f docker-compose.vps.yml down"
echo "  Restart:       docker compose -f docker-compose.yml -f docker-compose.vps.yml restart"
echo ""
