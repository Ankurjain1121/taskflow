# Section 10: Onboarding & Theme System

## Overview
Build the onboarding flow for new users and the theme system. Onboarding has two flows: full 3-step wizard for first user (create org), abbreviated 2-step for invited users. Theme uses Tailwind class strategy with "dark" class on html element. Backend: Rust Axum + SQLx. Frontend: Angular 19.

## Risk: [green]
## Dependencies
- Depends on: 03, 04
- Blocks: 12
- Parallel batch: 4

## TDD Test Stubs
- Test: New user (no token) sees full 3-step wizard
- Test: Invited user (has token) sees abbreviated 2-step
- Test: Sample board creates board_members row for creator with role "editor"
- Test: Sample board tasks have NO status field, assigned to columns
- Test: Theme toggle adds/removes "dark" class on html (not data-theme)
- Test: Theme persists across sessions
- Test: task-colors.ts is single source of truth (no separate colors.ts)

## Tasks

<task type="auto" id="10-01">
  <name>Build onboarding wizard routing with invitation detection</name>
  <files>frontend/src/app/features/onboarding/onboarding/onboarding.component.ts, frontend/src/app/features/onboarding/onboarding.routes.ts, backend/crates/api/src/routes/onboarding.rs</files>
  <action>Add onboarding_completed (boolean default false) column to users table via migration.

Create Angular onboarding.component.ts at route /onboarding. On init: check user's onboarding_completed via GET /api/auth/me; if true, redirect to /dashboard. Read token from query params (?token=xxx). If token present, call GET /api/onboarding/invitation-context?token=xxx (returns { workspace_id, workspace_name, board_ids }). Route: (A) No token -> full 3-step: StepWorkspace, StepInvite, StepSampleBoard. (B) Token present -> abbreviated 2-step: StepWelcome, StepSampleBoard. Step indicator adapts (3 dots vs 2 dots). Next/Back buttons.

Create Rust endpoint GET /api/onboarding/invitation-context?token=uuid -- looks up invitation, returns workspace info and board IDs user is member of.</action>
  <verify>No token shows 3 steps. Token shows 2 steps. Completed user redirects to dashboard.</verify>
  <done>Built onboarding wizard with dual-flow routing based on invitation token.</done>
</task>

<task type="auto" id="10-02">
  <name>Build workspace creation step (full flow only)</name>
  <files>frontend/src/app/features/onboarding/step-workspace/step-workspace.component.ts, backend/crates/api/src/routes/onboarding.rs</files>
  <action>Create Rust endpoint POST /api/onboarding/create-workspace accepting { name, description? }. Creates workspace under user's tenant, adds user as workspace_member. Returns { workspace_id }.

Create step-workspace.component.ts with form: workspace name (required, placeholder "e.g., Marketing Team"), optional description. Guidance text: "This is where your team's boards and tasks will live." On submit, calls endpoint, emits onComplete(workspaceId) to parent. Only shown in full flow.</action>
  <verify>Submitting creates workspace and advances to step 2.</verify>
  <done>Built workspace creation onboarding step with REST endpoint.</done>
</task>

<task type="auto" id="10-03">
  <name>Build team invitation step and welcome step</name>
  <files>frontend/src/app/features/onboarding/step-invite/step-invite.component.ts, frontend/src/app/features/onboarding/step-welcome/step-welcome.component.ts, backend/crates/api/src/routes/onboarding.rs</files>
  <action>Create Rust POST /api/onboarding/invite-members accepting { workspace_id, emails: Vec<String> } (max 10). For existing users: add to workspace. For new: create invitation with 7-day expiry, send email via Postal. Returns { invited, pending }.

Create step-invite.component.ts (full flow step 2): dynamic email input list (start with 1, "Add another" up to 10, X to remove). "Send Invites" button. "Skip this step" link. Calls endpoint on submit.

Create step-welcome.component.ts (abbreviated flow step 1): shows "Welcome to [workspaceName]!" + two large selectable cards: "Explore an existing board" (if boardIds non-empty, navigates directly completing onboarding) and "Create a sample board to learn" (advances to sample board step).</action>
  <verify>Full flow: invite emails creates invitations. Skip works. Abbreviated: welcome shows workspace name with explore/sample options.</verify>
  <done>Built invitation step (full flow) and welcome step (abbreviated flow).</done>
</task>

<task type="auto" id="10-04">
  <name>Build sample board generator</name>
  <files>backend/crates/services/src/sample_board.rs, frontend/src/app/features/onboarding/step-sample-board/step-sample-board.component.ts, backend/crates/api/src/routes/onboarding.rs</files>
  <action>Create sample_board.rs with generate_sample_board(pool, workspace_id, created_by_id, tenant_id) -> Uuid. In single transaction: (1) Create board "Getting Started" with 4 columns: Backlog (a0, #94a3b8, null), To Do (a1, #6366f1, null), In Progress (a2, #3b82f6, null), Done (a3, #22c55e, {"done":true}). (2) Insert board_members row for creator with role "editor". (3) Create 6 tasks across columns by column_id (NO status field): "Explore the Kanban board" (Backlog, low), "Invite your team members" (To Do, medium), "Create your first real task" (To Do, medium), "Try dragging tasks between columns" (In Progress, high), "Set task priorities and due dates" (In Progress, medium), "Complete onboarding" (Done, low). (4) Create 3 labels: Tutorial (#8b5cf6), Quick Win (#22c55e), Important (#ef4444). Attach Tutorial to all tasks. Return board_id.

Create POST /api/onboarding/generate-sample-board accepting { workspace_id }. Calls service. Returns { board_id }.
Create POST /api/onboarding/complete -- sets user's onboarding_completed = true.

Create step-sample-board.component.ts: preview card showing 4 columns + task counts. "Generate" button. After generation, "Go to Dashboard" button that calls /complete then navigates to /workspace/:wid/board/:bid.</action>
  <verify>Sample board has 4 columns, 6 tasks (no status field), 3 labels, board_members row.</verify>
  <done>Built sample board generator with board membership insertion and onboarding completion.</done>
</task>

<task type="auto" id="10-05">
  <name>Build Angular theme provider with class-based dark mode</name>
  <files>frontend/src/app/core/services/theme.service.ts, frontend/src/app/app.component.ts</files>
  <action>Create theme.service.ts as injectable service. Manages theme state: 'light' | 'dark' | 'system'. Stores in localStorage key 'taskflow-theme' AND document.cookie 'taskflow-theme' (for SSR). Exposes: theme signal, resolvedTheme signal ('light' or 'dark'), setTheme(theme) method. On setTheme: if 'dark' -> document.documentElement.classList.add('dark'); if 'light' -> classList.remove('dark'); if 'system' -> check window.matchMedia('(prefers-color-scheme: dark)') and add listener for changes. On init, read from localStorage/cookie. IMPORTANT: Use "dark" class on html element (NOT data-theme attribute). This matches Tailwind darkMode: "class" config.

In app.component.ts, inject ThemeService on init to apply stored theme immediately.</action>
  <verify>Toggle adds/removes "dark" class on html. Persists across refresh. System preference detected.</verify>
  <done>Built theme service with class-based dark mode, cookie + localStorage persistence.</done>
</task>

<task type="auto" id="10-06">
  <name>Extend task-colors.ts with hex values and define CSS custom properties</name>
  <files>frontend/src/app/shared/utils/task-colors.ts, frontend/src/styles.css</files>
  <action>IMPORTANT: Do NOT create separate colors.ts. task-colors.ts (created in S04) is the SINGLE SOURCE OF TRUTH. Add PRIORITY_COLORS_HEX: urgent={bg:'#fee2e2', border:'#ef4444', text:'#dc2626'}, high={bg:'#fef3c7', border:'#f59e0b', text:'#d97706'}, medium={bg:'#dbeafe', border:'#3b82f6', text:'#2563eb'}, low={bg:'#f1f5f9', border:'#94a3b8', text:'#64748b'}. Add getPriorityColorHex(priority) helper.

In styles.css, define CSS custom properties under :root (light) and html.dark (dark) selectors. Follow standard conventions: --background, --foreground, --card, --card-foreground, --border, --muted, --accent, --destructive, --primary. Dark mode uses slightly muted bright colors (reduce lightness 10%). Use html.dark selector (NOT [data-theme='dark']).</action>
  <verify>getPriorityColorHex('urgent') returns hex red. CSS vars switch on html.dark. No colors.ts file exists.</verify>
  <done>Extended task-colors.ts with hex equivalents. CSS custom properties use html.dark selector.</done>
</task>

<task type="auto" id="10-07">
  <name>Apply color system to task cards and UI elements</name>
  <files>frontend/src/app/features/board/task-card/task-card.component.ts, frontend/src/app/features/board/kanban-column/kanban-column.component.ts, frontend/src/app/shared/components/priority-badge/priority-badge.component.ts</files>
  <action>Update task-card.component.ts to use PRIORITY_COLORS from task-colors.ts for left border. Labels use stored hex as background. Due date: red if overdue, amber if today. No status badge on cards (status is column-derived).

Create priority-badge.component.ts: small pill with priority dot circle + capitalized text, using PRIORITY_COLORS Tailwind classes.

Update kanban-column header to show colored dot (8px circle) from column.color or COLUMN_HEADER_COLORS fallback. Task count muted badge. Checkmark icon if statusMapping.done === true.</action>
  <verify>Cards have colored borders. Priority badges correct. Column headers show dots. All visible in light and dark mode.</verify>
  <done>Applied color system from single source of truth task-colors.ts to all UI elements.</done>
</task>

<task type="auto" id="10-08">
  <name>Register onboarding routes</name>
  <files>backend/crates/api/src/routes/mod.rs, frontend/src/app/app.routes.ts</files>
  <action>In Rust routes/mod.rs, register all onboarding endpoints under /api/onboarding prefix: create-workspace, invitation-context, invite-members, generate-sample-board, complete. All are protected routes requiring auth.

In Angular app.routes.ts, add: /onboarding route with onboarding component (lazy loaded), guarded by auth guard. Add /settings/* routes for profile and notification preferences. Ensure sidebar is hidden on onboarding route.</action>
  <verify>All onboarding endpoints accessible. Angular routes resolve correctly. Sidebar hidden during onboarding.</verify>
  <done>Registered all onboarding routes in Rust and Angular.</done>
</task>
