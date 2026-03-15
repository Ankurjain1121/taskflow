# TaskFlow — Zoho Projects Killer Roadmap

## Objective
Transform TaskFlow into a polished Zoho Projects competitor. Cut waste, polish core, expand strategically.

## Key Decisions (Eng Review)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | board→project rename in 4 atomic sub-commits | Previous big-bang rename was reverted. Each sub-commit independently buildable. |
| 2 | Gantt: custom SVG drag-to-reschedule only | Mirror Calendar's proven drag pattern. No resize, no dep drag (Phase 2). |
| 3 | Calendar: add day view only | Week/month + drag-to-reschedule already work. |
| 4 | Audit consolidation: shared query fn, keep 2 thin routers | DRY the SQL, not the route files. Minimal diff. |
| 5 | Trash consolidation: same pattern as audit | Consistency. |
| 6 | Task route consolidation (7→3): DEFER to Phase 2 | Reorg during 263-file rename = asking for trouble. |
| 7 | Bundle TODO-001 (DRY membership check) with 1.3 | Already touching those files. |
| 8 | Delete settings.component.ts | Confirmed orphaned — only imported by its own spec. |
| 9 | Rename sequencing: delete orphans → consolidate → rename → polish | Minimize merge conflicts. Delete first = fewer files to rename. |

---

## Completed Work (Phase 0)
- [x] Blueprint status transitions with `allowed_transitions UUID[]`
- [x] Inline list view editing (title, priority, status, due date)
- [x] Timesheet billing (is_billable, billing_rate_cents, report endpoint)
- [x] Auth-before-write fix in column.rs
- [x] All checks pass: cargo check, clippy, tsc --noEmit, prod build

---

## Phase 1: POLISH & CLEANUP (Weeks 1-3)

### Execution Order (CRITICAL — do NOT reorder)

```
Step 1: Delete orphans (1.1)          ← 10 min, zero risk
Step 2: Consolidate backend (1.3)     ← 3 hours, medium risk
Step 3: Rename board→project (1.2)    ← 8-10 hours, high risk (4 sub-commits)
Step 4: Polish views (1.4)            ← 4-5 hours, medium risk
```

### 1.1 Delete Orphaned Code (Step 1)

**Files to delete:**
- [ ] `frontend/src/app/features/settings/profile/` (entire dir — 416 LOC, superseded by profile-section)
- [ ] `frontend/src/app/features/settings/notification-preferences/` (entire dir — 340 LOC, superseded by notifications-section)
- [ ] `frontend/src/app/features/settings/notifications/` (entire dir — 20 LOC stub)
- [ ] `frontend/src/app/features/settings/settings.component.ts` + `.spec.ts` (409 LOC, orphaned — only imported by own spec)

**Verification:** `tsc --noEmit` + `npm run build -- --configuration=production` must pass after deletion.

**Commit:** `refactor: delete orphaned settings components (4 dirs, ~1,185 LOC)`

---

### 1.3 Consolidate Backend Duplicates (Step 2)

#### 1.3a Audit Log Consolidation

**Pattern:** Extract shared query function, keep 2 thin router files as wrappers.

```
BEFORE:                              AFTER:
workspace_audit.rs (212 LOC)         audit_queries.rs (shared, ~150 LOC)
  └─ inline SQL query                  └─ query_audit_log(pool, scope, filters)
admin_audit.rs (242 LOC)             workspace_audit.rs (~60 LOC, thin wrapper)
  └─ nearly identical SQL              └─ calls query_audit_log(Workspace(id))
                                     admin_audit.rs (~60 LOC, thin wrapper)
                                       └─ calls query_audit_log(Tenant(id))
```

- [ ] Create `audit_queries.rs` with shared `AuditScope` enum + `query_audit_log()` fn
- [ ] Refactor `workspace_audit.rs` to use shared fn (thin wrapper)
- [ ] Refactor `admin_audit.rs` to use shared fn (thin wrapper)
- [ ] Unify DTOs: single `AuditLogEntry` + `AuditLogQuery` (rename `WorkspaceAuditQuery`)

#### 1.3b Trash Consolidation

Same pattern as audit:

- [ ] Create `trash_queries.rs` with shared `TrashScope` enum + query/restore/delete fns
- [ ] Refactor `workspace_trash.rs` to thin wrapper
- [ ] Refactor `admin_trash.rs` to thin wrapper

#### 1.3c DRY Membership Check (TODO-001)

- [ ] Extract `verify_project_membership(pool, project_id, user_id) -> Result<ProjectMember>` to shared module
- [ ] Replace inline copies in: `time_entry.rs`, `task_crud.rs`, `task_helpers.rs`, `task_movement.rs`, `attachment.rs`, `comments.rs`

**Verification:** `cargo check --workspace && cargo clippy --workspace -- -D warnings && cargo test`

**Commit:** `refactor: consolidate audit, trash, and membership verification`

---

### 1.2 Complete board→project Rename (Step 3)

#### CRITICAL: Cache key audit BEFORE starting

```
CACHE KEYS TO FIND AND UPDATE:
──────────────────────────────
Search: grep -r "board-full\|board-list\|board-" frontend/src/app/core/services/
Every cache key with "board" MUST become "project" in the same sub-commit
that changes the service using it.
```

#### Sub-commit A: Backend routes + types (~1.5 hours)

- [ ] Rename files: `board.rs` → `project.rs`, `board_share.rs` → `project_share.rs`, `board_types.rs` → `project_types.rs`
- [ ] Rename all DTOs: `BoardResponse` → `ProjectResponse`, `CreateBoardRequest` → `CreateProjectRequest`, etc.
- [ ] Update `mod.rs`: `pub mod project; pub use project::{project_router, ...}`
- [ ] Update endpoint paths: `/api/boards/` → `/api/projects/` (in router registrations)
- [ ] Update all `board` references in other backend route files (59 files reference "board")
- [ ] Update integration test files: `board_tests.rs` → `project_tests.rs`
- [ ] **Verify:** `cargo check --workspace && cargo clippy --workspace -- -D warnings`
- [ ] **Commit:** `refactor(backend): rename board routes and types to project`

#### Sub-commit B: Frontend services (~1.5 hours)

- [ ] Rename `board.service.ts` → `project.service.ts`, class `BoardService` → `ProjectService`
- [ ] Rename `board-share.service.ts` → `project-share.service.ts`, class `BoardShareService` → `ProjectShareService`
- [ ] Update ALL cache keys: `"board-full:"` → `"project-full:"`, etc.
- [ ] Update all imports across ~30 service consumer files
- [ ] **Verify:** `tsc --noEmit`
- [ ] **Commit:** `refactor(frontend): rename board services to project`

#### Sub-commit C: Frontend components + templates (~4 hours)

- [ ] Rename directory: `features/board/` → `features/project/`
- [ ] Rename component files: `board-view.component.ts` → `project-view.component.ts`, etc.
- [ ] Rename component classes: `BoardViewComponent` → `ProjectViewComponent`, etc.
- [ ] Update template selectors: `app-board-view` → `app-project-view`, etc.
- [ ] Update all imports across the codebase
- [ ] **Verify:** `tsc --noEmit`
- [ ] **Commit:** `refactor(frontend): rename board feature to project`

#### Sub-commit D: Routes, tests, docs (~1.5 hours)

- [ ] Update `app.routes.ts`: all lazy-load paths + route configs
- [ ] Keep ONE legacy redirect: `/workspace/:id/board/:bid` → `/workspace/:id/project/:bid`
- [ ] Update WebSocket subscription URLs in `board-websocket.handler.ts`
- [ ] Update all `.spec.ts` test fixtures and mocks
- [ ] Update CSS class names: `.board-root`, `.board-link`, `.board-tree` → `.project-*`
- [ ] Update seed data references
- [ ] Update `CLAUDE.md` (project structure section)
- [ ] Grep for ANY remaining `board` references (except legacy redirect)
- [ ] **Verify:** `tsc --noEmit && npm run build -- --configuration=production`
- [ ] **Commit:** `refactor: complete board → project rename`

---

### 1.4 Polish Existing Views (Step 4)

#### 1.4a Gantt Drag-to-Reschedule

**Pattern:** Mirror Calendar's drag implementation (already proven + tested).

```
CALENDAR PATTERN (copy this):            GANTT ADAPTATION:
──────────────────────────               ─────────────────
onDragStart(event, task)                 onBarMouseDown(event, task)
onDragOver(event)                        onBarMouseMove(event) → compute date from X
onDrop(event, date)                      onBarMouseUp(event) → update task
  └─ optimistic update                    └─ optimistic update
  └─ API call                             └─ API call
  └─ rollback on error                    └─ rollback on error
```

- [ ] Add `mousedown`/`mousemove`/`mouseup` handlers to SVG task bars
- [ ] Compute new `start_date`/`due_date` from mouse X position + zoom level pixel-to-date math
- [ ] Show ghost bar during drag (opacity: 0.5 clone at new position)
- [ ] Snap to day boundaries
- [ ] Optimistic update with rollback on API error (same pattern as Calendar)
- [ ] Update existing Gantt tests: add drag interaction specs

**NOT in this step (Phase 2+):** Bar resize, dependency line drag-create, context menus.

#### 1.4b Calendar Day View

- [ ] Add 'day' option to `calendarView` signal (currently: 'month' | 'week')
- [ ] Implement day view: 24-hour vertical timeline with task blocks
- [ ] Update toggle buttons in template

#### 1.4c List View Minor Polish

- [ ] Column resize (PrimeNG `pResizableColumn` directive)
- [ ] Sort persistence (save to localStorage per project)

**Verification:** `tsc --noEmit && npm run build -- --configuration=production`

**Commit:** `feat: add Gantt drag-to-reschedule, calendar day view, list view polish`

---

## Phase 2: MISSING ESSENTIALS (Weeks 4-8)

### 2.1 Email Notification Pipeline
- [ ] Integrate email provider (SES or SendGrid)
- [ ] Transactional emails: task assigned, due date, comment mention, status change
- [ ] Weekly/daily digest email
- [ ] Honor notification preferences (per-event toggle)
- [ ] Background worker for email queue (separate from API)
- [ ] Email templates (HTML + plain text)

### 2.2 Resource Utilization
- [ ] Backend: assigned tasks per user with hours/deadlines
- [ ] Backend: utilization % per user per week
- [ ] Frontend: resource utilization chart (bar chart per member)
- [ ] Frontend: workload heatmap (overloaded/available)
- [ ] Cross-project utilization view

### 2.3 Reporting & Charts
- [ ] Burndown chart per project
- [ ] Burnup chart per project
- [ ] Task completion rate chart
- [ ] Time tracking: planned vs actual hours
- [ ] Export reports to PDF/CSV
- [ ] Chart library integration (Chart.js — already in package.json)

### 2.4 Observability
- [ ] `tracing` crate for structured logging
- [ ] Sentry for error tracking
- [ ] `/metrics` endpoint for Prometheus
- [ ] JSON log format for production

### 2.5 Deferred from Phase 1
- [ ] Task route consolidation: 7 → 3 files (crud, assignments, mutations)

---

## Phase 3: DIFFERENTIATORS (Weeks 9-14)

### 3.1 Portfolio Dashboard
- [ ] Cross-project status overview table
- [ ] Portfolio Gantt (milestones across projects)
- [ ] Portfolio resource allocation
- [ ] Project health indicators (on track / at risk / behind)

### 3.2 Authentication & Security
- [ ] 2FA (TOTP via authenticator app)
- [ ] SSO/SAML integration
- [ ] Rate limiting on public endpoints
- [ ] Webhook URL validation (SSRF prevention)
- [ ] File upload type/size restrictions

### 3.3 Document Management
- [ ] Project-level document folders
- [ ] File preview (PDF, images, office docs)
- [ ] File versioning
- [ ] Document search

### 3.4 Collaboration Upgrades
- [ ] Cross-project activity feed
- [ ] @mentions in comments and descriptions
- [ ] Timesheet approval workflow (submit → approve/reject → lock)

---

## Phase 4: MOAT (Weeks 15-20)

### 4.1 AI Features
- [ ] AI task summaries
- [ ] AI risk alerts ("Task X stuck for 14 days")
- [ ] Natural language task creation
- [ ] AI workload suggestions

### 4.2 Integrations
- [ ] Slack integration
- [ ] GitHub/GitLab integration (link commits to tasks)
- [ ] Google Calendar sync
- [ ] Zapier/n8n connector

### 4.3 Client Portal
- [ ] External stakeholder access (read-only + comment)
- [ ] Branded portal per workspace

### 4.4 Mobile & PWA
- [ ] PWA manifest + service worker
- [ ] Offline task viewing
- [ ] Push notifications (mobile)
- [ ] Responsive design audit

---

## Failure Modes (Phase 1)

| Codepath | Failure Mode | Test? | Error Handling? | User Sees |
|----------|-------------|-------|-----------------|-----------|
| Rename: cache key mismatch | Stale cache returns old-shaped data | NO → **ADD** | NO → **ADD** | Silent wrong data ← **CRITICAL** |
| Rename: WS subscription URL wrong | Real-time updates stop | NO → **ADD** | Partial (reconnect) | Silent stale board |
| Gantt drag: mouse leaves SVG | Drag state stuck | NO → **ADD** | Add mouseup on document | Ghost bar stuck |
| Gantt drag: API fails | Dates saved locally but not on server | YES (mirror calendar) | YES (rollback) | Toast error |
| Delete orphan: component still imported somewhere | Build fails | YES (tsc --noEmit) | N/A | Build error (caught) |
| Audit consolidation: scope enum wrong | Admin sees workspace-only data or vice versa | NO → **ADD** | Existing auth middleware | Wrong data shown |

**Critical gaps (no test + no error handling + silent):**
1. Cache key mismatch after rename → **must grep ALL cache keys before sub-commit B**
2. WS subscription URL mismatch → **must update websocket handler in sub-commit D**

---

## Architecture Gaps

| Gap | Phase | Priority |
|-----|-------|----------|
| No email pipeline | 2 | P0 |
| No reporting engine | 2 | P0 |
| No portfolio view | 3 | P1 |
| No document management | 3 | P1 |
| No 2FA/SSO | 3 | P1 |
| No structured logging | 2 | P1 |
| No error tracking | 2 | P1 |
| WebSocket horizontal scaling | 4+ | P2 |
| No feature flags | 2 | P2 |
| No virtual scrolling | 2 | P2 |

## Security Gaps

| Gap | Severity | Phase |
|-----|----------|-------|
| No 2FA | HIGH | 3 |
| No SSO/SAML | HIGH | 3 |
| No rate limiting on share endpoints | MED | 2 |
| No webhook URL validation (SSRF) | MED | 2 |
| No file upload restrictions | MED | 2 |

---

## NOT in Scope (Phase 1)
| Item | Rationale |
|------|-----------|
| Task route consolidation (7→3) | Too risky during 263-file rename. Deferred to Phase 2. |
| Gantt bar resize | Phase 2. Drag-to-reschedule is sufficient for Zoho parity. |
| Gantt dependency drag-create | Phase 2. Dependencies already render as arrows. |
| Mobile native app | PWA first (Phase 4). |
| Billing/payments | Not needed until SaaS launch. |
| Multi-region deploy | Single VPS sufficient. |
| Field-level RBAC | Enterprise-only, Phase 5+. |
| In-app chat | Comments + @mentions sufficient. |
| Separate issue tracker | Tasks with labels cover this. |

## What Already Exists
| Sub-problem | Existing Code | Reuse? |
|-------------|--------------|--------|
| Gantt rendering | 429 LOC custom SVG with zoom, deps, bars | YES — add drag handlers |
| Calendar drag | 396 LOC with full drag-to-reschedule | YES — copy pattern for Gantt |
| Audit log querying | 2 files, ~identical SQL | YES — extract shared fn |
| Trash restore/delete | 2 files, ~identical logic | YES — extract shared fn |
| Membership verification | 6 inline copies | YES — extract shared fn |
| Project rename (DB) | Migration already done | YES — code layer only |

---

## Progress Log
- [2026-03-15] Phase 0 complete: blueprints, inline editing, timesheet billing
- [2026-03-15] CEO review: SCOPE EXPANSION mode. 4-phase roadmap.
- [2026-03-15] Eng review: 9 decisions made. Phase 1 sequenced as delete→consolidate→rename→polish. Rename split into 4 atomic sub-commits. Task route consolidation deferred to Phase 2.
- [2026-03-15] Phase 1 cleanup committed (d6621ec): 137 files, -1,113 net LOC. Delete orphans + consolidate audit/trash/membership + full board→project rename.
- [2026-03-15] Gantt drag-to-reschedule implemented: mousedown/move/up on SVG bars, snap-to-day, optimistic update with rollback, ghost bar during drag.
- [2026-03-15] Security fixes committed: audit cursor tenant isolation, ILIKE escaping, trash FK order, deleted_at check.
- [2026-03-15] Phase 2 eng review: plan was 70% overbuilt — backend already done. Revised to frontend wiring + timer widget.
- [2026-03-15] BoardService → ProjectService rename complete (49 files). Floating timer widget added. Dashboard charts already wired.
