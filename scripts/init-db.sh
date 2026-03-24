#!/bin/bash
# =============================================================================
# TaskBolt Database Initialization Script
# =============================================================================
# This script:
# 1. Waits for PostgreSQL to be ready
# 2. Creates the Lago database if it doesn't exist
# 3. Creates the MinIO bucket for attachments
# 4. Optionally seeds the database if empty
# =============================================================================

set -e

# Configuration with defaults
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-taskbolt}"
LAGO_DB="${LAGO_DB:-lago}"

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
MINIO_BUCKET="${MINIO_BUCKET:-task-attachments}"

MAX_RETRIES="${MAX_RETRIES:-30}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Wait for PostgreSQL
# =============================================================================
wait_for_postgres() {
    log_info "Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."

    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c "SELECT 1" > /dev/null 2>&1; then
            log_info "PostgreSQL is ready!"
            return 0
        fi

        retries=$((retries + 1))
        log_warn "PostgreSQL not ready yet (attempt ${retries}/${MAX_RETRIES}). Retrying in ${RETRY_INTERVAL}s..."
        sleep "${RETRY_INTERVAL}"
    done

    log_error "PostgreSQL did not become ready in time"
    return 1
}

# =============================================================================
# Create Lago Database
# =============================================================================
create_lago_database() {
    log_info "Checking if Lago database '${LAGO_DB}' exists..."

    # Check if database exists
    local exists=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${LAGO_DB}'")

    if [ "$exists" = "1" ]; then
        log_info "Lago database '${LAGO_DB}' already exists"
    else
        log_info "Creating Lago database '${LAGO_DB}'..."
        PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d postgres -c "CREATE DATABASE ${LAGO_DB}"
        log_info "Lago database created successfully"
    fi
}

# =============================================================================
# Check if TaskBolt DB is Empty
# =============================================================================
is_db_empty() {
    log_info "Checking if TaskBolt database is empty..."

    # Check if tenants table exists and has any rows
    local tenant_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT COUNT(*) FROM tenants" 2>/dev/null || echo "0")

    if [ "$tenant_count" = "0" ]; then
        log_info "Database is empty (no tenants found)"
        return 0
    else
        log_info "Database has ${tenant_count} tenant(s)"
        return 1
    fi
}

# =============================================================================
# Create MinIO Bucket
# =============================================================================
create_minio_bucket() {
    log_info "Checking MinIO bucket '${MINIO_BUCKET}'..."

    # Wait for MinIO to be ready
    local retries=0
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -s "${MINIO_ENDPOINT}/minio/health/live" > /dev/null 2>&1; then
            log_info "MinIO is ready!"
            break
        fi

        retries=$((retries + 1))
        log_warn "MinIO not ready yet (attempt ${retries}/${MAX_RETRIES}). Retrying in ${RETRY_INTERVAL}s..."
        sleep "${RETRY_INTERVAL}"
    done

    if [ $retries -ge $MAX_RETRIES ]; then
        log_warn "MinIO did not become ready in time, skipping bucket creation"
        return 0
    fi

    # Check if mc (MinIO client) is available
    if ! command -v mc &> /dev/null; then
        log_warn "MinIO client (mc) not found, attempting bucket creation via AWS CLI..."

        # Try with aws cli if available
        if command -v aws &> /dev/null; then
            AWS_ACCESS_KEY_ID="${MINIO_ACCESS_KEY}" \
            AWS_SECRET_ACCESS_KEY="${MINIO_SECRET_KEY}" \
            aws --endpoint-url "${MINIO_ENDPOINT}" s3 mb "s3://${MINIO_BUCKET}" 2>/dev/null || true
            log_info "Bucket creation attempted via AWS CLI"
        else
            log_warn "Neither mc nor aws CLI available, skipping bucket creation"
            log_warn "Bucket will be created on first upload"
        fi
        return 0
    fi

    # Configure mc alias
    mc alias set myminio "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" --api S3v4 > /dev/null 2>&1

    # Check if bucket exists
    if mc ls myminio/"${MINIO_BUCKET}" > /dev/null 2>&1; then
        log_info "MinIO bucket '${MINIO_BUCKET}' already exists"
    else
        log_info "Creating MinIO bucket '${MINIO_BUCKET}'..."
        mc mb myminio/"${MINIO_BUCKET}"

        # Bucket is private by default — backend uses presigned URLs for access
        log_info "Bucket created with private policy (presigned URLs required)"

        log_info "MinIO bucket created successfully"
    fi
}

# =============================================================================
# Run Database Seed
# =============================================================================
run_seed() {
    log_info "Running database seed..."

    if [ -x "/usr/local/bin/seed" ]; then
        /usr/local/bin/seed
        log_info "Database seeded successfully"
    else
        log_warn "Seed binary not found at /usr/local/bin/seed, skipping seed"
    fi
}

# =============================================================================
# Main
# =============================================================================
main() {
    log_info "Starting TaskBolt initialization..."

    # Wait for PostgreSQL
    wait_for_postgres

    # Create Lago database
    create_lago_database

    # Create MinIO bucket
    create_minio_bucket

    # Check if we should seed
    if [ "${SKIP_SEED:-false}" != "true" ]; then
        if is_db_empty; then
            log_info "Empty database detected, running seed..."
            run_seed
        else
            log_info "Database already has data, skipping seed"
        fi
    else
        log_info "SKIP_SEED is set, skipping seed"
    fi

    log_info "Initialization complete!"
}

# Run main function
main "$@"
