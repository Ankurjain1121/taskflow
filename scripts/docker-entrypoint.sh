#!/bin/bash
# =============================================================================
# TaskFlow Docker Entrypoint
# =============================================================================
# This script:
# 1. Runs database initialization (if not skipped)
# 2. Starts the Rust API server
# =============================================================================

set -e

# Configuration
SKIP_INIT="${SKIP_INIT:-false}"

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[ENTRYPOINT]${NC} $1"
}

# =============================================================================
# Main
# =============================================================================
main() {
    log_info "TaskFlow API starting..."

    # Run initialization unless skipped
    if [ "${SKIP_INIT}" != "true" ]; then
        if [ -x "/usr/local/bin/init-db.sh" ]; then
            log_info "Running database initialization..."
            /usr/local/bin/init-db.sh
        else
            log_info "init-db.sh not found or not executable, skipping initialization"
        fi
    else
        log_info "SKIP_INIT is set, skipping database initialization"
    fi

    # Start the API server
    log_info "Starting TaskFlow API server..."
    exec /usr/local/bin/taskflow-api "$@"
}

# Run main function with all arguments
main "$@"
