#!/bin/bash
#
# TaskFlow VPS Deployment Script
# Version: 1.0.0
# Date: 2026-02-11
#
# Usage: ./deploy-vps.sh [--skip-backup] [--force]
#
# This script automates the deployment process to the VPS at taskflow.paraslace.in
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_HOST="${VPS_HOST:-vps-ankur}"
PROJECT_PATH="${PROJECT_PATH:-/root/taskflow}"
BACKUP_DIR="${BACKUP_DIR:-/root/taskflow-backups}"
SKIP_BACKUP=false
FORCE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -h|--help)
            echo "TaskFlow VPS Deployment Script"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-backup    Skip database backup before deployment"
            echo "  --force          Force deployment without confirmation"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

confirm() {
    if [ "$FORCE" = true ]; then
        return 0
    fi

    read -p "$1 (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Deployment cancelled by user"
        exit 1
    fi
}

# Main deployment flow
main() {
    log_info "======================================"
    log_info "TaskFlow VPS Deployment Script v1.0.0"
    log_info "======================================"
    echo ""

    # Step 1: Verify SSH connection
    log_info "Step 1/10: Verifying SSH connection to $VPS_HOST..."
    if ! ssh -o ConnectTimeout=5 "$VPS_HOST" "echo 'Connection successful'" > /dev/null 2>&1; then
        log_error "Cannot connect to VPS via SSH alias '$VPS_HOST'"
        log_error "Please ensure SSH alias is configured in ~/.ssh/config"
        exit 1
    fi
    log_success "SSH connection verified"
    echo ""

    # Step 2: Check if project directory exists
    log_info "Step 2/10: Checking project directory..."
    if ! ssh "$VPS_HOST" "[ -d $PROJECT_PATH ]"; then
        log_error "Project directory $PROJECT_PATH does not exist on VPS"
        log_error "Please clone the repository first:"
        log_error "  ssh $VPS_HOST"
        log_error "  cd /root && git clone <repo-url> taskflow"
        exit 1
    fi
    log_success "Project directory found"
    echo ""

    # Step 3: Backup database (optional)
    if [ "$SKIP_BACKUP" = false ]; then
        log_info "Step 3/10: Backing up database..."
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

        ssh "$VPS_HOST" << EOF
            set -e
            cd $PROJECT_PATH
            mkdir -p $BACKUP_DIR

            if docker compose ps postgres | grep -q "Up"; then
                docker compose exec -T postgres pg_dump -U taskflow taskflow > "$BACKUP_DIR/$BACKUP_FILE"
                echo "Database backup created: $BACKUP_DIR/$BACKUP_FILE"
            else
                echo "PostgreSQL container not running, skipping backup"
            fi
EOF
        log_success "Database backup completed"
    else
        log_warning "Step 3/10: Database backup skipped"
    fi
    echo ""

    # Step 4: Pull latest code
    log_info "Step 4/10: Pulling latest code from Git..."
    ssh "$VPS_HOST" << EOF
        set -e
        cd $PROJECT_PATH
        git fetch origin
        git reset --hard origin/master
        echo "Current commit: \$(git rev-parse --short HEAD)"
        echo "Commit message: \$(git log -1 --pretty=%B)"
EOF
    log_success "Code updated to latest version"
    echo ""

    # Step 5: Verify Dockerfile
    log_info "Step 5/10: Verifying Rust version in Dockerfile..."
    RUST_VERSION=$(ssh "$VPS_HOST" "head -10 $PROJECT_PATH/backend/Dockerfile | grep -oP 'FROM rust:\K[0-9.]+' || echo 'unknown'")
    if [ "$RUST_VERSION" != "1.93" ]; then
        log_warning "Expected Rust 1.93 but found $RUST_VERSION"
        log_warning "This may cause build issues"
        confirm "Continue anyway?"
    else
        log_success "Dockerfile uses Rust 1.93"
    fi
    echo ""

    # Step 6: Check environment variables
    log_info "Step 6/10: Checking environment variables..."
    if ! ssh "$VPS_HOST" "[ -f $PROJECT_PATH/.env ]"; then
        log_warning ".env file not found"
        log_warning "Please create .env file before deployment"
        confirm "Continue without .env file?"
    else
        log_success ".env file exists"
    fi
    echo ""

    # Step 7: Run database migrations
    log_info "Step 7/10: Running database migrations..."
    ssh "$VPS_HOST" << EOF
        set -e
        cd $PROJECT_PATH
        docker compose run --rm backend-migration
EOF
    log_success "Database migrations completed"
    echo ""

    # Step 8: Rebuild containers
    log_info "Step 8/10: Rebuilding Docker containers (this may take 5-10 minutes)..."
    ssh "$VPS_HOST" << EOF
        set -e
        cd $PROJECT_PATH
        docker compose build --no-cache
EOF
    log_success "Containers rebuilt successfully"
    echo ""

    # Step 9: Restart services
    log_info "Step 9/10: Restarting services..."
    ssh "$VPS_HOST" << EOF
        set -e
        cd $PROJECT_PATH
        docker compose down
        docker compose up -d
        sleep 5
        echo ""
        echo "Service Status:"
        docker compose ps
EOF
    log_success "Services restarted"
    echo ""

    # Step 10: Health check
    log_info "Step 10/10: Running health checks..."
    sleep 10  # Wait for services to fully start

    HEALTH_CHECK=$(ssh "$VPS_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health || echo '000'")
    if [ "$HEALTH_CHECK" = "200" ]; then
        log_success "Backend health check passed (HTTP $HEALTH_CHECK)"
    else
        log_warning "Backend health check returned HTTP $HEALTH_CHECK"
        log_warning "Services may still be starting up, please verify manually"
    fi

    FRONTEND_CHECK=$(ssh "$VPS_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:4200 || echo '000'")
    if [ "$FRONTEND_CHECK" = "200" ]; then
        log_success "Frontend health check passed (HTTP $FRONTEND_CHECK)"
    else
        log_warning "Frontend health check returned HTTP $FRONTEND_CHECK"
        log_warning "Services may still be starting up, please verify manually"
    fi
    echo ""

    # Deployment summary
    log_success "======================================"
    log_success "Deployment completed successfully!"
    log_success "======================================"
    echo ""
    log_info "Next steps:"
    echo "  1. Visit https://taskflow.paraslace.in to verify"
    echo "  2. Test login functionality"
    echo "  3. Verify new features:"
    echo "     - Dashboard widgets"
    echo "     - My Work timeline"
    echo "     - Eisenhower Matrix"
    echo "  4. Check logs: ssh $VPS_HOST 'cd $PROJECT_PATH && docker compose logs -f'"
    echo ""

    if [ "$SKIP_BACKUP" = false ]; then
        log_info "Database backup saved to: $BACKUP_DIR/$BACKUP_FILE"
    fi

    echo ""
    log_warning "If issues occur, rollback with:"
    echo "  ssh $VPS_HOST"
    echo "  cd $PROJECT_PATH"
    echo "  git reset --hard <PREVIOUS_COMMIT>"
    echo "  docker compose down && docker compose up -d"
}

# Error handler
trap 'log_error "Deployment failed at step: $BASH_COMMAND"' ERR

# Run main function
main

exit 0
