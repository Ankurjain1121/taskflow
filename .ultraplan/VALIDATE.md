# Traceability Matrix & Validation Report

> Generated: 2026-02-05
> PRD: 10 sections approved
> Plan: 12 sections, ~90 tasks across 5 batches

---

## Part 1: Requirement to Task Traceability Matrix

### PRD Section 4 -- "What It Does" (Must Have)

| # | PRD Requirement | Section(s) | Task IDs | Coverage |
|---|----------------|------------|----------|----------|
| 4.1 | Visual Kanban boards with customizable columns | S03, S04 | 03-02, 03-03, 03-06, 04-02 | **FULL** |
| 4.2 | Create tasks with title, description, due date, and priority level | S04 | 04-01, 04-06 | **FULL** |
| 4.3 | Assign tasks to one or more team members | S04 | 04-01, 04-06 | **FULL** |
| 4.4 | Comment on tasks with @mentions to notify people | S05 | 05-04, 05-05, 05-07 | **FULL** |
| 4.5 | Upload files to tasks (images, documents, up to 10MB each) | S06 | 06-01, 06-02, 06-03, 06-04, 06-05, 06-06 | **FULL** |
| 4.6 | Three permission roles: Admin, Manager, Member | S02 | 02-03 | **FULL** |
| 4.7 | Separate boards per team/department, users can belong to multiple boards | S03 | 03-02, 03-04, 03-06 | **FULL** |
| 4.8 | Team Overview page showing each member's workload and task count | S08 | 08-01, 08-02, 08-03 | **FULL** |
| 4.9 | My Tasks page showing everything assigned to you across all boards | S08 | 08-04, 08-05 | **FULL** |
| 4.10 | Drag-and-drop to move tasks between columns | S04 | 04-02, 04-04 | **FULL** |
| 4.11a | Notifications: in-app bell | S07 | 07-03, 07-04 | **FULL** |
| 4.11b | Notifications: email for assignments and deadlines | S07 | 07-05, 07-08 | **FULL** |
| 4.11c | Notifications: Slack channel alerts | S07 | 07-06 | **FULL** |
| 4.11d | Notifications: WhatsApp via WAHA | S07 | 07-06 | **FULL** |
| 4.12 | Left sidebar navigation like Linear | S03 | 03-04 | **FULL** |
| 4.13 | Light and dark mode toggle | S10 | 10-05, 10-06 | **FULL** |
| 4.14 | 30-day trash bin for deleted items | S11 | 11-05, 11-06, 11-07 | **FULL** |
| 4.15 | Quick 3-step onboarding with sample board | S10 | 10-01, 10-02, 10-03, 10-04 | **FULL** |
| 4.16 | Activity log on each task (who did what, when) | S05 | 05-02, 05-03, 05-06 | **FULL** |
| 4.17 | Full audit log for admins (company-wide activity feed) | S11 | 11-01, 11-02, 11-03 | **FULL** |
| 4.18 | Freemium: 1 free board + 15-day premium trial, then $29/month per 20 users | S09 | 09-01, 09-02, 09-03, 09-04, 09-05, 09-06, 09-07 | **FULL** |

### PRD Section 4 -- "What It Does" (Should Have)

| # | PRD Requirement | Section(s) | Task IDs | Coverage |
|---|----------------|------------|----------|----------|
| 4.19 | Cmd+K command palette for power users | -- | -- | **POST-LAUNCH** |
| 4.20 | Keyboard shortcuts for common actions | -- | -- | **POST-LAUNCH** |
| 4.21 | Table and calendar views (same data, different visualization) | -- | -- | **POST-LAUNCH** |
| 4.22 | Basic search across all tasks | S04 | 04-07 | **PARTIAL** -- Task 04-07 implements board-level search and filtering (search bar + filters on the board toolbar). However, the PRD says "across all tasks" implying a global cross-board search. The My Tasks page (08-05) has board filtering and sort but no global search bar. Board-level search is implemented; cross-board global search is missing. |

### PRD Section 4 -- "What It Does" (Nice to Have)

| # | PRD Requirement | Section(s) | Task IDs | Coverage |
|---|----------------|------------|----------|----------|
| 4.23 | Reports, analytics, burndown charts | -- | -- | **POST-LAUNCH** |
| 4.24 | Automations and recurring tasks | -- | -- | **POST-LAUNCH** |
| 4.25 | Import from Trello and Jira | -- | -- | **POST-LAUNCH** |
| 4.26 | Minimal accessibility (keyboard nav + ARIA labels) | -- | -- | **POST-LAUNCH** |

### PRD Section 5 -- "How It Should Feel"

| # | PRD Requirement | Section(s) | Task IDs | Coverage |
|---|----------------|------------|----------|----------|
| 5.1 | Minimal layout inspired by Linear, combined with Monday.com bright bold color system | S04, S10 | 04-03, 10-06, 10-07 | **FULL** |
| 5.2 | Task cards use vivid colors for priority (red=urgent, green=done, blue=in-progress, yellow=needs-attention, purple=review) | S04 | 04-03 | **PARTIAL** -- PRIORITY_COLORS defines urgent=red, high=orange, medium=yellow, low=blue. The PRD mentions "purple for review" but there is no "review" priority or status. The Done status color (green) is handled via COLUMN_STATUS_COLORS for done columns. The PRD's specific purple=review color is not mapped since there is no "review" status concept. |
| 5.3 | Column headers, priority badges, and labels use bold saturated colors | S10 | 10-07 | **FULL** |
| 5.4 | Clean background (white in light, dark gray in dark) with colorful tasks | S10 | 10-05, 10-06 | **FULL** |
| 5.5 | Every action feels instant -- optimistic updates, smart preloading | S04 | 04-04 | **FULL** |
| 5.6 | Left sidebar shows all boards and teams, collapsible | S03 | 03-04 | **FULL** |
| 5.7 | Top area shows current board name and quick filters | S04 | 04-07 | **FULL** |
| 5.8 | Key screens: Board view, Task detail (slide-over), Team overview, My Tasks | S04, S08 | 04-02, 04-06, 08-02, 08-05 | **FULL** |
| 5.9 | First experience: Quick 3-step setup -- name workspace, invite team, see sample board | S10 | 10-01, 10-02, 10-03, 10-04 | **FULL** |

### PRD Section 6 -- "What It Connects To"

| # | PRD Requirement | Section(s) | Task IDs | Coverage |
|---|----------------|------------|----------|----------|
| 6.1 | Slack: Send notifications to a Slack channel when tasks are created, assigned, completed, or overdue. Configured per board. | S07 | 07-06 | **PARTIAL** -- Slack notifications are implemented per workspace (`workspaces.slackWebhookUrl`) but the PRD says "configured per board." There is no `slackWebhookUrl` on the `boards` table; it is on the `workspaces` table. Per-board Slack configuration is missing. |
| 6.2 | WhatsApp (via WAHA): Send task notifications and reminders. Users link phone number in settings. | S07 | 07-06, 07-07 | **PARTIAL** -- WhatsApp notifications are implemented. Users have `phoneNumber` on the `users` table (S01). However, there is no explicit "link phone number" settings page where users can add/edit their phone number. The notification preferences page (07-07) handles channel toggles but not phone number input. |
| 6.3 | Email: Transactional emails for task assignments, deadline reminders, weekly digest. Via Postal. | S07 | 07-05, 07-08, 07-09 | **FULL** |
| 6.4 | File Storage (MinIO): Files uploaded to tasks stored on MinIO. S3-compatible. Up to 10MB. | S06 | 06-01, 06-02, 06-03, 06-04, 06-05, 06-06 | **FULL** |
| 6.5 | Billing (Lago): Subscription management for freemium model. Handles plan changes, invoicing, payment processing. | S09 | 09-01, 09-02, 09-03, 09-04, 09-05, 09-06, 09-07 | **FULL** |

### PRD Section 8 -- "How We'll Know It Works"

| # | PRD Requirement | Section(s) | Task IDs | Coverage |
|---|----------------|------------|----------|----------|
| 8.1 | New user can create first task within 60 seconds of signing up | S10, S04 | 10-01 through 10-04, 04-01 | **FULL** -- Onboarding wizard plus task creation flow enables this. Performance target is a UX design goal, not a specific code task. |
| 8.2 | Manager can see full team's workload on one screen within 2 clicks from any page | S08 | 08-01, 08-02 | **FULL** -- Team Overview page accessible from sidebar. |
| 8.3 | Page load times under 2 seconds for 100 users and 1000 tasks | S04, S12 | 04-04, 12-06 | **PARTIAL** -- No explicit performance testing or load testing task exists. Optimistic updates (04-04) and health checks (12-06) help, but there is no dedicated performance benchmark task. |
| 8.4 | Drag-and-drop feels instant (under 100ms visual response) | S04 | 04-04 | **FULL** -- Optimistic updates provide instant visual response. |
| 8.5 | 99.5% uptime measured monthly | S12 | 12-06 | **PARTIAL** -- Health check endpoint exists but no uptime monitoring/alerting task is defined. Restart policies help, but measuring and reporting uptime is not covered. |
| 8.6 | At least 5 paying teams within 3 months of launch | -- | -- | **N/A** -- Business metric, not a technical implementation requirement. |
| 8.7 | Zero data leaks between workspaces (multi-tenant isolation via automated tests) | S02 | 02-04, 02-05 | **FULL** -- RLS policies and tenant context middleware enforce isolation. TDD stubs include isolation tests. |
| 8.8 | Notifications delivered within 30 seconds (in-app, email, Slack, WhatsApp) | S07 | 07-01 through 07-06 | **PARTIAL** -- The notification system is built with fire-and-forget Novu triggers and real-time Soketi. However, no specific latency monitoring or SLA enforcement task exists. |

### PRD Section 9 -- "Business Model"

| # | PRD Requirement | Section(s) | Task IDs | Coverage |
|---|----------------|------------|----------|----------|
| 9.1 | Freemium SaaS with flat team pricing | S09 | 09-01, 09-02, 09-03 | **FULL** |
| 9.2 | Free tier: 1 board, up to 5 users, basic features + 15-day trial | S09 | 09-02, 09-03 | **FULL** |
| 9.3 | Paid tier: $29/month for up to 20 users, all features | S09 | 09-01, 09-03, 09-06 | **FULL** |
| 9.4 | Scaling: $49/month for 21-50 users, $79/month for 51-100 users (stubs) | S09 | 09-03 | **FULL** -- Stub plans `pro_50` and `pro_100` are defined in PLAN_LIMITS. Checkout UI is post-launch. |
| 9.5 | Retrial requests handled case-by-case through admin panel | S09 | 09-07 | **FULL** -- `adminBilling.grantRetrial` procedure exists. |
| 9.6 | Payment processed through Lago; payment gateway TBD (Stripe or alternative) | S09 | 09-01, 09-06, 09-07 | **FULL** -- Stripe chosen as payment gateway. Lago handles subscription lifecycle. |

---

## Part 2: Gap Analysis

### GAP-01: Cross-Board Global Search (PRD 4.22)

- **Requirement:** "Basic search across all tasks"
- **Current state:** Task 04-07 implements board-level search and filters on the board toolbar. The My Tasks page (08-05) has per-board filtering and sorting.
- **What is missing:** A global search bar (accessible from any page, e.g., via the sidebar or header) that searches tasks across all boards the user is a member of, returning results with board context.
- **Should be in:** Section 08 (My Tasks) or a new dedicated search task.
- **Suggested task:** "Create a global search tRPC procedure `search.tasks` that accepts a query string and searches across all tasks the user has access to via boardMembers. Return results with task title, board name, workspace name, and direct links. Add a search input to the sidebar or header that routes to a search results page."

### GAP-02: Slack Notifications Configured Per Board (PRD 6.1)

- **Requirement:** "Configured per board"
- **Current state:** `slackWebhookUrl` is on the `workspaces` table (S01 task 01-04), meaning Slack notifications are configured per workspace, not per board.
- **What is missing:** A `slackWebhookUrl` column on the `boards` table (or a separate `boardIntegrations` table) so each board can have its own Slack channel.
- **Should be in:** Section 01 (schema) and Section 07 (Slack provider).
- **Suggested task:** "Add `slackWebhookUrl` (varchar(512), nullable) to the `boards` table schema. Update the Slack notification provider to read the webhook URL from the board level first, falling back to workspace level if not set. Add a Slack webhook configuration field to the board settings page (S03 task 03-06)."

### GAP-03: User Phone Number Settings Page (PRD 6.2)

- **Requirement:** "Users link their phone number in settings"
- **Current state:** `phoneNumber` exists on the `users` table (S01 task 01-03). WhatsApp notifications use this field (S07 task 07-06). Notification preferences (07-07) control channel toggles.
- **What is missing:** A user profile/settings page where users can add, edit, or remove their phone number. No task creates a `/settings/profile` page with phone number input.
- **Should be in:** Section 07 or Section 10.
- **Suggested task:** "Create a user profile settings page at `/settings/profile` with fields for name, avatar, and phone number. Add a `users.updateProfile` tRPC procedure that updates the user's name, avatarUrl, and phoneNumber. Include phone number validation (E.164 format)."

### GAP-04: Performance Testing (PRD 8.3)

- **Requirement:** "Page load times stay under 2 seconds for workspaces with 100 users and 1000 tasks"
- **Current state:** Optimistic updates are implemented (04-04) but no load testing or performance benchmarking task exists.
- **What is missing:** A performance testing task that simulates 100 concurrent users with 1000 tasks and measures page load times.
- **Should be in:** Section 12 or a new testing section.
- **Suggested task:** "Create a load testing script using k6 or Artillery that simulates 100 concurrent users performing board loads, task creation, and drag-and-drop operations against a seeded database with 1000 tasks. Verify page load times under 2 seconds."

### GAP-05: Uptime Monitoring (PRD 8.5)

- **Requirement:** "99.5% uptime measured monthly"
- **Current state:** Health check endpoint exists (12-06) with degraded status reporting. Docker restart policies are configured.
- **What is missing:** No monitoring/alerting system is defined to actually measure and report uptime over time.
- **Should be in:** Section 12.
- **Suggested task:** "Add an uptime monitoring configuration (e.g., UptimeKuma container or external service) that pings `/api/health` every minute and tracks monthly uptime percentage. Add an optional `uptimekuma` service to docker-compose.yml."

### GAP-06: Purple "Review" Color (PRD 5.2)

- **Requirement:** "purple for review" in the color system description
- **Current state:** `PRIORITY_COLORS` covers urgent (red), high (orange), medium (yellow), low (blue). `COLUMN_STATUS_COLORS` covers default and done. There is no "review" status or priority.
- **What is missing:** The PRD mentions "purple for review" as a color concept. Since there is no "review" priority or status in the data model, this could be handled by allowing users to name a column "Review" and assigning it a purple color via `COLUMN_HEADER_COLORS` (which does include purple `#a855f7`).
- **Assessment:** This is a minor gap. The COLUMN_HEADER_COLORS array includes purple, so a user could create a "Review" column and it would naturally get a purple header. No new task needed -- the existing color system accommodates this. **Downgraded to NOTE, not a true gap.**

### GAP-07: Notification Delivery Latency SLA (PRD 8.8)

- **Requirement:** "Notifications delivered within 30 seconds of the triggering event"
- **Current state:** Fire-and-forget Novu triggers with real-time Soketi for in-app notifications. No latency monitoring.
- **What is missing:** No measurement or enforcement of the 30-second SLA. No logging of notification delivery timestamps.
- **Should be in:** Section 07.
- **Suggested task:** "Add timestamp logging to the notification service that records `triggeredAt` and `deliveredAt` for each notification. Create a `/api/admin/notification-latency` endpoint that reports average and p95 delivery latency over the last 24 hours."

---

## Part 3: Scope Creep Detection

### Tasks NOT directly mapped to a PRD requirement:

| Task ID | Task Name | Section | Verdict | Justification |
|---------|-----------|---------|---------|---------------|
| 01-01 | Initialize Next.js 16 project with tooling | S01 | **NECESSARY** | Foundation infrastructure required for all features |
| 01-02 | Configure Drizzle ORM with PostgreSQL singleton | S01 | **NECESSARY** | Database infrastructure required for all features |
| 01-03 | Create user and account schema tables | S01 | **NECESSARY** | Data model foundation for auth and user management |
| 01-04 | Create workspace and board schema tables | S01 | **NECESSARY** | Data model foundation for boards and workspaces |
| 01-05 | Create task schema with position tracking | S01 | **NECESSARY** | Data model foundation for task management |
| 01-06 | Create comment attachment activity schema tables | S01 | **NECESSARY** | Data model foundation for comments, files, activity |
| 01-07 | Run initial migration and seed data | S01 | **NECESSARY** | Development and testing infrastructure |
| 02-01 | Install and configure Better Auth provider | S02 | **NECESSARY** | Auth infrastructure required for all features |
| 02-02 | Create auth API route and middleware | S02 | **NECESSARY** | Auth infrastructure |
| 02-04 | Set up PostgreSQL RLS policies via Drizzle migration | S02 | **NECESSARY** | Multi-tenant data isolation (PRD risk #4) |
| 02-05 | Create tenant context tRPC middleware | S02 | **NECESSARY** | Multi-tenant infrastructure |
| 02-06 | Build sign-in page and invitation acceptance flow | S02 | **NECESSARY** | Auth UI required for user access |
| 02-07 | Create invitation system | S02 | **NECESSARY** | User onboarding and team building |
| 03-01 | Workspace CRUD tRPC router | S03 | **NECESSARY** | Workspace management infrastructure |
| 03-05 | Build workspace settings page | S03 | **NECESSARY** | Workspace admin functionality |
| 04-05 | Set up Soketi WebSocket real-time sync | S04 | **NECESSARY** | Real-time updates (PRD 5.5 -- instant feel) |
| 05-01 | Verify comments table schema from S01 | S05 | **NECESSARY** | Schema consistency verification |
| 05-02 | Create activity log recording service | S05 | **NECESSARY** | Service layer for activity log feature |
| 05-03 | Integrate activity logging into task mutations | S05 | **NECESSARY** | Connects activity log service to task operations |
| 06-02 | Configure MinIO CORS for browser uploads | S06 | **NECESSARY** | Required for browser-to-MinIO direct uploads |
| 07-01 | Configure Novu client and notification event types | S07 | **NECESSARY** | Notification infrastructure |
| 07-02 | Create notification preferences schema and router | S07 | **NECESSARY** | Enables user notification channel preferences |
| 07-09 | Create weekly digest email job | S07 | **ENHANCEMENT** | PRD mentions "weekly digest summaries" in S6 email description. This is technically covered by PRD 6.3. **Reclassified as NECESSARY.** |
| 08-03 | Add overload threshold configuration and indicator | S08 | **ENHANCEMENT** | The PRD says "see who is overloaded" (S4.8) but the overload banner with configurable threshold goes slightly beyond. Adds value. |
| 08-06 | Add real-time updates to Team Overview and My Tasks | S08 | **NECESSARY** | Supports PRD 5.5 (instant feel) for these pages |
| 09-04 | Integrate plan checks into board and member routers | S09 | **NECESSARY** | Enforces billing limits |
| 09-05 | Build upgrade prompt modal | S09 | **NECESSARY** | UX for billing limit enforcement |
| 10-03b | Build abbreviated welcome step for invited users | S10 | **ENHANCEMENT** | The PRD only specifies a 3-step onboarding wizard. The abbreviated 2-step flow for invited users is not explicitly in the PRD but is a sensible UX improvement. Adds value. |
| 10-06 | Extend task-colors.ts with hex values and CSS custom properties | S10 | **NECESSARY** | Theme system infrastructure |
| 10-08 | Register onboarding router in the app router | S10 | **NECESSARY** | Router registration infrastructure |
| 11-01 | Create audit log recording service with action mapping | S11 | **NECESSARY** | Audit log infrastructure |
| 11-02 | Attach audit middleware to ALL mutation routers | S11 | **NECESSARY** | Full audit coverage for company-wide feed |
| 11-04 | Build user management admin page | S11 | **NECESSARY** | Admin needs to manage users (PRD S3 -- admin persona) |
| 12-01 through 12-10 | All Docker/deployment tasks | S12 | **NECESSARY** | Deployment infrastructure required for self-hosted product |

### Summary of Scope Creep:

| Verdict | Count | Items |
|---------|-------|-------|
| NECESSARY | ~80+ | All infrastructure, schema, auth, service layer tasks |
| ENHANCEMENT | 2 | 08-03 (overload banner), 10-03b (invited user abbreviated onboarding) |
| CREEP | 0 | None found |

**Both ENHANCEMENT items add clear UX value and should be retained.** Neither deviates from the spirit of the PRD. Task 08-03's overload banner directly supports "see who is overloaded" from PRD 4.8. Task 10-03b improves the experience for invited users joining an existing workspace.

---

## Part 4: Cross-Section Consistency Check

### Check 1: All file paths use `src/server/trpc/routers/` convention (not `src/server/routers/`)

**Result: PASS**

All tRPC router files consistently use `src/server/trpc/routers/`:
- S03: `src/server/trpc/routers/workspace.ts`, `src/server/trpc/routers/board.ts`, `src/server/trpc/routers/column.ts`
- S04: `src/server/trpc/routers/task.ts`
- S05: `src/server/trpc/routers/comment.ts`, `src/server/trpc/routers/activity-log.ts` -- explicitly states "NOT `src/server/routers/...`"
- S06: `src/server/trpc/routers/attachment.ts` -- explicitly states "NOT `src/server/routers/...`"
- S07: `src/server/trpc/routers/notification-preferences.ts`, `src/server/trpc/routers/notification.ts` -- explicitly states "NOT `src/server/routers/...`"
- S08: `src/server/trpc/routers/team-overview.ts`, `src/server/trpc/routers/my-tasks.ts` -- explicitly states "NOT `src/server/routers/...`"
- S09: `src/server/trpc/routers/billing.ts`, `src/server/trpc/routers/admin-billing.ts`
- S10: `src/server/trpc/routers/onboarding.ts`
- S11: `src/server/trpc/routers/audit-log.ts`, `src/server/trpc/routers/admin-users.ts`, `src/server/trpc/routers/trash-bin.ts`

**Exception noted in S09 task 09-04:** References `src/server/trpc/routers/boards.ts` (plural) and `src/server/trpc/routers/workspace-members.ts`. The board router file is defined as `board.ts` (singular) in S03-02 and workspace member operations are inside `workspace.ts` (S03-01). This is a file naming inconsistency but NOT a path convention violation. See note below.

**Minor inconsistency in S11 task 11-02:** References `src/server/trpc/routers/tasks.ts` (plural), `src/server/trpc/routers/boards.ts` (plural), `src/server/trpc/routers/workspaces.ts` (plural), `src/server/trpc/routers/comments.ts` (plural), `src/server/trpc/routers/attachments.ts` (plural). The original definitions use singular names: `task.ts`, `board.ts`, `workspace.ts` (via S03-01), `comment.ts`, `attachment.ts`. These are plural/singular mismatches in filenames, not path convention violations. The `src/server/trpc/routers/` prefix is correct.

### Check 2: All file paths use `src/server/db/schema/` convention (not `src/db/schema/`)

**Result: PASS**

All schema files consistently use `src/server/db/schema/`:
- S01: `src/server/db/schema/users.ts`, `src/server/db/schema/workspaces.ts`, `src/server/db/schema/tasks.ts`, `src/server/db/schema/activity.ts`, `src/server/db/schema/index.ts`
- S02: `src/server/db/schema/invitations.ts`
- S07: `src/server/db/schema/notification-preferences.ts`, `src/server/db/schema/notifications.ts` -- explicitly states "NOT `src/db/schema/...`"
- S09: `src/server/db/schema/billing.ts`
- S10: `src/server/db/schema/users.ts` (extending existing)
- S11: `src/server/db/schema/activity.ts` (extending existing)

### Check 3: No section references `tasks.status` field (status derived from column)

**Result: PASS**

Every section correctly derives task status from `boardColumns.statusMapping`:
- S04 (task 04-01): Explicitly states "NOTE: There is NO `status` field -- status is derived from the column's `statusMapping`"
- S04 (task 04-06): Shows status derived from column's statusMapping in the task detail panel
- S04 (task 04-07): States "NOTE: No status filter since status is derived from columns"
- S05 (task 05-01): References `content` column (not body), no status reference
- S08 (task 08-01): Explicitly states "NOTE: Do NOT reference `tasks.status` or `\"archived\"`"
- S08 (task 08-04): States "NOTE: No `statusFilter` based on `tasks.status`"
- S10 (task 10-04): States "tasks do NOT have a `status` field"
- S01 (task 01-05): States "NOTE: There is NO `taskStatus` enum and NO `status` column on tasks"

### Check 4: No section creates duplicate schema tables (S01 is the single source of truth)

**Result: PASS**

- S05 (task 05-01): Explicitly says "DO NOT redefine these tables" and verifies against S01 definitions
- S06 (task 06-04): Explicitly says "defined in S01's `src/server/db/schema/activity.ts` -- DO NOT redefine it"
- S07 (tasks 07-02, 07-03): Create NEW tables (`notificationPreferences`, `notifications`) not already in S01. These are legitimate new schema additions, not duplicates.
- S09 (task 09-02): Creates NEW tables (`subscriptions`, `processedWebhooks`). Note: `processedWebhooks` is also defined in S01 (task 01-06). **POTENTIAL ISSUE:** S01 task 01-06 defines a `processedWebhooks` table and S09 task 09-02 also defines a `processedWebhooks` table. However, S09-02 explicitly creates it as part of `billing.ts` schema file.

**WARNING:** The `processedWebhooks` table is defined in TWO places:
1. S01 task 01-06: in `src/server/db/schema/activity.ts`
2. S09 task 09-02: in `src/server/db/schema/billing.ts`

This is a **duplicate schema definition**. Resolution: The table should only be defined once. Since S09 is the primary consumer (billing webhooks), it could remain there, but S01's definition should be removed (or vice versa). This needs attention before implementation.

**Revised Result: PARTIAL PASS** -- One duplicate found (`processedWebhooks`).

### Check 5: All tRPC routers are registered in `src/server/trpc/routers/index.ts` (not `_app.ts`)

**Result: PASS**

Every section that creates a tRPC router explicitly registers it in `src/server/trpc/routers/index.ts`:
- S03: workspace, board, column routers (03-01, 03-02, 03-03)
- S04: task router (04-01)
- S05: comment, activityLog routers (05-04, 05-06)
- S06: attachment router (06-03)
- S07: notificationPreferences, notification routers (07-02, 07-03)
- S08: teamOverview, myTasks routers (08-01, 08-04)
- S09: billing router (09-06), adminBilling router (09-07)
- S10: onboarding router (10-08) -- has its own dedicated registration task
- S11: auditLog, adminUsers, trashBin routers (11-03, 11-04, 11-06)

No reference to `_app.ts` found anywhere.

### Check 6: All sections reference `boardMembers` for board access control

**Result: PASS**

Board access is consistently enforced via the `boardMembers` table:
- S03 (task 03-02): "MUST verify the user is a member of the board via `boardMembers`"
- S03 (task 03-04): "this only returns boards the user is a member of"
- S04 (task 04-01): "MUST first verify the user is a member of the board via `boardMembers`"
- S06 (task 06-03): "verify the user is a member of that board via `boardMembers`"
- S08 (task 08-04): "across all boards the user is a member of (join with `boardMembers`)"
- S10 (task 10-04): "Inserts a row into `boardMembers` for the creator"

### Check 7: Roles are always checked via `ctx.user.role` (global, not per-workspace)

**Result: PASS**

All permission checks use the global role from the `users` table:
- S02 (task 02-03): "All permissions are based on the global `users.role` field -- there is no per-workspace role"
- S01 (task 01-04): "NOTE: There is NO `role` column on `workspaceMembers`"
- S03 (task 03-01): "updateMemberRole... updates the user's global role in the `users` table"
- S03 (task 03-05): "Role (displayed as a colored badge -- this is the global `users.role`)"
- S08 (task 08-01): "checking `ctx.user.role` (the global role from `users` table)"
- S11 (task 11-03): "middleware checks `ctx.user.role === 'admin'` on the `users` table global role"
- S11 (task 11-04): "updates the user's global `role` column on the `users` table"

Note: `boardMembers` has a `role` field (`viewer`/`editor`) for per-board access granularity, but this is a board-level access role (what you can do on a specific board), not a permission role. Global permissions always come from `ctx.user.role`.

---

## Part 5: Final Verdict

### Coverage Summary

| Category | Count |
|----------|-------|
| Total PRD requirements traced | 40 |
| FULL coverage | 33 |
| PARTIAL coverage | 5 |
| MISSING coverage | 0 |
| POST-LAUNCH (deferred by design) | 6 |
| N/A (business metric) | 1 |

**Coverage percentage (FULL / traceable): 33 / 38 = 86.8%**
(Excluding 6 POST-LAUNCH items and 1 N/A item from the denominator; 5 PARTIAL items reduce the score.)

### Gap Count

| Gap ID | Description | Severity |
|--------|-------------|----------|
| GAP-01 | Cross-board global search | Medium -- "Should Have" item, partially covered |
| GAP-02 | Slack configured per board (not per workspace) | Medium -- PRD explicitly says "per board" |
| GAP-03 | User phone number settings page | Low -- field exists, UI to edit it is missing |
| GAP-04 | Performance/load testing | Low -- operational, not feature |
| GAP-05 | Uptime monitoring | Low -- operational, not feature |
| GAP-07 | Notification latency monitoring | Low -- operational, not feature |

**Total gaps: 6** (2 medium, 4 low)

### Scope Creep Count

| Verdict | Count |
|---------|-------|
| ENHANCEMENT (acceptable) | 2 |
| CREEP (unjustified) | 0 |

### Consistency Check Results

| Check | Result |
|-------|--------|
| 1. File paths use `src/server/trpc/routers/` | PASS (minor singular/plural filename inconsistency in S09, S11) |
| 2. File paths use `src/server/db/schema/` | PASS |
| 3. No `tasks.status` field referenced | PASS |
| 4. No duplicate schema tables | **PARTIAL PASS** -- `processedWebhooks` defined in both S01 and S09 |
| 5. Routers registered in `index.ts` not `_app.ts` | PASS |
| 6. `boardMembers` used for board access | PASS |
| 7. Roles via `ctx.user.role` (global) | PASS |

---

### RECOMMENDATION: NEEDS FIXES (Minor)

The plan is **substantially complete and well-designed**. All Must Have requirements are covered. The architecture is consistent with strong conventions enforced across sections. However, the following items should be addressed before implementation begins:

**Must fix before implementation:**

1. **Resolve `processedWebhooks` duplicate schema definition** (Check 4). Remove the definition from either S01 task 01-06 or S09 task 09-02 and have both sections reference a single source. Recommended: keep it in S01 (since it is a general-purpose idempotency table) and reference it from S09.

2. **Add `slackWebhookUrl` to `boards` table** (GAP-02). The PRD explicitly says Slack notifications are "configured per board." Move or duplicate the column from `workspaces` to `boards` and update the Slack provider in S07.

3. **Add user profile settings page with phone number input** (GAP-03). Users need a way to link their phone number for WhatsApp notifications as stated in PRD S6.2.

**Should fix (recommended but not blocking):**

4. **Fix singular/plural filename inconsistencies** in S09 task 09-04 and S11 task 11-02 to match the canonical names established in S03-S06.

5. **Clarify global search scope** (GAP-01). Either upgrade the board-level search in 04-07 to include cross-board search, or add a dedicated global search task.

**Can defer to post-launch:**

6. Performance load testing (GAP-04)
7. Uptime monitoring (GAP-05)
8. Notification latency monitoring (GAP-07)
