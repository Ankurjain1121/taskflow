#!/usr/bin/env bash
# =============================================================================
# TaskBolt Seed Runner
# =============================================================================
# Creates 20 employees, 5 teams, 4 projects, and 500 tasks in Acme Corp tenant.
#
# Usage:
#   ./scripts/run_seed.sh           # Run seed (idempotent)
#   ./scripts/run_seed.sh --force   # Delete existing acme-seed and re-run
#
# Prerequisites:
#   - Docker Compose stack running (docker compose up -d)
#   - Python3 with argon2-cffi (pip3 install argon2-cffi)
#     OR psql available on the host (port 5432)
#
# Login credentials after seed:
#   alice@acme.com / Admin@123  (admin)
#   bob@acme.com   / Admin@123  (member)
#   ... (all 20 users share the same password)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_SQL="$SCRIPT_DIR/seed_data.sql"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC}  $*"; }

# =============================================================================
# Parse args
# =============================================================================
FORCE=0
for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        -h|--help)
            echo "Usage: $0 [--force]"
            echo "  --force  Delete existing acme-seed tenant and re-run"
            exit 0
            ;;
    esac
done

# =============================================================================
# Load environment from .env file if present (project-level credentials)
# =============================================================================
DOTENV="$(dirname "$SCRIPT_DIR")/.env"
if [ -f "$DOTENV" ]; then
    # shellcheck disable=SC1090
    set -a; source "$DOTENV"; set +a
fi

# =============================================================================
# Database connection helper
# Parse DATABASE_URL if set, otherwise use individual POSTGRES_* vars
# =============================================================================
if [ -n "${DATABASE_URL:-}" ]; then
    # Extract from: postgresql://user:pass@host:port/db
    _db_url="${DATABASE_URL#postgresql://}"
    PGUSER="${_db_url%%:*}";    _db_url="${_db_url#*:}"
    PGPASSWORD="${_db_url%%@*}"; _db_url="${_db_url#*@}"
    PGHOST="${_db_url%%:*}";    _db_url="${_db_url#*:}"
    PGPORT="${_db_url%%/*}";    PGDB="${_db_url#*/}"
else
    PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
    PGHOST="${POSTGRES_HOST:-localhost}"
    PGPORT="${POSTGRES_PORT:-5432}"
    PGUSER="${POSTGRES_USER:-postgres}"
    PGDB="${POSTGRES_DB:-taskbolt}"
fi

export PGPASSWORD

psql_cmd() {
    # Prefer direct psql (faster, no docker overhead)
    if command -v psql &>/dev/null; then
        psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDB" "$@"
    else
        # Fallback: route through docker compose postgres container
        docker compose -f "$(dirname "$SCRIPT_DIR")/docker-compose.yml" \
            exec -T postgres \
            psql -U "$PGUSER" -d "$PGDB" "$@"
    fi
}

# =============================================================================
# Check PostgreSQL is reachable
# =============================================================================
log_step "Checking database connection..."
if ! psql_cmd -c "SELECT 1" > /dev/null 2>&1; then
    log_error "Cannot connect to PostgreSQL at ${PGHOST}:${PGPORT}."
    log_error "Make sure Docker Compose is running: docker compose up -d"
    exit 1
fi
log_info "Database connection OK."

# =============================================================================
# Generate Argon2id hash for 'Admin@123'
# Argon2::default() params: m=19456, t=2, p=1 (matches Rust auth crate)
# =============================================================================
log_step "Generating Argon2id password hash for 'Admin@123'..."

PASS_HASH=""

# Strategy 1: Python argon2-cffi (preferred)
if command -v python3 &>/dev/null; then
    PASS_HASH=$(python3 - <<'PYEOF' 2>/dev/null || true
try:
    from argon2 import PasswordHasher
    ph = PasswordHasher(memory_cost=19456, time_cost=2, parallelism=1)
    print(ph.hash('Admin@123'))
except ImportError:
    pass
PYEOF
    )
fi

# Strategy 2: Install argon2-cffi if python3 is available but module is missing
if [ -z "$PASS_HASH" ] && command -v pip3 &>/dev/null; then
    log_warn "argon2-cffi not found. Attempting to install..."
    pip3 install argon2-cffi --quiet 2>/dev/null || true
    PASS_HASH=$(python3 - <<'PYEOF' 2>/dev/null || true
try:
    from argon2 import PasswordHasher
    ph = PasswordHasher(memory_cost=19456, time_cost=2, parallelism=1)
    print(ph.hash('Admin@123'))
except ImportError:
    pass
PYEOF
    )
fi

# Strategy 3: Use argon2 CLI if available
if [ -z "$PASS_HASH" ] && command -v argon2 &>/dev/null; then
    log_warn "Using argon2 CLI as fallback..."
    PASS_HASH=$(printf 'Admin@123' | argon2 "seedsalt1234567" -id -m 14 -t 2 -p 1 -l 32 -e 2>/dev/null) || true
fi

# Strategy 4: Query existing user hash from database (reuse from any existing user)
if [ -z "$PASS_HASH" ]; then
    log_warn "Trying to reuse password hash from existing database user..."
    PASS_HASH=$(psql_cmd -tAc "SELECT password_hash FROM users LIMIT 1" 2>/dev/null || true)
    PASS_HASH="${PASS_HASH%$'\n'}"  # trim newline
    if [ -n "$PASS_HASH" ]; then
        log_warn "Reusing existing hash — seed users will share that hash (password may differ from Admin@123)"
    fi
fi

if [ -z "$PASS_HASH" ]; then
    log_error "Could not generate a password hash."
    log_error "Fix: pip3 install argon2-cffi"
    exit 1
fi

log_info "Password hash generated successfully (${#PASS_HASH} chars)."

# =============================================================================
# Handle --force: delete existing seed tenant
# =============================================================================
if [ "$FORCE" -eq 1 ]; then
    log_step "--force: removing existing acme-seed tenant and all associated data..."

    # PostgreSQL cascades handle most of this, but we delete top-down
    # just to avoid any FK issues in edge cases.
    psql_cmd -v ON_ERROR_STOP=0 <<'FORCE_SQL'
DO $$
DECLARE
    v_tenant UUID;
    v_ws UUID;
BEGIN
    SELECT id INTO v_tenant FROM tenants WHERE slug = 'acme-seed';
    IF v_tenant IS NULL THEN
        RAISE NOTICE 'No acme-seed tenant found, nothing to delete.';
        RETURN;
    END IF;

    -- Remove workspace-scoped data
    FOR v_ws IN SELECT id FROM workspaces WHERE tenant_id = v_tenant LOOP
        DELETE FROM teams WHERE workspace_id = v_ws;
    END LOOP;

    -- Delete projects (cascades to statuses, task_lists, tasks, etc.)
    DELETE FROM projects WHERE tenant_id = v_tenant;

    -- Delete users (cascades to workspace_members, etc.)
    DELETE FROM workspaces WHERE tenant_id = v_tenant;
    DELETE FROM users WHERE tenant_id = v_tenant;

    -- Delete tenant last
    DELETE FROM tenants WHERE id = v_tenant;

    RAISE NOTICE 'acme-seed tenant and all related data deleted.';
END $$;
FORCE_SQL

    log_info "Existing seed data removed."
fi

# =============================================================================
# Run seed SQL
# psql variable substitution doesn't work inside dollar-quoted DO blocks,
# so we prepend a SET statement to inject the hash as a session variable.
# The DO block reads it with: current_setting('session.pass_hash')
# =============================================================================
log_step "Running seed_data.sql..."

{
    printf "SET session.pass_hash = '%s';\n" "$PASS_HASH"
    cat "$SEED_SQL"
} | psql_cmd

# =============================================================================
# Verification
# =============================================================================
log_step "Verifying seed data..."

VERIFY_OUTPUT=$(psql_cmd -tA <<'VERIFY_SQL'
SELECT
    (SELECT COUNT(*) FROM tenants WHERE slug = 'acme-seed')          AS tenants,
    (SELECT COUNT(*) FROM users
        WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS users,
    (SELECT COUNT(*) FROM workspaces
        WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS workspaces,
    (SELECT COUNT(*) FROM teams
        WHERE workspace_id = (
            SELECT id FROM workspaces
            WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed')
            LIMIT 1))                                                 AS teams,
    (SELECT COUNT(*) FROM projects
        WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS projects,
    (SELECT COUNT(*) FROM tasks
        WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS tasks,
    (SELECT COUNT(*) FROM task_assignees ta
        JOIN tasks t ON ta.task_id = t.id
        WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS assignees,
    (SELECT COUNT(*) FROM subtasks sub
        JOIN tasks t ON sub.task_id = t.id
        WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS subtasks,
    (SELECT COUNT(*) FROM comments c
        JOIN tasks t ON c.task_id = t.id
        WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS comments,
    (SELECT COUNT(*) FROM task_watchers tw
        JOIN tasks t ON tw.task_id = t.id
        WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS watchers,
    (SELECT COUNT(*) FROM task_dependencies td
        JOIN tasks t ON td.source_task_id = t.id
        WHERE t.tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS dependencies,
    (SELECT COUNT(*) FROM time_entries te
        WHERE te.tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed'))
                                                                      AS time_entries;
VERIFY_SQL
)

# Parse results (pipe-separated from psql -tA)
IFS='|' read -r v_tenants v_users v_workspaces v_teams v_projects v_tasks \
               v_assignees v_subtasks v_comments v_watchers v_deps v_time \
               <<< "$VERIFY_OUTPUT"

echo ""
echo "============================================================"
echo "  TaskBolt Seed Verification"
echo "============================================================"
printf "  %-20s %s\n" "Tenants:"      "$v_tenants  (expected: 1)"
printf "  %-20s %s\n" "Users:"        "$v_users  (expected: 20)"
printf "  %-20s %s\n" "Workspaces:"   "$v_workspaces  (expected: 1)"
printf "  %-20s %s\n" "Teams:"        "$v_teams  (expected: 5)"
printf "  %-20s %s\n" "Projects:"     "$v_projects  (expected: 4)"
printf "  %-20s %s\n" "Tasks:"        "$v_tasks  (expected: 500)"
printf "  %-20s %s\n" "Assignees:"    "$v_assignees  (expected: ~625)"
printf "  %-20s %s\n" "Subtasks:"     "$v_subtasks  (expected: ~117)"
printf "  %-20s %s\n" "Comments:"     "$v_comments  (expected: ~80)"
printf "  %-20s %s\n" "Watchers:"     "$v_watchers  (expected: ~62)"
printf "  %-20s %s\n" "Dependencies:" "$v_deps  (expected: ~30)"
printf "  %-20s %s\n" "Time entries:" "$v_time  (expected: 40)"
echo "============================================================"
echo ""

# Priority breakdown
echo "  Priority distribution:"
psql_cmd -c "
SELECT priority, COUNT(*) AS count,
       ROUND(COUNT(*) * 100.0 / 500, 1) AS pct
FROM tasks
WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'acme-seed')
GROUP BY priority
ORDER BY CASE priority
    WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
    WHEN 'medium' THEN 3 WHEN 'low' THEN 4
END;"

echo ""

# Validate counts
ERRORS=0
[ "$v_tenants"   = "1"   ] || { log_error "Expected 1 tenant, got $v_tenants";    ERRORS=$((ERRORS+1)); }
[ "$v_users"     = "20"  ] || { log_error "Expected 20 users, got $v_users";      ERRORS=$((ERRORS+1)); }
[ "$v_teams"     = "5"   ] || { log_error "Expected 5 teams, got $v_teams";       ERRORS=$((ERRORS+1)); }
[ "$v_projects"  = "4"   ] || { log_error "Expected 4 projects, got $v_projects"; ERRORS=$((ERRORS+1)); }
[ "$v_tasks"     = "500" ] || { log_error "Expected 500 tasks, got $v_tasks";     ERRORS=$((ERRORS+1)); }

if [ "$ERRORS" -eq 0 ]; then
    log_info "All checks passed!"
    echo ""
    echo -e "${GREEN}  Login credentials:${NC}"
    echo "    URL:      http://taskflow.paraslace.in  (or http://localhost)"
    echo "    Admin:    alice@acme.com  / Admin@123"
    echo "    Member:   bob@acme.com   / Admin@123"
    echo "    (all 20 accounts use Admin@123)"
    echo ""
else
    log_error "$ERRORS check(s) failed. Review the output above."
    exit 1
fi
