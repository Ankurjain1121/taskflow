#!/bin/bash
# =============================================================================
# TaskFlow - Quick Check (No Docker Build)
# =============================================================================
# Faster version: only cargo check + clippy + frontend build
# Use this during development. Use pre-deploy-check.sh before deploying.
#
# Usage: ./scripts/quick-check.sh
#        ./scripts/quick-check.sh --backend   # Backend only
#        ./scripts/quick-check.sh --frontend  # Frontend only
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
ERRORS=""

check_pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
check_fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); ERRORS="${ERRORS}\n  - $1"; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

RUN_BACKEND=true
RUN_FRONTEND=true

case "${1:-}" in
    --backend)  RUN_FRONTEND=false ;;
    --frontend) RUN_BACKEND=false ;;
esac

echo ""
echo -e "${BLUE}  TaskFlow Quick Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# =========================================================================
# Backend: cargo check + clippy (in Docker)
# =========================================================================
if [ "$RUN_BACKEND" = true ]; then
    echo ""
    echo -e "${BLUE}  Backend: cargo check${NC}"

    if docker run --rm \
        -v "$PROJECT_ROOT/backend:/app" \
        -w /app \
        -e SQLX_OFFLINE=true \
        rust:1.93-bookworm \
        sh -c "apt-get update -qq && apt-get install -y -qq pkg-config libssl-dev > /dev/null 2>&1 && cargo check 2>&1" ; then
        check_pass "cargo check"
    else
        check_fail "cargo check"
    fi

    echo ""
    echo -e "${BLUE}  Backend: cargo clippy${NC}"

    if docker run --rm \
        -v "$PROJECT_ROOT/backend:/app" \
        -w /app \
        -e SQLX_OFFLINE=true \
        rust:1.93-bookworm \
        sh -c "apt-get update -qq && apt-get install -y -qq pkg-config libssl-dev > /dev/null 2>&1 && rustup component add clippy > /dev/null 2>&1 && cargo clippy -- -D warnings 2>&1" ; then
        check_pass "cargo clippy"
    else
        check_fail "cargo clippy (warnings as errors)"
    fi
fi

# =========================================================================
# Frontend: ng build
# =========================================================================
if [ "$RUN_FRONTEND" = true ]; then
    echo ""
    echo -e "${BLUE}  Frontend: ng build --production${NC}"

    if docker run --rm \
        -v "$PROJECT_ROOT/frontend:/app" \
        -w /app \
        node:22-slim \
        sh -c "npm ci --silent 2>/dev/null && npm run build -- --configuration=production 2>&1" ; then
        check_pass "ng build"
    else
        check_fail "ng build"
    fi
fi

# =========================================================================
# Summary
# =========================================================================
echo ""
if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}  FAILED ($FAIL errors) - fix before committing${NC}"
    echo -e "$ERRORS"
    exit 1
else
    echo -e "${GREEN}  ALL PASSED ($PASS checks)${NC}"
    exit 0
fi
