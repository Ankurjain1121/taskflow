#!/bin/bash
# =============================================================================
# TaskBolt Docker Entrypoint
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
    log_info "TaskBolt API starting..."

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
    log_info "Starting TaskBolt API server..."
    exec /usr/local/bin/taskbolt-api "$@"
}

# Run main function with all arguments
main "$@"
