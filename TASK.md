# TaskFlow — Zoho Projects Killer Roadmap

## Objective
Transform TaskFlow into a polished Zoho Projects competitor. Cut waste, polish core, expand strategically.

---

## Recent Work (2026-03-17)

### Production Bug Fixes (this session)
- [x] **Portfolio page 404** — Removed `forkJoin` with non-existent `/portfolio/milestones` endpoint; frontend now uses single `GET /portfolio` response with `{ projects, milestones }`
- [x] **Auth refresh race condition** — Rewrote `refresh()` with `shareReplay`+`finalize` pattern; only 1 HTTP call fires regardless of concurrent 401s. Removed `isRefreshInProgress`/`waitForRefresh`. Simplified interceptor.
- [x] **Nginx timeouts** — Added `proxy_connect_timeout 60`, `proxy_send/read_timeout 120` to API block; `proxy_read/send_timeout 3600` to WebSocket block
- [x] **Task-label endpoints** — Created `task_labels.rs` with `GET/POST/DELETE /tasks/{id}/labels[/{label_id}]` (the DB table existed but no API routes)
- [x] **PWA icons** — Generated `icon-192x192.png` and `icon-512x512.png` from SVGs
- [x] **TwoFactorService DI** — Replaced constructor injection with `inject(HttpClient)` pattern

### Performance Sprint (2026-03-17)
- [x] nginx static assets → `Cache-Control: public, immutable`
- [x] DB pool → 30 max / 5 min connections
- [x] `list_projects_by_workspace` → LIMIT 200
- [x] OnPush migration, `@defer`, signals, Redis caching
- [x] FTS indexes, optimized queries, board_columns→project_statuses reference
- [x] Pagination, parallel queries, dashboard caching
- [x] `shareReplay` refCount fix, remove dead features/reports directory
- [x] Defer command palette, remove unused micromatch dep, raise bundle budget

### Features Shipped (2026-03-16 — 2026-03-17)
- [x] 2FA/TOTP authentication with rate limiting and recovery codes
- [x] Project activity feed endpoint and timeline component
- [x] Slack notifications wiring, @mention parsing, notification dispatcher
- [x] PWA service worker + icons, CSV export for burndown charts
- [x] Prometheus metrics endpoint + JSON structured logging
- [x] Email worker, ResendClient, notification dispatcher
- [x] Burndown charts, Sentry integration
- [x] Calendar day view, list view polish, workspace navigation, reduced motion
- [x] Playwright E2E journeys for login, project, kanban, task-detail

### Refactoring & Quality (2026-03-16 — 2026-03-17)
- [x] Complete board→project rename across frontend + backend
- [x] Split oversized components (800-line compliance)
- [x] Dedup membership checks, explicit exports, extract raw SQL to queries
- [x] Signal+ngModel crash fixes, subtask reorder/delete/race fixes
- [x] CSRF validation expansion, interceptor retry fix, shared board password via POST
- [x] XSS escaping, Redis SCAN fix, missing types
- [x] Dark mode variants, CSS var consistency, accent compliance
- [x] ARIA attributes, keyboard access, focus indicators
- [x] CSP hardening, session security, rate limiting, SSRF prevention, brute-force lockout

---

## Still Pending

### Phase 1: POLISH & CLEANUP — COMPLETE
All items shipped. Orphan deletion, Gantt drag-to-reschedule (with document-level mouseup for edge cases), calendar day view, list view column resize (`pResizableColumn`), and sort persistence (`localStorage`) are all implemented.

**Test gap noted:** `gantt-view.component.spec.ts` has no drag interaction tests. Tracked for Phase 2 test coverage pass.

---

### Phase 2: MISSING ESSENTIALS

#### 2.1 Email Notification Pipeline — MOSTLY DONE
- [x] Email provider integration (Postal + Resend)
- [x] Background worker for email queue
- [x] Email templates (HTML + plain text)
- [x] Weekly/daily digest email
- [ ] Honor notification preferences per-event toggle (partial)

#### 2.2 Resource Utilization
- [ ] Backend: assigned tasks per user with hours/deadlines
- [ ] Backend: utilization % per user per week
- [ ] Frontend: resource utilization chart (bar chart per member)
- [ ] Frontend: workload heatmap (overloaded/available)
- [ ] Cross-project utilization view

#### 2.3 Reporting & Charts — MOSTLY DONE
- [x] Burndown chart per project
- [x] Burnup chart per project
- [x] CSV export for charts
- [ ] Task completion rate chart
- [ ] Time tracking: planned vs actual hours
- [ ] Export reports to PDF

#### 2.4 Observability — DONE
- [x] `tracing` crate for structured logging
- [x] Sentry for error tracking
- [x] `/metrics` endpoint for Prometheus
- [x] JSON log format for production

#### 2.5 Deferred from Phase 1
- [ ] Task route consolidation: 7 → 3 files (crud, assignments, mutations)

---

### Phase 3: DIFFERENTIATORS

#### 3.1 Portfolio Dashboard — DONE
- [x] Cross-project status overview table
- [x] Project health indicators (on track / at risk / behind)
- [x] Milestones timeline across projects
- [ ] Portfolio Gantt (milestones across projects)
- [ ] Portfolio resource allocation

#### 3.2 Authentication & Security — MOSTLY DONE
- [x] 2FA (TOTP via authenticator app)
- [x] Rate limiting on public endpoints
- [x] Webhook URL validation (SSRF prevention)
- [x] File upload type/size restrictions
- [ ] SSO/SAML integration

#### 3.3 Document Management
- [ ] Project-level document folders
- [ ] File preview (PDF, images, office docs)
- [ ] File versioning
- [ ] Document search

#### 3.4 Collaboration Upgrades — PARTIALLY DONE
- [x] @mentions in comments and descriptions
- [x] Project activity feed
- [ ] Cross-project activity feed
- [ ] Timesheet approval workflow (submit → approve/reject → lock)

---

### Phase 4: MOAT

#### 4.1 AI Features
- [ ] AI task summaries
- [ ] AI risk alerts ("Task X stuck for 14 days")
- [ ] Natural language task creation
- [ ] AI workload suggestions

#### 4.2 Integrations — PARTIALLY DONE
- [x] Slack integration (notifications)
- [ ] GitHub/GitLab integration (link commits to tasks)
- [ ] Google Calendar sync
- [ ] Zapier/n8n connector

#### 4.3 Client Portal — DONE
- [x] External stakeholder access (read-only + comment)
- [x] Branded portal per workspace (shared boards)

#### 4.4 Mobile & PWA — PARTIALLY DONE
- [x] PWA manifest + service worker + icons
- [ ] Offline task viewing
- [ ] Push notifications (mobile)
- [ ] Responsive design audit

---

## NOT in Scope
| Item | Rationale |
|------|-----------|
| Gantt bar resize | Drag-to-reschedule is sufficient for Zoho parity |
| Gantt dependency drag-create | Dependencies already render as arrows |
| Mobile native app | PWA first |
| Billing/payments | Not needed until SaaS launch |
| Multi-region deploy | Single VPS sufficient |
| Field-level RBAC | Enterprise-only, Phase 5+ |
| In-app chat | Comments + @mentions sufficient |

---

## Progress Log
- [2026-03-15] Phase 0 complete: blueprints, inline editing, timesheet billing
- [2026-03-15] Phase 1 cleanup committed: 137 files, -1,113 net LOC. Delete orphans + consolidate audit/trash/membership + full board→project rename.
- [2026-03-15] Gantt drag-to-reschedule, security fixes, BoardService → ProjectService rename, timer widget, dashboard charts wired.
- [2026-03-16] 40 commits: 2FA, Slack, email pipeline, Prometheus, Sentry, burndown charts, E2E tests, a11y, dark mode, CSP hardening, performance sprint.
- [2026-03-17] Production bug fixes: portfolio 404, auth refresh race condition, nginx timeouts, task-label endpoints, PWA icons, TwoFactorService DI.
