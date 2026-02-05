# Product Requirements: Task Management Tool

> Generated: 2026-02-05
> Phase: 3/6 - PLAN
> All 10 sections approved by user

---

## 1. What We're Building

We are building a task management tool that helps teams of 20-100 people organize their work on visual boards. Think of it like a digital wall of sticky notes where everyone can see what needs to be done, who is doing it, and when it is due. The tool is built for established companies where different departments need their own workspace, but managers need to see the big picture across all teams. What makes this different from tools like Trello is that it puts team visibility first -- at a glance, you can see who is overloaded, who has room for more, and whether the team is on track. It also sends notifications through WhatsApp and Slack, not just email, so updates reach people wherever they already communicate.

---

## 2. The Problem

Right now, teams in large departments lose track of who is doing what. Tasks get assigned in meetings or chat messages, then forgotten. Managers ask "what's the status?" because there is no single place to look. When a team member is overloaded, nobody notices until deadlines are missed. Existing tools either cost too much per user for a whole department (Trello Premium at $10/user for 50 people is $500/month), are too complicated for non-technical staff (Jira), or do not show team workload clearly enough (most Kanban tools). There is no affordable, self-hosted option that gives teams visual boards AND gives managers a clear view of who is doing what across the department.

---

## 3. Who It's For

**Primary users: Team Members**
Everyday workers in departments like marketing, operations, HR, or product. They need to see their assigned tasks, update progress, leave comments, and upload files. They are mixed in tech skills -- some are comfortable with apps, others prefer things simple. They mainly use a computer but check their phone for quick updates.

**Secondary users: Managers and Team Leads**
People responsible for a team of 5-20 people within the department. They need to create tasks, assign them, set deadlines, and see at a glance if anyone is overloaded or if things are falling behind. They need a "Team Overview" dashboard that no current tool provides well enough.

**Tertiary users: Admins**
IT staff or department heads who set up the tool, manage user accounts, control permissions, and handle billing. They configure workspaces, boards, and roles.

---

## 4. What It Does

**Must have (launch day):**
- Visual Kanban boards with customizable columns (like To Do, In Progress, Done)
- Create tasks with a title, description, due date, and priority level
- Assign tasks to one or more team members
- Comment on tasks with @mentions to notify people
- Upload files to tasks (images, documents, up to 10MB each)
- Three permission roles: Admin, Manager, Member
- Separate boards per team/department, users can belong to multiple boards
- Team Overview page showing each member's workload and task count
- My Tasks page showing everything assigned to you across all boards
- Drag-and-drop to move tasks between columns
- Notifications: in-app bell, email for assignments and deadlines, Slack channel alerts, WhatsApp via WAHA
- Left sidebar navigation like Linear
- Light and dark mode toggle
- 30-day trash bin for deleted items
- Quick 3-step onboarding with sample board
- Activity log on each task (who did what, when)
- Full audit log for admins (company-wide activity feed)
- Freemium: 1 free board + 15-day premium trial, then $29/month per 20 users

**Should have (soon after launch):**
- Cmd+K command palette for power users
- Keyboard shortcuts for common actions
- Table and calendar views (same data, different visualization)
- Basic search across all tasks

**Nice to have (later):**
- Reports, analytics, burndown charts
- Automations and recurring tasks
- Import from Trello and Jira
- Minimal accessibility (keyboard nav + ARIA labels)

---

## 5. How It Should Feel

**Look:** Minimal layout inspired by Linear, combined with Monday.com's bright, bold color system. Task cards use vivid colors to communicate status and priority at a glance: bright red for urgent/overdue, green for completed, blue for in progress, yellow/orange for needs attention, purple for review. Column headers, priority badges, and labels all use these same bold, saturated colors -- so the board is immediately readable from across the room. The background stays clean (white in light mode, dark gray in dark mode) to let the colorful tasks pop. Professional but energetic.

**Speed:** Every action feels instant. Clicking a button, dragging a task, switching boards -- zero perceived delay. Optimistic updates (screen changes immediately, syncs with server in background) and smart data preloading.

**Navigation:** Left sidebar shows all boards and teams, collapsible. Top area shows current board name and quick filters. Linear's clean sidebar-to-content flow.

**Key screens:** Board view (main workspace), Task detail (slide-over panel), Team overview (workload cards per member), My Tasks (personal list across all boards).

**First experience:** Quick 3-step setup: name workspace, invite team, see colorful sample board with example tasks.

---

## 6. What It Connects To

**Slack:** Send notifications to a Slack channel when tasks are created, assigned, completed, or overdue. Configured per board.

**WhatsApp (via WAHA):** Send task notifications and reminders through your existing WAHA server. Users link their phone number in settings.

**Email:** Transactional emails for task assignments, deadline reminders, and weekly digest summaries. Sent via self-hosted Postal server.

**File Storage (MinIO):** Files uploaded to tasks are stored on your self-hosted MinIO server. S3-compatible. Files up to 10MB per upload.

**Billing (Lago):** Subscription management for the freemium model. Handles plan changes, invoicing, and payment processing via self-hosted Lago.

---

## 7. What It Does NOT Do

- No built-in chat or messaging (use Slack, Teams, or WhatsApp for that)
- No time tracking or timesheets
- No invoicing or client billing (Lago handles subscription billing only)
- No document editing (attach files or paste links, but no Google Docs-style editing)
- No video calls or screen sharing
- No Gantt charts or complex project timelines (keep it board-focused)
- No AI features for launch (smart suggestions, auto-assignment come later)
- No import/export for launch (Trello/Jira import planned for later)
- No mobile app for launch (responsive web app works on phones, native apps come later)

---

## 8. How We'll Know It Works

- A new user can create their first task within 60 seconds of signing up
- A manager can see the full team's workload on one screen within 2 clicks from any page
- Page load times stay under 2 seconds for workspaces with 100 users and 1000 tasks
- Drag-and-drop a task between columns feels instant (under 100ms visual response)
- 99.5% uptime measured monthly
- At least 5 paying teams within 3 months of launch
- Zero data leaks between workspaces (multi-tenant isolation verified by automated tests)
- Notifications delivered within 30 seconds of the triggering event (in-app, email, Slack, WhatsApp)

---

## 9. Business Model

**Model:** Freemium SaaS with flat team pricing.

**Free tier:** 1 board, up to 5 users, basic features. Plus a 15-day free trial of all premium features on sign-up.

**Paid tier:** $29/month for up to 20 users. All features unlocked: unlimited boards, file uploads, all notification channels, audit log, team overview dashboard.

**Scaling:** For teams larger than 20 users, pricing scales in blocks (e.g., $49/month for 21-50 users, $79/month for 51-100 users -- exact tiers to be finalized based on costs).

**Retrial requests:** Handled case by case through admin panel. Managers can grant a second 15-day trial via a manual action.

**Payment:** Processed through Lago (self-hosted billing). Payment gateway to be determined (Stripe if acceptable, or open-source alternative).

---

## 10. Risks & Concerns

1. **Real-time performance at scale.** Keeping boards instant with 100 concurrent users and live updates is technically challenging. Mitigated by using Soketi WebSockets with Redis pub/sub for horizontal scaling.

2. **Self-hosting complexity.** The system has 7+ Docker containers (app, database, MinIO, Soketi, Lago, Postal, WAHA). If one goes down, parts of the system stop working. Mitigated by Docker Compose health checks, restart policies, and a monitoring dashboard.

3. **WhatsApp reliability.** WAHA depends on WhatsApp Web internals which can change without notice. If WhatsApp changes their protocol, notifications may break until WAHA updates. Mitigated by making WhatsApp optional (Slack + email as fallbacks).

4. **Multi-tenant data isolation.** A bug in the permission system could leak one company's tasks to another. Mitigated by PostgreSQL Row-Level Security at the database level (not just application code) and automated security tests.

5. **Email deliverability.** Self-hosted email via Postal may land in spam folders if DNS (SPF, DKIM, DMARC) is not perfectly configured. Mitigated by having a fallback SMTP relay option and clear setup documentation.

---

## PRD Approval Status

| # | Section | Status |
|---|---------|--------|
| 1 | What We're Building | Approved |
| 2 | The Problem | Approved |
| 3 | Who It's For | Approved |
| 4 | What It Does | Approved |
| 5 | How It Should Feel | Approved (revised: added Monday.com bright colors) |
| 6 | What It Connects To | Approved |
| 7 | What It Does NOT Do | Approved |
| 8 | How We'll Know It Works | Approved |
| 9 | Business Model | Approved |
| 10 | Risks & Concerns | Approved |
