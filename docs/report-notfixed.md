# Unfixed Issues — Security & Brutal Review Audit (2026-03-16)

## Architecture Debt (Large Refactors Required)

### CRITICAL: Raw SQL in Route Handlers
- **112 instances** of `sqlx::query*` across 33 route files in `backend/crates/api/src/routes/`
- Worst offender: `task_crud.rs` (4 raw queries for diff, done status, username, non-done status)
- `common.rs` has raw `SELECT EXISTS(...)` for membership — duplicated in `task_helpers.rs` and `db/queries/mod.rs`
- **Fix:** Move all raw SQL to `backend/crates/db/src/queries/` and expose typed functions

### CRITICAL: God Files (>800 lines)
| File | Lines | Responsibilities |
|------|-------|-----------------|
| `backend/crates/services/src/jobs/automation_executor.rs` | 1387 | Rule parsing, execution, name resolution, rate limiting, circuit breaking |
| `frontend/.../board-settings/board-settings.component.ts` | 1440 | Members, labels, columns, danger zone, invites, roles |
| `frontend/.../task-card/task-card.component.ts` | 1413 | Rendering, inline edit, drag-drop, context menu, timer, shortcuts |
| `frontend/.../task-detail/task-detail.component.ts` | 1194 | 8+ sub-sections with business logic inline |
| `frontend/.../board-view/board-state.service.ts` | 616 | State service imported by shared/ (boundary violation) |

### HIGH: Broken Materialized Views
- `backend/crates/db/src/migrations/20260310000001_metrics_materialized_views.sql`
- References dropped tables: `boards`, `board_columns`, `column_id`, `status_mapping`
- Broken since `20260316000001_projects_architecture.sql` migration
- Metrics cron silently serves empty/stale data
- **Fix:** Drop and rewrite views against `projects` and `project_statuses`

### HIGH: shared/ -> features/ Import Violation
- `frontend/src/app/shared/components/board-presence/board-presence.component.ts` imports `ProjectStateService` from `features/board/`
- **Fix:** Move `ProjectStateService` to `core/services/` or move presence component into `board` feature

### HIGH: Ambiguous Glob Re-exports
- `backend/crates/db/src/queries/mod.rs` line 1: `#![allow(ambiguous_glob_reexports)]`
- 45 wildcard `pub use module::*` — name collisions invisible to callers
- **Fix:** Replace with explicit re-exports

### HIGH: Board/Project Naming Schism
- `Board`/`Project` type aliases coexist in `db/src/models/board.rs`
- Route files use `board_id`, DB models use `project_id`, error strings mixed
- `board-view.component.ts` filename doesn't match `ProjectViewComponent` class name
- **Fix:** Complete the rename in one pass

---

## Security (MEDIUM priority, next sprint)

### MEDIUM: CSP allows unsafe-inline
- `backend/crates/api/src/middleware/security_headers.rs:29`
- `script-src 'self' 'unsafe-inline'` defeats XSS protection
- **Fix:** Migrate to nonce-based CSP

### MEDIUM: Session key collision (single session per user)
- `backend/crates/api/src/middleware/auth.rs:93` — key is `session:{user_id}`
- One login replaces all other sessions
- **Fix:** Use `session:{user_id}:{token_id}` for per-device sessions

### MEDIUM: Tokens in JSON response body
- `backend/crates/api/src/routes/auth.rs:53-58`
- Access + refresh tokens returned in both cookies AND JSON body
- **Fix:** Return only in cookies for browser clients

### MEDIUM: In-memory rate limiter (not distributed)
- `backend/crates/api/src/middleware/rate_limit.rs` — DashMap lost on restart
- **Fix:** Move to Redis-backed rate limiting

### MEDIUM: Workspace export leaks member emails
- `backend/crates/api/src/routes/workspace_export.rs:156-162`
- Any member can enumerate all colleagues' email addresses
- **Fix:** Restrict email field to admins/managers only

### MEDIUM: WebSocket query param auth (token in URL)
- `backend/crates/api/src/ws/handler.rs:31-32`
- Token appears in server logs, browser history, referrer headers
- **Fix:** Remove query param auth, rely on cookie-based approach only

### LOW: No per-account brute-force lockout
- IP-based rate limiting exists but no per-email lockout
- **Fix:** Track failed attempts in Redis keyed by email, lock after N failures

---

## Performance (MEDIUM priority)

### MEDIUM: Missing LIMIT on task list queries
- `backend/crates/db/src/queries/task_views.rs` — `list_tasks_flat`, `list_tasks_for_gantt`
- No LIMIT clause — unbounded for large boards
- **Fix:** Add server-side pagination or reasonable LIMIT

### MEDIUM: get_task_by_id makes 6 sequential queries
- `backend/crates/db/src/queries/tasks.rs:198-294`
- **Fix:** Parallelize with `tokio::join!` or merge with JOINs

### MEDIUM: Redis KEYS command in cache_del_pattern
- `backend/crates/api/src/services/cache.rs:39-53`
- O(N) blocking scan of entire keyspace — currently dead code but dangerous if wired up
- **Fix:** Replace with iterative `SCAN` cursor loop

### LOW: Dashboard endpoints missing Redis caching
- 5 of 7 dashboard sub-endpoints have no caching
- **Fix:** Add cache with short TTL (30-60s)

---

## Quality (LOW priority)

### Missing tests for is_password_strong
- `backend/crates/api/src/routes/auth.rs:82-87`
- Security-critical function with 0 tests, shared across 3 call sites

### Rate limiter GC task has no error recovery
- `backend/crates/api/src/middleware/rate_limit.rs:42`
- Spawned tokio task can panic silently — map grows unbounded

### Misplaced files in routes/
- `audit_queries.rs`, `trash_queries.rs`, `board_types.rs` are DTOs/utilities, not route handlers
- Should live in a `shared/` or `helpers/` submodule

### Triplicated membership check
- `verify_project_membership` exists in `routes/common.rs`, `routes/task_helpers.rs`, and `db/queries/mod.rs`
- **Fix:** Single source of truth in db crate
