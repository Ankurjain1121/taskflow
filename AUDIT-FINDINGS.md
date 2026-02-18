# TaskFlow Audit Findings

**Date:** 2026-02-18  
**Audited by:** 5-agent parallel audit  
**Totals:** 10 broken, 12 dangerous, 16 dead

---

## BROKEN (Will cause errors or wrong behavior)

| # | File | Issue |
|---|------|-------|
| 1 | `ws/handler.rs:175-203` | **Tokio Mutex deadlock** — forward_task holds lock across async await |
| 2 | `ws/handler.rs:448-457` | **workspace: channels always rejected** — validate_channel_access missing |
| 3 | `queries/tasks.rs:328-356` | **Can't clear nullable fields** — COALESCE preserves old value |
| 4 | `queries/my_tasks.rs:121-161` | **Sort parameter silently ignored** — _query is dead code |
| 5 | `queries/my_tasks.rs:346` | **Off-by-one in has_more** — last page signals more data |
| 6 | `routes/task.rs:537-562,654-679` | **Missing group_id** in assign/unassign re-fetch |
| 7 | `routes/task.rs:537-562,654-679` | **Missing deleted_at IS NULL** filter |
| 8 | `board-view.component.ts:595-658` | **Stale signal state in drag-drop** corrupts task ordering |
| 9 | `docker-compose.yml` (backend env) | **CRON_SECRET not passed** — cron endpoints fail auth |
| 10 | `docker-compose.yml:382` | **SKIP_INIT has no effect** |

## DANGEROUS (Security holes, resource exhaustion, data integrity)

| # | File | Issue |
|---|------|-------|
| 1 | `routes/invitation.rs:269-295` | **Non-atomic signup** — crash orphans accounts |
| 2 | `routes/invitation.rs:464-535` | **No auth on invitation management** — cross-tenant access |
| 3 | `middleware/rate_limit.rs:61-63` | **Rate limiter bypass** via spoofed X-Forwarded-For |
| 4 | `docker-compose.yml:437` | **MinIO bucket public** — all attachments world-readable |
| 5 | `docker-compose.yml:118` | **MinIO CORS wildcard** |
| 6 | `docker-compose.yml:143` | **Lago SECRET_KEY_BASE** hardcoded default |
| 7 | `docker-compose.yml:305` | **WAHA admin defaults** admin/admin |
| 8 | `queries/recurring.rs:385-463` | **No transaction** on recurring task creation |
| 9 | `reports.rs:163-196` | **CROSS JOIN burndown** — O(tasks x days) Cartesian product |
| 10 | `search.rs:91-108` | **Comment search no membership check** |
| 11 | `team_overview.rs:56-82` | **N*M row fetch** for workload |
| 12 | `tasks.rs:282-315` | **N+M sequential INSERTs** for assignees/labels |

## DEAD (16 items — future cleanup)

1. `backend/crates/api/src/routes/project.rs` — entire file never registered
2. `backend/crates/db/src/queries/projects.rs` — not in mod.rs
3. `backend/crates/db/src/queries/activity.rs` — not in mod.rs
4. `backend/crates/db/src/queries/users.rs` — not in mod.rs
5. `backend/crates/db/src/queries/labels.rs` — not in mod.rs
6. `middleware/audit.rs` — compiled but never applied
7. `middleware/tenant.rs:33,83` — exported but never called
8. `config.rs` — dead fields: database_url, postal_smtp_*, stripe_*
9. `Cargo.toml` — aws-config crate never imported
10. `frontend app.ts/app.html/app.css` — dead duplicate AppComponent
11. `frontend features/auth/login/` — dead LoginComponent
12. `frontend features/auth/register/` — dead RegisterComponent
13. `frontend features/my-tasks/my-tasks.component.ts` — dead iteration
14. `frontend features/team/team.component.ts` — dead TeamComponent
15. `frontend features/project/` (9 files) — ~1,500 lines dead
16. `frontend .postcssrc.json` — duplicate PostCSS config
