#!/bin/bash
# =============================================================================
# TaskBolt - Pre-Deploy Check Script
# =============================================================================
# Run this BEFORE every deploy to catch errors locally.
# Usage: ./scripts/pre-deploy-check.sh
#
# Checks:
#   1. Rust compilation (cargo check)
#   2. Rust linting (cargo clippy)
#   3. Frontend TypeScript + build
#   4. SQL migration file validation
#   5. Docker build (both images)
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0
ERRORS=""

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_pass() {
    echo -e "  ${GREEN}PASS${NC} $1"
    PASS=$((PASS + 1))
}

check_fail() {
    echo -e "  ${RED}FAIL${NC} $1"
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n  - $1"
}

check_warn() {
    echo -e "  ${YELLOW}WARN${NC} $1"
    WARN=$((WARN + 1))
}

# Get project root (script is in scripts/)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  TaskBolt Pre-Deploy Checks${NC}"
echo -e "${BLUE}=============================================${NC}"
echo -e "  Project: $PROJECT_ROOT"
echo -e "  Time:    $(date)"

# =========================================================================
# Check 1: Rust Compilation (cargo check inside Docker)
# =========================================================================
print_header "1/5  Rust Compilation (cargo check)"

if docker run --rm \
    -v "$PROJECT_ROOT/backend:/app" \
    -w /app \
    -e SQLX_OFFLINE=true \
    rust:1.93-bookworm \
    sh -c "apt-get update -qq && apt-get install -y -qq pkg-config libssl-dev > /dev/null 2>&1 && cargo check --release 2>&1" ; then
    check_pass "Backend compiles successfully"
else
    check_fail "Backend compilation failed"
fi

# =========================================================================
# Check 2: Rust Linting (cargo clippy)
# =========================================================================
print_header "2/5  Rust Linting (cargo clippy)"

CLIPPY_OUTPUT=$(docker run --rm \
    -v "$PROJECT_ROOT/backend:/app" \
    -w /app \
    -e SQLX_OFFLINE=true \
    rust:1.93-bookworm \
    sh -c "apt-get update -qq && apt-get install -y -qq pkg-config libssl-dev > /dev/null 2>&1 && rustup component add clippy > /dev/null 2>&1 && cargo clippy --release -- -D warnings 2>&1" || true)

if echo "$CLIPPY_OUTPUT" | grep -q "error"; then
    check_fail "Clippy found errors"
    echo "$CLIPPY_OUTPUT" | grep "error" | head -10
elif echo "$CLIPPY_OUTPUT" | grep -q "warning"; then
    check_warn "Clippy found warnings (non-blocking)"
    echo "$CLIPPY_OUTPUT" | grep "warning" | head -5
else
    check_pass "No clippy issues"
fi

# =========================================================================
# Check 3: Frontend Build (TypeScript + Angular)
# =========================================================================
print_header "3/5  Frontend Build (ng build --production)"

if docker run --rm \
    -v "$PROJECT_ROOT/frontend:/app" \
    -w /app \
    node:22-slim \
    sh -c "npm ci --silent 2>/dev/null && npm run build -- --configuration=production 2>&1" ; then
    check_pass "Frontend builds successfully"
else
    check_fail "Frontend build failed"
fi

# =========================================================================
# Check 4: SQL Migration Validation
# =========================================================================
print_header "4/5  SQL Migration Validation"

MIGRATION_DIR="$PROJECT_ROOT/backend/crates/db/src/migrations"

if [ -d "$MIGRATION_DIR" ]; then
    MIGRATION_COUNT=$(ls -1 "$MIGRATION_DIR"/*.sql 2>/dev/null | wc -l)
    echo "  Found $MIGRATION_COUNT migration files"

    # Check for syntax issues in SQL files
    SQL_ERRORS=0
    for f in "$MIGRATION_DIR"/*.sql; do
        [ -f "$f" ] || continue
        # Check for common SQL mistakes
        if grep -qiP "^\s*(DROP TABLE|DROP DATABASE|TRUNCATE)" "$f"; then
            check_warn "Destructive operation found in $(basename "$f")"
        fi
        # Check for missing semicolons at end of statements
        if ! tail -c 10 "$f" | grep -q ";"; then
            check_warn "$(basename "$f") may be missing trailing semicolon"
        fi
    done

    if [ "$SQL_ERRORS" -eq 0 ]; then
        check_pass "Migration files look valid ($MIGRATION_COUNT files)"
    fi
else
    check_warn "No migrations directory found"
fi

# =========================================================================
# Check 5: Docker Image Builds
# =========================================================================
print_header "5/5  Docker Image Builds"

echo "  Building backend image..."
if docker compose build backend 2>&1 | tail -5; then
    check_pass "Backend Docker image built"
else
    check_fail "Backend Docker image build failed"
fi

echo ""
echo "  Building frontend image..."
if docker compose build frontend 2>&1 | tail -5; then
    check_pass "Frontend Docker image built"
else
    check_fail "Frontend Docker image build failed"
fi

# =========================================================================
# Summary
# =========================================================================
echo ""
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Results Summary${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "  ${GREEN}PASSED:${NC}   $PASS"
echo -e "  ${RED}FAILED:${NC}   $FAIL"
echo -e "  ${YELLOW}WARNINGS:${NC} $WARN"
echo ""

if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}=============================================${NC}"
    echo -e "${RED}  DEPLOY BLOCKED - Fix these errors first:${NC}"
    echo -e "${RED}=============================================${NC}"
    echo -e "$ERRORS"
    echo ""
    exit 1
else
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}  ALL CHECKS PASSED - Safe to deploy${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo ""
    exit 0
fi
