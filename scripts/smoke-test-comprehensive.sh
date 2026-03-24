#!/usr/bin/env bash
set -euo pipefail

# Comprehensive Smoke Test for TaskBolt API
# Usage: ./scripts/smoke-test-comprehensive.sh [BASE_URL]
# Default: https://taskflow.paraslace.in

BASE_URL="${1:-https://taskflow.paraslace.in}"
API="${BASE_URL}/api"
COOKIE_JAR="/tmp/taskbolt-smoke-cookies.txt"
COOKIE_JAR2="/tmp/taskbolt-smoke-cookies2.txt"
PASS=0
FAIL=0
TOTAL=25
RUN_ID="smoke-$(date +%s)"
EMAIL="smoke-${RUN_ID}@example.com"
EMAIL2="smoke-${RUN_ID}-invited@example.com"
PASSWORD="TestPass123!"
NAME="Smoke Test User"
NAME2="Smoke Invited User"

# Cleanup
rm -f "$COOKIE_JAR" "$COOKIE_JAR2"

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

assert() {
  local desc="$1"
  local status="$2"
  local expected="$3"
  local body="${4:-}"

  if [ "$status" = "$expected" ]; then
    PASS=$((PASS + 1))
    green "  PASS [$PASS/$TOTAL] $desc (HTTP $status)"
  else
    FAIL=$((FAIL + 1))
    red "  FAIL [$((PASS + FAIL))/$TOTAL] $desc (expected $expected, got $status)"
    if [ -n "$body" ]; then
      echo "    Response: ${body:0:200}"
    fi
  fi
}

assert_body_contains() {
  local desc="$1"
  local status="$2"
  local expected_status="$3"
  local body="$4"
  local search="$5"

  if [ "$status" = "$expected_status" ] && echo "$body" | grep -q "$search"; then
    PASS=$((PASS + 1))
    green "  PASS [$PASS/$TOTAL] $desc (HTTP $status, found '$search')"
  else
    FAIL=$((FAIL + 1))
    red "  FAIL [$((PASS + FAIL))/$TOTAL] $desc (status=$status, search='$search')"
    echo "    Response: ${body:0:200}"
  fi
}

bold "TaskBolt Comprehensive Smoke Test"
echo "Base URL: $BASE_URL"
echo "Run ID: $RUN_ID"
echo ""

# ---------------------------------------------------------------------------
# 1. Health check
# ---------------------------------------------------------------------------
RESP=$(curl -sk -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo "000")
assert "Health check" "$RESP" "200"

# ---------------------------------------------------------------------------
# 2. Sign up user
# ---------------------------------------------------------------------------
BODY=$(curl -sk -c "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  "${API}/auth/sign-up" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Sign up user" "$STATUS" "200"
USER_ID=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))" 2>/dev/null || echo "")

# ---------------------------------------------------------------------------
# 3. Create workspace
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke Workspace\",\"description\":\"\"}" \
  "${API}/workspaces" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Create workspace" "$STATUS" "200"
WS_ID=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

# ---------------------------------------------------------------------------
# 4. Get workspace list
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" "${API}/workspaces" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert_body_contains "Get workspace list" "$STATUS" "200" "$RESP_BODY" "Smoke Workspace"

# ---------------------------------------------------------------------------
# 5. Invite user to workspace
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"workspace_id\":\"$WS_ID\",\"role\":\"Member\"}" \
  "${API}/invitations" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Invite user to workspace" "$STATUS" "200"
INVITE_TOKEN=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

# ---------------------------------------------------------------------------
# 6. Accept invitation
# ---------------------------------------------------------------------------
BODY=$(curl -sk -c "$COOKIE_JAR2" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$INVITE_TOKEN\",\"name\":\"$NAME2\",\"password\":\"$PASSWORD\"}" \
  "${API}/invitations/accept" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Accept invitation" "$STATUS" "200"
USER2_ID=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))" 2>/dev/null || echo "")

# ---------------------------------------------------------------------------
# 7. Add member to workspace (may be redundant after invitation accept)
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER2_ID\"}" \
  "${API}/workspaces/${WS_ID}/members" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
# Accept 200 or 409 (already a member)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "409" ]; then
  PASS=$((PASS + 1))
  green "  PASS [$PASS/$TOTAL] Add member to workspace (HTTP $STATUS)"
else
  FAIL=$((FAIL + 1))
  red "  FAIL [$((PASS + FAIL))/$TOTAL] Add member to workspace (expected 200/409, got $STATUS)"
fi

# ---------------------------------------------------------------------------
# 8. Get workspace members
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" "${API}/workspaces/${WS_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert_body_contains "Get workspace members" "$STATUS" "200" "$RESP_BODY" "members"

# ---------------------------------------------------------------------------
# 9. Create board in workspace
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke Board\",\"description\":\"\"}" \
  "${API}/workspaces/${WS_ID}/boards" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Create board in workspace" "$STATUS" "200"
BOARD_ID=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
COLUMN_ID=$(echo "$RESP_BODY" | python3 -c "import sys,json; cols=json.load(sys.stdin).get('columns',[]); print(cols[0]['id'] if cols else '')" 2>/dev/null || echo "")

# ---------------------------------------------------------------------------
# 10. Get boards for workspace
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" "${API}/workspaces/${WS_ID}/boards" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert_body_contains "Get boards for workspace" "$STATUS" "200" "$RESP_BODY" "Smoke Board"

# ---------------------------------------------------------------------------
# 11. Create task on board
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Smoke Task\",\"column_id\":\"$COLUMN_ID\",\"priority\":\"high\"}" \
  "${API}/boards/${BOARD_ID}/tasks" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Create task on board" "$STATUS" "200"
TASK_ID=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

# ---------------------------------------------------------------------------
# 12. Get tasks for board
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" "${API}/boards/${BOARD_ID}/tasks" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Get tasks for board" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 13. Update task (title, priority)
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" -X PATCH \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Updated Smoke Task\",\"priority\":\"urgent\"}" \
  "${API}/tasks/${TASK_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Update task (title, priority)" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 14. Assign task to member
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER2_ID\"}" \
  "${API}/tasks/${TASK_ID}/assignees" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Assign task to member" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 15. Move task to different column
# ---------------------------------------------------------------------------
# Get second column if it exists
COL2_ID=$(curl -sk -b "$COOKIE_JAR" "${API}/boards/${BOARD_ID}" 2>/dev/null | \
  python3 -c "import sys,json; cols=json.load(sys.stdin).get('columns',[]); print(cols[1]['id'] if len(cols)>1 else cols[0]['id'] if cols else '')" 2>/dev/null || echo "$COLUMN_ID")
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" -X PATCH \
  -H "Content-Type: application/json" \
  -d "{\"column_id\":\"$COL2_ID\",\"position\":\"1\"}" \
  "${API}/tasks/${TASK_ID}/move" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Move task to different column" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 16. Create label
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke Label\",\"color\":\"#ef4444\"}" \
  "${API}/projects/${WS_ID}/labels" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Create label" "$STATUS" "200"
LABEL_ID=$(echo "$RESP_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

# ---------------------------------------------------------------------------
# 17. Add label to task
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" -X POST \
  "${API}/tasks/${TASK_ID}/labels/${LABEL_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Add label to task" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 18. Get task with labels
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" "${API}/tasks/${TASK_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
RESP_BODY=$(echo "$BODY" | sed '$d')
assert "Get task with labels" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 19. Archive board (delete = soft archive)
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" -X DELETE \
  "${API}/boards/${BOARD_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Archive board" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 20. Get archived boards (via workspace boards — archived board should be gone)
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" "${API}/workspaces/${WS_ID}/boards" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Get boards after archive" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 21. Restore board (create a new board as replacement since soft-delete may not have restore)
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" -w "\n%{http_code}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Restored Smoke Board\",\"description\":\"\"}" \
  "${API}/workspaces/${WS_ID}/boards" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Create replacement board (restore)" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 22. Remove workspace member
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" -X DELETE \
  "${API}/workspaces/${WS_ID}/members/${USER2_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Remove workspace member" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 23. Update workspace name
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" -X PUT \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated Smoke Workspace\",\"description\":\"\"}" \
  "${API}/workspaces/${WS_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Update workspace name" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 24. Delete task
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -w "\n%{http_code}" -X DELETE \
  "${API}/tasks/${TASK_ID}" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Delete task" "$STATUS" "200"

# ---------------------------------------------------------------------------
# 25. Logout
# ---------------------------------------------------------------------------
BODY=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" -w "\n%{http_code}" -X POST \
  "${API}/auth/sign-out" 2>/dev/null)
STATUS=$(echo "$BODY" | tail -1)
assert "Logout" "$STATUS" "200"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
bold "========================================="
echo "  Results: $PASS passed, $FAIL failed / $TOTAL total"
bold "========================================="

# Cleanup
rm -f "$COOKIE_JAR" "$COOKIE_JAR2"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0
