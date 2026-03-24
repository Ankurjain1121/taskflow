#!/bin/bash
# =============================================================================
# TaskBolt - Auth Smoke Test
# =============================================================================
# Verifies the full auth lifecycle after deploy.
# Usage: ./scripts/smoke-test-auth.sh https://taskflow.paraslace.in
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
COOKIE_JAR=$(mktemp)
PASS=0
FAIL=0
TEST_EMAIL="smoke-test-$(date +%s)-${RANDOM}@example.com"
TEST_PASSWORD="SmokeTest123!"
TEST_NAME="Smoke Test User"

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

check() {
  local label="$1"
  local expected_status="$2"
  local actual_status="$3"

  if [ "$actual_status" -eq "$expected_status" ]; then
    echo "  [PASS] $label (HTTP $actual_status)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $label (expected $expected_status, got $actual_status)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=============================================="
echo "  Auth Smoke Test — $BASE_URL"
echo "=============================================="
echo ""

# 1. Health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" 2>/dev/null || echo "000")
check "GET /api/health — backend is up" 200 "$STATUS"

if [ "$STATUS" = "000" ]; then
  echo ""
  echo "  Backend unreachable. Aborting."
  exit 1
fi

# 2. Sign up
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/sign-up" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$COOKIE_JAR" \
  2>/dev/null)
check "POST /api/auth/sign-up — create test user" 200 "$STATUS"

# 3. GET /auth/me with cookies (expect 200)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/auth/me" \
  -b "$COOKIE_JAR" \
  2>/dev/null)
check "GET /api/auth/me — with cookies" 200 "$STATUS"

# 4. GET /auth/me without cookies (expect 401)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/auth/me" \
  2>/dev/null)
check "GET /api/auth/me — without cookies" 401 "$STATUS"

# 5. Sign in
SIGNIN_JAR=$(mktemp)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" \
  -c "$SIGNIN_JAR" \
  2>/dev/null)
check "POST /api/auth/sign-in — login" 200 "$STATUS"

# 6. Refresh token
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{}" \
  -b "$SIGNIN_JAR" \
  -c "$SIGNIN_JAR" \
  2>/dev/null)
check "POST /api/auth/refresh — token refresh" 200 "$STATUS"

# 7. Logout
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/logout" \
  -b "$SIGNIN_JAR" \
  2>/dev/null)
check "POST /api/auth/logout — clean logout" 200 "$STATUS"

rm -f "$SIGNIN_JAR"

echo ""
echo "=============================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "=============================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
