# UltraPlan Review: Task Management Tool

> Generated: 2026-02-05
> Phase: 4/6 - REVIEW
> Review agents: 3 (sections 01-04, 05-08, 09-12)
> Issues found: 22 critical, 37 warnings, 26 suggestions

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 22 | Must fix before implementation |
| WARNING | 37 | Should fix |
| SUGGESTION | 26 | Nice to have |
| **Total** | **85** | -- |

---

## Critical Issues by Theme

### Theme 1: RLS & Multi-Tenancy (5 issues)

| # | Section | Issue | Fix |
|---|---------|-------|-----|
| C1 | S02-04 | No dedicated PostgreSQL `app_user` role -- RLS bypassed if connecting as table owner | Create restricted `app_user` role with `FORCE ROW LEVEL SECURITY` |
| C2 | S02-04 | `SET LOCAL` cannot use parameterized queries -- SQL injection risk | Add UUID regex validation before string interpolation |
| C3 | S02-05 | `setTenantContext` may run on wrong DB connection outside Drizzle transaction | Must use `tx.execute(sql\`SET LOCAL...\`)` inside transaction callback |
| C4 | S02-06 | Sign-up flow never creates a tenant -- `tenantId NOT NULL` will fail | Add tenant creation during sign-up or require invitation link |
| C5 | S01-03 | Dual role model: global `users.role` vs per-workspace `workspaceMembers.role` | Pick one -- recommend per-workspace roles only |

### Theme 2: Schema Duplication & Path Inconsistency (6 issues)

| # | Section | Issue | Fix |
|---|---------|-------|-----|
| C6 | S05-01 | Comments table redefined with different columns (`body` vs `content`, missing `parentId`) | Use S01 schema as single source of truth; S05 enhances it |
| C7 | S06-02 | Attachments table redefined with different column names (`fileKey` vs `storageKey`) | Same -- S06 must reference S01's schema |
| C8 | S05-08 | All Batch 3-4 sections use wrong file paths (`src/server/routers/` vs `src/server/trpc/routers/`) | Align all sections to S01-04 conventions |
| C9 | S05-08 | Schema paths wrong (`src/db/schema/` vs `src/server/db/schema/`) | Same fix -- align to S01 conventions |
| C10 | S11-01 | Audit action enum from S01 conflicts with S11 middleware that uses procedure paths | Map procedure paths to existing enum values |
| C11 | S10-06 | Duplicate color systems: `task-colors.ts` (Tailwind classes) vs `colors.ts` (hex values) | Consolidate into single source of truth |

### Theme 3: Missing tRPC Procedures (4 issues)

| # | Section | Issue | Fix |
|---|---------|-------|-----|
| C12 | S04-06 | `task.assignUser` and `task.unassignUser` referenced but not defined in task router | Add to task router definition in S04-01 |
| C13 | S03-05 | `workspace.updateMemberRole` and `removeMember` referenced but not defined | Add to workspace router in S03-01 |
| C14 | S05-05 | `workspace.searchMembers` needed for @mention autocomplete but never defined | Add to workspace router |
| C15 | S04-05 | `broadcastBoardUpdate()` never called in any task mutation -- real-time is dead code | Add broadcast calls to all S04-01 mutations |

### Theme 4: Billing & Deployment (5 issues)

| # | Section | Issue | Fix |
|---|---------|-------|-----|
| C16 | S09-01 | Trial modeled as separate Lago plan instead of trial period on free plan | Use Lago's native trial period feature |
| C17 | S09-01 | Scaling tiers ($49/50 users, $79/100 users) completely missing | Add plans or document as post-launch |
| C18 | S09-07 | Webhook handler has no idempotency protection -- duplicate processing risk | Store processed event IDs in dedup table |
| C19 | S12-03 | Novu requires MongoDB but none defined in Docker Compose -- Novu will not start | Add MongoDB service or use PG-compatible Novu version |
| C20 | S12-03 | Redis db isolation missing -- Novu and app share db 0, risking key collisions | Assign separate Redis databases to each service |

### Theme 5: Data Integrity (2 issues)

| # | Section | Issue | Fix |
|---|---------|-------|-----|
| C21 | S04-01 | Fractional position indexing has no rebalancing -- positions converge after ~52 moves | Add periodic rebalancing or use string-based fractional indexing |
| C22 | S08-01 | Team overview filters by `status = "archived"` which doesn't exist in the enum | Remove "archived", use only valid enum values |

---

## Key Warnings (Top 15)

| # | Section | Issue |
|---|---------|-------|
| W1 | S01-03 | Better Auth may expect specific table names -- verify against docs before manual schema |
| W2 | S01-05 | `tasks.status` and `columnId` are dual sources of truth -- sync is fragile |
| W3 | S03-01 | Members can create workspaces -- contradicts department-level hierarchy in PRD |
| W4 | S04-02 | `closestCorners` dnd-kit strategy causes erratic cross-column drag behavior |
| W5 | S02-04 | RLS SQL file is decoupled from Drizzle migrations -- easy to forget during deployment |
| W6 | S06-05 | No MinIO CORS configuration -- browser-to-MinIO direct uploads will fail |
| W7 | S06-03 | Presigned URLs point to internal MinIO endpoint -- unusable behind reverse proxy |
| W8 | S07-03 | `notification.create` is a tRPC procedure exposed to clients -- privilege escalation risk |
| W9 | S07-06 | No phone number field on users table -- WhatsApp notifications impossible |
| W10 | S07-06 | No Slack webhook URL storage -- Slack integration is dead code |
| W11 | S08-06 | No server-side Soketi publishing to workspace/user channels -- real-time broken for Team Overview and My Tasks |
| W12 | S09-02 | No `past_due` subscription status -- non-paying customers keep full access |
| W13 | S09-06 | Lago doesn't provide hosted checkout pages -- upgrade flow will break |
| W14 | S11-02 | Audit middleware only covers 3 of 7+ routers -- PRD requires "company-wide" |
| W15 | S12-03 | Postal missing initialization steps and DNS config for email deliverability |

---

## Missing PRD Requirements

| PRD Requirement | Status | Gap |
|----------------|--------|-----|
| 30-day trash bin | MISSING | No `deletedAt` column defined on any table |
| Cmd+K command palette | Not in scope (post-launch) | OK |
| Per-board user membership | MISSING | No `boardMembers` table -- all workspace members see all boards |
| Scaling pricing tiers | MISSING | Only free/trial/pro plans, no $49/$79 tiers |
| Hosted checkout for upgrades | BROKEN | Lago doesn't provide checkout pages |
| WhatsApp notifications | BROKEN | No phone number field on users |
| Slack notifications | BROKEN | No webhook URL storage |
| Overdue task reminders | MISSING | No cron/scheduler for due-date scanning |
| Weekly digest emails | MISSING | No scheduled email digest task |

---

## Auto-Fixable Issues

These can be resolved without user input:

| # | Fix | Sections Affected |
|---|-----|-------------------|
| AF1 | Align all file paths to S01-04 conventions | S05, S06, S07, S08 |
| AF2 | Add missing tRPC procedures to router definitions | S03, S04 |
| AF3 | Add `broadcastBoardUpdate()` calls to all task mutations | S04 |
| AF4 | Fix schema references to use S01 as single source of truth | S05, S06 |
| AF5 | Remove "archived" status reference, use valid enum values | S08 |
| AF6 | Add MongoDB service to Docker Compose for Novu | S12 |
| AF7 | Assign separate Redis databases to each service | S12 |
| AF8 | Add UUID validation for `SET LOCAL` tenant_id | S02 |
| AF9 | Specify `tx.execute()` for `setTenantContext` inside Drizzle transactions | S02 |
| AF10 | Map audit middleware procedure paths to existing enum values | S11 |
| AF11 | Expand audit middleware to all mutation routers | S11 |
| AF12 | Add MinIO CORS configuration task | S06 or S12 |
| AF13 | Add webhook idempotency table and dedup check | S09 |

---

## Decisions Required (User Input Needed)

| # | Decision | Options |
|---|----------|---------|
| D1 | Role model: global or per-workspace? | (a) Per-workspace only (recommended) (b) Global only (c) Both with precedence rules |
| D2 | Tenant creation flow | (a) Auto-create tenant on sign-up (recommended) (b) Invitation-only (c) Both paths |
| D3 | Position indexing strategy | (a) Floating-point with periodic rebalancing (b) String-based fractional indexing library (recommended) |
| D4 | Task status vs column | (a) Derive status from column (single source of truth) (b) Keep both synced (c) Remove status column |
| D5 | Trial model in Lago | (a) Trial period on free plan (recommended) (b) Keep as separate plan |
| D6 | Scaling tiers ($49/$79) | (a) Implement now (b) Stub with enforcement, implement later (recommended) |
| D7 | Payment checkout | (a) Stripe Checkout (hosted page) (b) Custom payment form (c) Defer billing UI to post-launch |
| D8 | Soft delete approach | (a) `deletedAt` column on all major tables (recommended) (b) Separate trash table (c) Hard delete + backup |
| D9 | Board-level access control | (a) Per-board membership table (recommended) (b) All workspace members see all boards |
