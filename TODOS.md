# TODOS

## TODO-001: Refactor board membership verification (DRY) — RESOLVED
**Priority:** Low | **Status:** Resolved

Resolved by Phase 3D cleanup: `verify_board_membership` wrapper deleted from `task_helpers.rs`, callers migrated to `common::verify_project_membership`. The `verify_board_membership_internal` in `db/queries/mod.rs` renamed to `verify_project_membership_internal`.

Remaining inline copies in `task_crud.rs`, `attachment.rs`, `comments.rs` should migrate to `common::verify_project_membership` incrementally when those files are next touched.

---

## TODO-002: Auth-before-write pattern audit
**Priority:** Medium (security) | **Depends on:** Nothing

Audit all route handlers for the anti-pattern where SQL UPDATE/INSERT executes BEFORE authorization is checked. Found in `column.rs` (rename_status, update_status_type) — likely exists in other route files too.

**Why:** Unauthorized writes can execute before role check. JWT middleware blocks unauthenticated users, but a valid Member-role token could trigger Owner-only writes before the role check catches it.

**Where to start:** `grep -rn "require_editor_access\|require_viewer_access" backend/crates/api/src/routes/` and check if the call comes after any SQL mutation.

---

## TODO-003: Assignee column in list view
**Priority:** Medium | **Depends on:** Phase 1 inline editing

Add assignee column to list-view.component.ts with member-picker dropdown for inline assignment. Requires:
- Loading project members into list view
- Adapting `MemberPickerComponent` for inline cell use
- Handling multi-assignee display (avatar stack)
- PATCH task assignee on selection

**Why:** Zoho's list view shows assignees. Power users expect to reassign from list view without opening task detail.

---

## TODO-004: Per-token session keys for multi-device support
**Priority:** Medium | **Depends on:** Nothing

Change Redis session key from `session:{user_id}` to `session:{user_id}:{token_id}` to support concurrent sessions across devices. Current design: logging in from Device B immediately invalidates Device A's session.

**Why:** Single-session-per-user is a usability problem for users on multiple devices (laptop + phone). Also a DoS vector: an attacker who succeeds with credential stuffing invalidates the victim's real session.

**Where to start:** `middleware/auth.rs:93` (session key construction), `routes/auth.rs:165` (sign-in session creation). Sign-out-all (`revoke_all_other_sessions`) needs to enumerate keys via Redis SCAN or a per-user SET of token IDs.

---

## TODO-005: Rate limiter hardening (bounded DashMap + X-Forwarded-For)
**Priority:** Low | **Depends on:** nginx config access

Two related issues: (1) `middleware/rate_limit.rs` DashMap grows unbounded — an attacker rotating IPs can exhaust memory. Cap with LRU or bounded map. (2) `X-Forwarded-For` first value is trusted from client input, allowing IP spoofing to bypass rate limits.

**Why:** Defense-in-depth. Requires coordinated nginx config change to set `X-Real-IP` from `$remote_addr` and backend change to prefer `X-Real-IP` over `X-Forwarded-For`.

**Where to start:** `middleware/rate_limit.rs` (DashMap), `middleware/mod.rs:29` (IP extraction). nginx config at `/etc/nginx/sites-available/`.

---

## TODO-006: Shared board password in request body
**Priority:** Low | **Depends on:** Frontend shared-board component

Change `/api/shared/{token}?password=...` (GET with password in query string) to `POST /api/shared/{token}` with password in JSON body. Query string passwords appear in server access logs, browser history, and Referrer headers.

**Why:** Password leakage in logs. Requires frontend change in the shared board access component to send POST instead of GET with query param.

**Where to start:** `routes/board_share.rs` (backend), frontend shared-board feature module.

---

## TODO-007: CSP nonce-based script-src
**Priority:** Low | **Depends on:** Frontend build pipeline

Replace `'unsafe-inline'` in `script-src` CSP directive with per-request nonces. Current `unsafe-inline` defeats XSS protection from CSP.

**Why:** Security hardening. Low urgency since the API CSP mainly protects error pages — the Angular SPA serves its own CSP separately.

**Where to start:** `middleware/security_headers.rs:29`. Requires coordinating nonce injection with Angular's index.html serving.

---

## TODO-008: Extract raw SQL from route handlers incrementally
**Priority:** Low | **Depends on:** Nothing

When touching any route file, move its `sqlx::query` calls to `db/src/queries/`. Currently 114 queries across 33 route files bypass the query layer. Track progress per-file.

**Why:** Separation of concerns — route handlers should delegate data access to the query layer. Inline SQL makes it hard to test queries independently and increases risk of inconsistent query patterns.

**Where to start:** Pick any route file being modified for other reasons and extract its SQL to the matching queries module.

---

## TODO-009: Security hardening batch (6 MEDIUM items)
**Priority:** Medium | **Depends on:** Various

Grouped security improvements:
- CSP nonce migration (see TODO-007)
- Per-device sessions (see TODO-004)
- Shared board password from JSON body (see TODO-006)
- Redis-backed rate limiting (replace in-memory DashMap)
- Workspace export email leak audit
- WebSocket cookie-only auth (remove token from query string)

**Why:** Defense-in-depth. None are critical individually but collectively reduce attack surface.

---

## TODO-010: Rate limiter GC error recovery
**Priority:** Low | **Depends on:** Nothing

`rate_limit.rs:42` spawns a background task for garbage collection that can panic silently. Add error logging and restart logic.

**Why:** Silent panic means the GC stops running, and the DashMap grows unbounded until the process restarts.

**Where to start:** `middleware/rate_limit.rs` — wrap the spawned task in a loop with error handling.

---

## TODO-011: Rename frontend board-* files to project-*
**Priority:** Low | **Depends on:** Nothing

Rename feature files to match the project terminology:
- `board-view.component.ts` → `project-view.component.ts`
- `board-settings/` → `project-settings/`
- `board-state.service.ts` → `project-state.service.ts`
- All related files in `features/board/`

**Why:** Consistency with backend naming. Deferred from the board→project rename to limit import path churn in a single PR.

---

## TODO-013: Clean up old team-page code after Command Center ships
**Priority:** Low | **Depends on:** Command Center deployed and stable for 1+ week

Remove old `team-page.component.ts` (941 lines) and its 12 child components in `features/team/` after the Command Center at `/workspace/:id/manage` is confirmed working. The redirects from `/team-page` → `/manage` handle backward compat.

**Why:** Dead code creates maintenance burden and confusion about which component is the 'real' team management page. The Command Center imports workspace sub-components directly — anything left in `features/team/` that isn't imported elsewhere is dead.

**Where to start:** After Command Center is live for 1+ week, `grep -r "team-page\|TeamPage" frontend/src/` to find remaining references. Remove `features/team/` directory and clean up any remaining imports.

---

## TODO-012: Split styles.css into modular files
**Priority:** P3 (Low) | **Depends on:** Nothing

Split `frontend/src/styles.css` (1,644 lines, 2x over 800-line project max) into 4 focused files:
- `tokens.css` (~200 lines): CSS custom properties, :root, html.dark, accent overrides
- `utilities.css` (~300 lines): animations, glass morphism, focus rings, scrollbars
- `components.css` (~400 lines): skeleton loaders, chips, toasts, PrimeNG component fixes
- `primeng-overrides.css` (~400 lines): PrimeNG dark mode fixes, dialog/dropdown/calendar overrides

Import all via `@import` in a thin `styles.css` entry point. Tailwind CSS 4 handles import ordering.

**Why:** File organization rule violation. Monolith mixes tokens, utilities, component styles, animations, and vendor overrides. Makes it hard to find/modify specific token groups.

**Where to start:** `frontend/src/styles.css`. Pure refactor, no behavior change. Verify with `ng build --configuration=production`.
