# TaskFlow Audit Findings

**Date:** 2026-02-18
**Audited by:** 5-agent parallel audit
**Remediation:** 2026-02-21
**Status: ALL RESOLVED**

---

## BROKEN (10/10 RESOLVED)

| # | File | Issue | Status | Resolution |
|---|------|-------|--------|------------|
| 1 | `ws/handler.rs` | Tokio Mutex deadlock | RESOLVED | Timeout pattern releases lock before await |
| 2 | `ws/handler.rs` | workspace channels rejected | RESOLVED | validate_channel_access checks workspace_members |
| 3 | `queries/tasks.rs` | Can't clear nullable fields | RESOLVED | CASE WHEN pattern with clear_* flags |
| 4 | `queries/my_tasks.rs` | Sort parameter ignored | RESOLVED | Dynamic ORDER BY with sort_by/sort_order params |
| 5 | `queries/my_tasks.rs` | Off-by-one has_more | RESOLVED | fetch limit+1, check raw_count > limit |
| 6 | `routes/task.rs` | Missing group_id in re-fetch | RESOLVED | group_id added to SELECT |
| 7 | `routes/task.rs` | Missing deleted_at IS NULL | RESOLVED | WHERE clause filter added |
| 8 | `board-view.component.ts` | Stale signal in drag-drop | RESOLVED | Uses update() + structuredClone |
| 9 | `docker-compose.yml` | CRON_SECRET not passed | RESOLVED | CRON_SECRET in backend env |
| 10 | `docker-compose.yml` | SKIP_INIT no effect | RESOLVED | Dead config removed |

## DANGEROUS (12/12 RESOLVED)

| # | File | Issue | Status | Resolution |
|---|------|-------|--------|------------|
| 1 | `routes/invitation.rs` | Non-atomic signup | RESOLVED | Wrapped in database transaction |
| 2 | `routes/invitation.rs` | No auth on invitation mgmt | RESOLVED | Workspace membership checks added |
| 3 | `middleware/rate_limit.rs` | Rate limiter bypass | RESOLVED | Uses last X-Forwarded-For IP + Retry-After header |
| 4 | `docker-compose.yml` | MinIO bucket public | RESOLVED | mc anonymous set none in minio-setup |
| 5 | `docker-compose.yml` | MinIO CORS wildcard | RESOLVED | Explicit CORS headers in Caddyfile |
| 6 | `docker-compose.yml` | Lago SECRET_KEY_BASE default | RESOLVED | Required via :? syntax |
| 7 | `docker-compose.yml` | WAHA admin defaults | RESOLVED | Required via :? syntax |
| 8 | `queries/recurring.rs` | No transaction on creation | RESOLVED | pool.begin() transaction |
| 9 | `reports.rs` | CROSS JOIN burndown | RESOLVED | generate_series + LEFT JOIN |
| 10 | `search.rs` | Comment search no membership | RESOLVED | board_members JOIN added |
| 11 | `team_overview.rs` | N*M row fetch workload | RESOLVED | Single query with JOINs + GROUP BY |
| 12 | `tasks.rs` | N+M sequential INSERTs | RESOLVED | Batch INSERT with unnest() |

## DEAD (16/16 RESOLVED)

| # | Item | Status |
|---|------|--------|
| 1-5 | Dead backend routes/queries (project, activity, users, labels) | DELETED (prior session) |
| 6-7 | audit.rs / tenant.rs dead exports | Infrastructure code, retained for future use |
| 8 | config.rs dead fields | Cleaned (prior session) |
| 9 | Cargo.toml aws-config | DELETED (prior session) |
| 10-12 | Dead frontend components (App, Login, Register) | DELETED (prior session) |
| 13 | my-tasks dead iteration | DELETED (prior session) |
| 14 | Dead TeamComponent | DELETED (2026-02-21) |
| 15 | Dead project/ feature (9 files) | DELETED (prior session) |
| 16 | .postcssrc.json duplicate | DELETED (prior session) |

## Security Hardening (added 2026-02-21)

| # | Item | Status |
|---|------|--------|
| S1 | JWT secret startup validation (reject weak/default) | RESOLVED |
| S2 | Global rate limiting (60 req/min all routes, 10 req/min export/import) | RESOLVED |
| S3 | Request ID tracing middleware (X-Request-Id header) | RESOLVED |
| S4 | Explicit CORS headers (no wildcards) | RESOLVED |
| S5 | Novu JWT secret required (no default) | RESOLVED |
