# TaskBolt Fullproof Audit

**Date:** 2026-04-17
**Method:** 50 questions generated from graphify knowledge graph (6,672 nodes, 12,252 edges), investigated by 5 parallel agents reading actual source code.
**Scope:** `backend/crates/` (Rust) + `frontend/src/` (Angular)

---

## Executive Summary

| Severity | Count | % |
|----------|-------|---|
| **ERROR** | 4 | 8% |
| **WARNING** | 19 | 38% |
| **OK** | 27 | 54% |

---

## ERRORS (Must Fix)

### E1. Eisenhower Matrix subtask leak
- **Q11** | `backend/crates/db/src/queries/eisenhower.rs:171`
- Missing `AND t.parent_task_id IS NULL` → subtasks appear as standalone items in matrix
- **Fix:** Add filter to Eisenhower query

### E2. Webhook delivery — no retry, no DLQ
- **Q39** | `backend/crates/services/src/jobs/automation/actions.rs:490`
- Single HTTP POST, failure = permanent loss. No exponential backoff, no dead letter queue, no retry job.
- **Fix:** Add retry w/ backoff (3 attempts), store failures in `webhook_delivery_log` table

### E3. Multi-tenant isolation gap (confirm with Q1+Q46)
- **Q1/Q46** | `backend/crates/db/src/queries/membership.rs:38-42`
- `verify_project_membership()` admin path checks `u.role IN ('admin','super_admin')` but does NOT filter `u.tenant_id = w.tenant_id`
- Admin in Tenant A → can access non-private projects in Tenant B if sharing same DB
- Used by **56+ files** across codebase
- **Fix:** Add `AND u.tenant_id = w.tenant_id` to admin branch

### E4. Orphaned API calls in reports service
- **Q41** | `frontend/src/app/core/services/reports.service.ts:123-199`
- 7 methods call endpoints that don't exist: `/api/reports/burndown`, `/api/reports/burnup`, `/api/reports/export/csv`, etc.
- **Mitigated:** Methods never called by any component (dead code)
- **Fix:** Delete dead methods

---

## WARNINGS (Should Fix)

### Security

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| W1 | Cron secret length leak via timing | `cron.rs:40-41` | Low |
| W2 | MinIO secret in test helpers looks real | `test_helpers.rs:60` | Low |

### Data Integrity

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| W3 | Position race conditions — no locking on concurrent reorders | `tasks.rs:525-557` | Medium |
| W4 | Recurring tasks use UTC only — no user timezone | `recurring.rs`, `recurring_generation.rs` | Medium |
| W5 | FK missing ON DELETE for `tasks.created_by_id`, `comments.author_id`, `comments.parent_id` | `20260205000001_initial.sql:173-174,228` | Medium |
| W6 | Personal board query missing `parent_task_id IS NULL` | `personal_board.rs:57` | Low |

### Error Handling

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| W7 | 2 infra endpoints bypass JSON error envelope | `/metrics/internal`, `/health` routes | Low |
| W8 | ~8 frontend `catchError(() => of([]))` hide failures silently | Multiple Angular services | Medium |
| W9 | Deadline scanner — no retry on DB failure | `deadline_scanner.rs` | Medium |
| W10 | Infra endpoints return non-standard error shapes | `/health`, `/metrics` | Low |

### Cross-Cutting

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| W11 | Automation depth guard bypassed — `spawn_automation_evaluation` always passes `depth: 0` | `mod.rs:345` vs `safety.rs:14` | High |
| W12 | Activity log incomplete — only `record_status_changed` + `record_commented` called by handlers | Route handlers vs `ActivityLogService` methods | High |
| W13 | Comments, deps, milestones, custom fields, favorites, webhooks — no pagination (unlimited results) | `comments.rs:73` + others | Medium |
| W14 | Mentions skip access validation — `extract_mentioned_user_ids` sends notifications without checking project membership | `comments.rs:63` | Medium |
| W15 | Cache inconsistency — write-invalidation only, no consistent read-through | 19 route files | Low |

### Architecture

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| W16 | Phone OTP + workspace export routes have no frontend consumer | Backend routes | Low |
| W17 | 28 Angular components never imported or routed to (dead code) | Various | Low |
| W18 | 13 files exceed 800-line limit | `color-palettes.ts` (1484), `my-work-matrix.component.ts` (1053), `task-detail-sidebar.component.ts` (1034) | Low |

---

## OK (Properly Handled) — 27 items

| # | Topic | Key Finding |
|---|-------|-------------|
| Q2 | JWT expiry | Correct via jsonwebtoken lib + Redis session |
| Q4 | Password reset | Rate-limited, UUID tokens, hashed, single-use, 1hr expiry |
| Q5 | SQL injection | All queries parameterized, LIKE patterns escaped |
| Q6 | WebSocket auth | Cookie or first-message auth, 10s timeout |
| Q7 | File upload validation | MIME allowlist + size limits before presigned URL |
| Q8 | RBAC coverage | All routes have auth middleware, admin uses extractor |
| Q10 | Admin trash auth | AdminUser extractor + tenant-scoped |
| Q12 | DELETE safety | All DELETEs have WHERE, no TRUNCATE |
| Q14 | Transactions | Used for multi-step ops (create task, auth, workspace) |
| Q15 | Batch partial failures | Per-item tracking, successful items commit independently |
| Q18 | N+1 queries | Batch fetching throughout (`ANY($1)`, LATERAL joins) |
| Q19 | Archive relationships | Soft deletes preserve all, cascade restore |
| Q21 | unwrap() safety | Only 2 safe `LazyLock<Regex>` statics |
| Q23 | WebSocket disconnect | Comprehensive cleanup of channels, presence, locks |
| Q24 | Notification failures | Fire-and-log per channel, no blocking |
| Q25 | todo!/unimplemented! | Zero in production code |
| Q26 | 401 redirect | Refresh-then-redirect with return URL |
| Q30 | Import validation | Size limits, field-level fallbacks |
| Q31 | WebSocket tenant isolation | `validate_channel_access()` enforces per-channel |
| Q33 | Circular deps | Clean DAG: api → {services, auth, db} |
| Q36 | Onboarding transaction | Workspace creation uses proper transaction |
| Q38 | Search injection | Parameterized + `escape_like()` |
| Q44 | Empty state handling | UI handles 0 projects gracefully |
| Q47 | TODO/FIXME/HACK | None found |
| Q48 | Dev code in prod | Clean production builds |
| Q49 | Route conflicts | No duplicates |
| Q50 | Deleted task viewing | Handles gracefully |

---

## Priority Fix Order

1. **E3** — Tenant isolation gap (security, affects 56+ files)
2. **W11** — Automation depth guard bypass (can cause infinite chains)
3. **E1** — Eisenhower subtask leak (data correctness, user-facing)
4. **W12** — Activity log incomplete (audit trail gap)
5. **E2** — Webhook no retry (data loss on failure)
6. **W14** — Mentions skip access check (info leak)
7. **W3** — Position race conditions (data corruption under concurrency)
8. **W13** — Unlimited results (DoS vector)
9. **W4** — Recurring TZ (wrong scheduling for non-UTC users)
10. **W8** — Silent frontend errors (bad UX)
11. **E4** — Dead report methods (cleanup)
12. Everything else (low severity)

---

## Detailed Reports

Individual audit reports with full file:line references:
- `graphify-out/.audit_security.md` — Q1-Q10
- `graphify-out/.audit_data_integrity.md` — Q11-Q20
- `graphify-out/.audit_error_handling.md` — Q21-Q30
- `graphify-out/.audit_cross_cutting.md` — Q31-Q40
- `graphify-out/.audit_architecture.md` — Q41-Q50
