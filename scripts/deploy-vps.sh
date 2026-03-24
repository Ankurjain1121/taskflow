#!/bin/bash
# ====================================================================
# DEPRECATED — This script references Caddy and internal Docker DB/Redis
# which no longer match the current setup (nginx + host DB/Redis).
#
# Current deploy: docker compose build && docker compose up -d
# ====================================================================
echo "WARNING: This script is DEPRECATED. Use 'docker compose build && docker compose up -d' instead."
echo "         See CLAUDE.md for current deploy instructions."
echo ""
read -p "Continue anyway? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# =============================================================================
# TaskBolt - VPS Deployment Script
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
echo "  TaskBolt VPS Deployment"
echo "=============================================="

# Run pre-deploy checks first (skip with --skip-checks)
if [ "${1:-}" != "--skip-checks" ]; then
    echo ""
    echo "Running pre-deploy checks..."
    echo "(Use --skip-checks to skip, e.g., for hotfixes)"
    echo ""
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    if ! "$SCRIPT_DIR/pre-deploy-check.sh"; then
        echo ""
        echo "ERROR: Pre-deploy checks failed! Fix errors before deploying."
        echo "  To skip (DANGER): ./scripts/deploy-vps.sh --skip-checks"
        exit 1
    fi
fi

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
if [ "$DOMAIN" = "taskbolt.yourdomain.com" ] || [ -z "$DOMAIN" ]; then
    echo "ERROR: DOMAIN not set in .env!"
    echo "Set your actual domain: DOMAIN=taskbolt.yourdomain.com"
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
docker network create taskbolt-network 2>/dev/null || true

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

# Run auth smoke test
echo ""
echo "Waiting 15s for services to stabilize..."
sleep 15

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/smoke-test-auth.sh" ]; then
    echo "Running auth smoke test..."
    if ! "$SCRIPT_DIR/smoke-test-auth.sh" "https://$DOMAIN"; then
        echo ""
        echo "WARNING: Auth smoke test failed! Check auth endpoints."
        echo "         The deploy completed but auth may be broken."
        echo ""
    fi
else
    echo "WARNING: smoke-test-auth.sh not found, skipping auth validation."
fi

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
