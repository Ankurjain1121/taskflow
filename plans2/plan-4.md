# TaskFlow Competitive Gap Analysis + Implementation Plan

## Context
Comprehensive competitive analysis against 10 industry leaders (Asana, Monday.com, ClickUp, Jira, Trello, Linear, Notion, Todoist, Basecamp, Wrike) identified 50 feature gaps across macro and micro levels. This plan addresses the 18 actionable gaps in Tier 1 (Must-Have) and Tier 2 (Should-Have), organized into 5 independently deployable phases.

**Key discovery:** 2 gaps already closed — API rate limiting (`backend/crates/api/src/middleware/rate_limit.rs`) and My Tasks Today/Upcoming/Later sections (`frontend/src/app/features/my-tasks/my-tasks-timeline/`).

---

## TaskFlow Competitive Strengths (Keep & Leverage)
- Eisenhower Matrix (unique — no competitor has this natively)
- Position-based recurring task assignment with fallback chain (unique)
- 20+ themes with accent colors (ahead of most competitors)
- WIP limits on kanban columns (matches Jira, ahead of ClickUp/Monday)
- Built-in time tracking with running timer (ahead of Asana/Trello/Notion)
- Comprehensive webhook system with delivery logs
- Real-time WebSocket updates
- 11 automation triggers + 11 actions

---

## Phase 1: Core Task Infrastructure (Week 1-2)

### 1.1 Task ID System (BOARD-123) — Medium
Every serious PM tool has human-readable IDs (Jira PROJ-123, Linear LIN-456).

**Backend:**
- New migration: `prefix VARCHAR(10)` on `boards`, `task_number INTEGER` on `tasks`
- `backend/crates/db/src/models/board.rs` — add `prefix` field
- `backend/crates/db/src/models/task.rs` — add `task_number` field
- `backend/crates/api/src/routes/task_crud.rs` — return `short_id` in responses
- `backend/crates/api/src/routes/search.rs` — support searching by short_id
- Backfill existing tasks with sequential numbers ordered by `created_at`

**Frontend:**
- `frontend/src/app/features/board/task-card/task-card.component.ts` — display short_id
- `frontend/src/app/features/board/task-detail/task-detail-header.component.ts` — show copyable short_id
- `frontend/src/app/features/board/board-settings/` — add "Board Prefix" field
- `frontend/src/app/shared/components/global-search/global-search.component.ts` — search by "DEV-42"

### 1.2 Duplicate Tasks — Low
Every competitor has one-click task duplication.

**Backend:**
- `backend/crates/api/src/routes/task_crud.rs` — add `POST /api/tasks/:id/duplicate`
- Deep-copy: task + assignees + labels + subtasks + custom field values, title prefixed "Copy of"

**Frontend:**
- `frontend/src/app/features/board/task-card/task-card.component.ts` — add "Duplicate" to context menu
- `frontend/src/app/features/board/task-detail/task-detail-header.component.ts` — add "Duplicate" button

### 1.3 Column Collapse — Low
Every kanban tool supports collapsing columns. Pure frontend (localStorage persistence).

**Frontend:**
- `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` — add `isCollapsed` signal, collapsed render (40px vertical bar with rotated name + count)
- `frontend/src/app/features/board/board-view/board-state.service.ts` — add `collapsedColumnIds`, persist to localStorage

### 1.4 Inline Quick Task Creation — Medium
Competitors: Linear press `C`, Asana press `Enter` in list, ClickUp press `T`. TaskFlow requires opening a modal.

**Frontend:**
- `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` — replace "Add task" button with inline text input + Enter to create (title only, default medium priority). Keep modal as "More options" fallback
- `frontend/src/app/features/board/board-view/board-state.service.ts` — add `createQuickTask(boardId, columnId, title)`
- Add `Q` keyboard shortcut to focus inline input

---

## Phase 2: Rich Content & Undo (Week 3-4)

### 2.1 Rich Text Editor — High (CRITICAL — #1 UX gap)
TaskFlow: plain text only. Every competitor: rich text with bold, italic, lists, code blocks, embedded images.

**Approach:** TipTap (ProseMirror-based, Angular-compatible, headless). Store HTML in existing `description` TEXT column. Sanitize with `ammonia` crate on backend.

**Backend:**
- Add `ammonia = "4"` to workspace `Cargo.toml`
- `backend/crates/api/src/routes/task_crud.rs` — sanitize `description` before save
- `backend/crates/api/src/routes/comments.rs` — sanitize `content` before save

**Frontend:**
- Add TipTap deps: `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-link`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-image`
- **NEW** `frontend/src/app/shared/components/rich-text-editor/rich-text-editor.component.ts` — shared component with toolbar (bold, italic, strikethrough, headings, lists, task list, link, code block, HR)
- `frontend/src/app/features/board/task-detail/task-detail-description.component.ts` — replace textarea
- `frontend/src/app/features/board/board-view/create-task-dialog.component.ts` — replace textarea
- `frontend/src/app/features/tasks/components/comment-input/comment-input.component.ts` — replace textarea

### 2.2 Comment Reactions (Emoji) — Medium
Quick acknowledgment without typing "OK". Every major competitor has this.

**Backend:**
- New migration: `comment_reactions (id, comment_id, user_id, emoji, created_at)` with unique constraint
- `backend/crates/db/src/models/comment.rs` — add `CommentReaction` struct
- `backend/crates/api/src/routes/comments.rs` — add POST/DELETE `/api/comments/:id/reactions`

**Frontend:**
- **NEW** `frontend/src/app/shared/components/emoji-picker/emoji-picker.component.ts` — curated ~20 common reactions
- `frontend/src/app/features/tasks/components/comment-list/` — render reactions below comments

### 2.3 File Attachments on Comments — Medium
Context gets lost when screenshots aren't attached to the specific comment discussing them.

**Backend:**
- Migration: add `comment_id` (nullable FK) to existing `attachments` table
- `backend/crates/db/src/models/attachment.rs` — add `comment_id: Option<Uuid>`
- `backend/crates/api/src/routes/comments.rs` — include attachments in comment response

**Frontend:**
- `frontend/src/app/features/tasks/components/comment-input/comment-input.component.ts` — add file upload button + drag-and-drop

### 2.4 Undo/Redo (Toast-based) — High
Non-tech users fear making mistakes. Asana/ClickUp provide `Cmd+Z` / toast-based undo.

**Approach:** Toast-based "Undo" for destructive actions (delete, move, archive). 5-second window.

**Backend:**
- `backend/crates/api/src/routes/task_crud.rs` — return deleted task data in response
- `backend/crates/api/src/routes/task_movement.rs` — return previous column_id/position

**Frontend:**
- `frontend/src/app/shared/components/toast/toast.service.ts` — extend with `action: { label, callback }` for undo button
- `frontend/src/app/shared/components/toast/toast.component.ts` — render action button
- **NEW** `frontend/src/app/core/services/undo.service.ts` — captures action snapshots, provides undo callbacks
- `frontend/src/app/features/board/board-view/board-state.service.ts` — wrap delete/move/archive with undo

---

## Phase 3: Views & Navigation (Week 5-6)

### 3.1 Saved Filter Presets / Custom Views — Medium
Users recreate the same filters every session. Every competitor has saved views.

**Backend:**
- New migration: `saved_views (id, board_id, user_id, name, filters JSONB, is_default, is_shared, created_at, updated_at)`
- **NEW** `backend/crates/db/src/models/saved_view.rs`
- **NEW** `backend/crates/api/src/routes/saved_views.rs` — CRUD

**Frontend:**
- **NEW** `frontend/src/app/core/services/saved-view.service.ts`
- `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` — add "Save View" button + "Load View" dropdown

### 3.2 Swimlane Grouping — Medium
Competitors group kanban by assignee, priority, label. TaskFlow has only static task groups.

**Frontend only** (client-side grouping):
- `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` — add "Group by" dropdown
- `frontend/src/app/features/board/board-view/board-state.service.ts` — add `groupBy` signal + `swimlaneData` computed
- **NEW** `frontend/src/app/features/board/swimlane-view/swimlane-view.component.ts`

### 3.3 Table View — Medium
Monday.com's core view. 2nd most-used view after kanban across industry.

**Frontend:**
- `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` — add `'table'` to ViewMode
- **NEW** `frontend/src/app/features/board/table-view/table-view.component.ts` — PrimeNG Table with sortable/filterable columns, inline editing

### 3.4 Breadcrumb Navigation — Low
Persistent breadcrumb: Home > Workspace > Board > [Task]. Layout already has placeholder div.

**Frontend:**
- **NEW** `frontend/src/app/shared/components/breadcrumb/breadcrumb.component.ts`
- **NEW** `frontend/src/app/core/services/breadcrumb.service.ts`
- `frontend/src/app/shared/components/layout/layout.component.ts` — replace placeholder

### 3.5 Card Field Customization — Low
Different teams need different info at a glance. Linear has 15+ toggleable fields per card.

**Frontend:**
- **NEW** `frontend/src/app/features/board/board-toolbar/card-fields-dropdown.component.ts` — checkboxes per field
- `frontend/src/app/features/board/task-card/task-card.component.ts` — conditional rendering
- `frontend/src/app/core/services/user-preferences.service.ts` — add `cardFields` to preferences

---

## Phase 4: Automation & Reminders (Week 7-8)

### 4.1 Task Reminders — High
For non-tech users, forgetting due dates is the #1 productivity killer. Asana/ClickUp/Todoist/Monday all have reminders.

**Backend:**
- New migration: `task_reminders (id, task_id, user_id, remind_at TIMESTAMPTZ, message, is_sent BOOLEAN, created_at)`
- **NEW** `backend/crates/db/src/models/reminder.rs`
- **NEW** `backend/crates/api/src/routes/reminders.rs` — CRUD
- `backend/crates/api/src/main.rs` — background job (60s interval): query due reminders, fire notifications via WebSocket, mark `is_sent = true`

**Frontend:**
- **NEW** `frontend/src/app/core/services/reminder.service.ts`
- **NEW** `frontend/src/app/shared/components/reminder-picker/reminder-picker.component.ts` — presets: 15 min, 1 hour, tomorrow, custom
- `frontend/src/app/features/board/task-detail/task-detail-metadata.component.ts` — add "Set Reminder" button

### 4.2 Automation Conditions UI — Medium
DB `conditions` JSONB field exists but no frontend UI. Without conditions, automations fire too broadly.

**Frontend:**
- `frontend/src/app/features/board/automations/rule-builder.component.ts` — add "Conditions" section between trigger and actions
- **NEW** `frontend/src/app/features/board/automations/condition-row.component.ts` — field selector + operator + value

### 4.3 Pre-Built Automation Templates — Low
Non-tech users don't know what to automate. Monday has "Recipes", ClickUp has 100+ templates.

**Frontend only:**
- **NEW** `frontend/src/app/features/board/automations/automation-templates.ts` — 12 static templates
- **NEW** `frontend/src/app/features/board/automations/template-gallery.component.ts` — modal with categorized cards
- `frontend/src/app/features/board/automations/automation-rules.component.ts` — add "Start from Template" button

### 4.4 Natural Language Date Input — Medium
Todoist: "every third Thursday #Work p1". TaskFlow: strict date picker only.

**Frontend:**
- Add `chrono-node` package (~15KB)
- **NEW** `frontend/src/app/shared/utils/date-parser.ts` — wrapper with curated presets
- **NEW** `frontend/src/app/shared/components/smart-date-input/smart-date-input.component.ts` — accepts NL or date picker, shows parsed preview
- Replace `p-datePicker` in create-task-dialog and task-detail-fields

---

## Phase 5: Reports & Polish (Week 9)

### 5.1 Report Export (PDF/CSV) — Medium
Managers need to share reports with stakeholders who don't use the tool.

**Backend:**
- Add `genpdf = "0.2"` to Cargo.toml
- `backend/crates/api/src/routes/reports.rs` — add `GET /api/boards/:id/reports/export?format=pdf|csv`

**Frontend:**
- `frontend/src/app/features/board/reports-view/reports-view.component.ts` — add "Export" button with format selector

### 5.2 API Rate Limiting Enhancement — Low
Current rate limiting is per-IP only. Add per-user rate limiting for authenticated endpoints.

**Backend:**
- `backend/crates/api/src/middleware/rate_limit.rs` — add `user_rate_limit_middleware` (120 req/min per user)
- Tighten specific routes: file upload (5/min), search (30/min)

---

## Phase Order & Dependencies

```
Phase 1 ──┐
Phase 2 ──┼── Can run in parallel (no dependencies)
Phase 3 ──┘
Phase 4 ──── Soft dependency on Phase 2 (rich text in comments)
Phase 5 ──── Independent
```

---

## Verification Checklist

### Phase 1
- [ ] Create board with prefix "DEV", create tasks -> IDs show DEV-1, DEV-2, DEV-3
- [ ] Search "DEV-2" -> finds task
- [ ] Duplicate task with labels/assignees -> new task "Copy of X" with all metadata
- [ ] Collapse column -> thin bar with rotated name + count; expand restores
- [ ] Type in inline input, press Enter -> task created; Escape closes input

### Phase 2
- [ ] Edit description -> rich text toolbar with bold, lists, links, code blocks
- [ ] Rich text saves and renders correctly
- [ ] Add emoji reaction -> count shows below comment; re-click toggles off
- [ ] Attach file to comment -> preview shows in comment
- [ ] Delete task -> toast with "Undo"; click within 5s -> task restored

### Phase 3
- [ ] Set filters, "Save View" -> view saved; "Load View" -> filters restored
- [ ] Group by assignee -> swimlanes per assignee
- [ ] Table view -> spreadsheet with sortable columns
- [ ] Breadcrumb shows "Home > Workspace > Board"
- [ ] Toggle card fields -> fields appear/disappear on kanban cards

### Phase 4
- [ ] Set reminder "in 15 minutes" -> notification arrives on time
- [ ] Automation with condition (priority = high) -> only fires for high-priority
- [ ] Create from template -> pre-filled rule
- [ ] Type "next friday" in date field -> correct date parsed

### Phase 5
- [ ] Export report as PDF -> downloads with summary
- [ ] Export as CSV -> downloads with data
- [ ] 130 requests in 1 min as user -> rate limited at 120

---

## Success Criteria
- [ ] All 18 new features implemented and verified
- [ ] Zero TypeScript errors (`npx tsc --noEmit`)
- [ ] Backend passes `cargo clippy --workspace --all-targets -- -D warnings`
- [ ] No `console.log` in production code
- [ ] All new routes have auth middleware
- [ ] Rich text HTML sanitized server-side (ammonia)
- [ ] All new DB tables have indexes on FK columns
- [ ] Each phase deployable independently

---

## Future Tiers (Not in This Plan)

**Tier 3** (Next quarter): AI features (smart summaries, NL search), more keyboard shortcuts, system project templates, dashboard sharing, burndown/velocity charts, sprint/cycle management

**Tier 4** (Future): AI autonomous agents, voice-to-task, built-in chat/video, docs/wiki, goals/OKR, SSO/SAML, OAuth2 platform, offline/PWA, marketplace, email-to-task

**Positioning reminder:** Target is between Trello (simplicity) and Asana (power) — simple enough for non-tech users, powerful enough for real teams. Don't over-feature.
