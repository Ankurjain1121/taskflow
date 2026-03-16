# TODOS

## TODO-001: Refactor board membership verification (DRY)
**Priority:** Low | **Depends on:** Phase 1 completion

Extract `verify_project_membership(pool, project_id, user_id)` shared function (created in Phase 1 for time_entries.rs) and replace all ~6 inline copies across:
- `task_crud.rs`
- `task_helpers.rs`
- `task_movement.rs`
- `attachment.rs`
- `comments.rs`

**Why:** DRY violation — each copy is slightly different inline SQL doing `SELECT EXISTS(SELECT 1 FROM project_members ...)`. Risk of divergence if project_members schema changes.

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
