# Competitive Gap Fixes: Board Feature Parity Plan

## Context

Competitive research against Trello, Asana, Monday.com, Jira, ClickUp, Notion, Linear, Basecamp, Shortcut, and Todoist revealed that TaskBolt has a strong foundation (6 views, automations, time tracking, recurring tasks, WebSocket, templates, webhooks) but is missing critical collaboration features and dozens of polish micro-interactions that make competitors production-ready. This plan addresses the highest-impact gaps in priority order.

**Key finding:** Several features are 90%+ built with backend/infrastructure complete but missing the final UI wiring. These are quick wins.

---

## Phase 1: Wire Up "Almost Done" Features (Quick Wins)

### 1A. Activate Comments & Attachments in Task Detail
**Why:** Biggest gap. Backend API + frontend services + attachment components ALL exist. Only the activity tab stub needs replacement.
**Files:**
- `frontend/src/app/features/board/task-detail/task-detail-activity.component.ts` — **Replace** 45-line stub with real implementation
- Reuse existing: `CommentService` (`core/services/comment.service.ts`), `AttachmentService` (`core/services/attachment.service.ts`), `AttachmentListComponent`, `FileUploadZoneComponent`

**Implementation:**
- Build a comment list that loads via `CommentService.listByTask(taskId)`, displays comments with author avatar/name, relative timestamps, and `@mention` rendering
- Add a comment compose textarea with submit on Enter (Shift+Enter for newline)
- Wire `AttachmentListComponent` and `FileUploadZoneComponent` below comments
- Support `parent_id` for threaded replies (visual indentation, "Reply" button per comment)
- Edit/delete own comments (CommentService already has `update()` and `delete()`)

### 1B. Add Comment Count Badge to Task Cards
**Why:** `comment_count` data already flows through `TaskWithBadges` → state → card input. Just needs rendering.
**File:** `frontend/src/app/features/board/task-card/task-card.component.ts`

**Implementation:**
- Add a new `commentCount` input (or read from `task()`)
- Render speech-bubble SVG + count in the bottom row (after subtask progress), only when count > 0
- Style: `text-[11px] font-medium text-[var(--muted-foreground)]`

### 1C. Wire Up Bulk Selection Trigger
**Why:** `BulkActionsBarComponent`, `selectedTaskIds` signal, and `toggleTaskSelection()` all exist. No UI trigger.
**Files:**
- `frontend/src/app/features/board/task-card/task-card.component.ts` — Add Ctrl/Cmd+click handler
- `frontend/src/app/features/board/board-view/board-view.component.ts` — Pass selection state to cards

**Implementation:**
- On card click, check `event.ctrlKey || event.metaKey`. If true, call `boardState.toggleTaskSelection(task.id)` instead of navigating
- Add a visible checkbox on card hover (top-left, before labels) that toggles selection
- Show selected state with `ring-2 ring-primary` styling on card

### 1D. Add Label Filter to Toolbar
**Why:** `labelIds` filter state, URL persistence, and `filterTasks()` logic all work. Just missing the dropdown.
**File:** `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`

**Implementation:**
- Add `labels` input to toolbar component (from `boardState.allLabels`)
- Add `<p-multiSelect>` for labels between the assignee filter and date pickers
- Use colored dot template item (same pattern as priority filter)
- Emit label changes to parent via existing filter output mechanism

### 1E. Add WIP Limit Input to Column Manager
**Why:** DB column, API update, and kanban warning banner all work. Missing a number input in settings.
**File:** `frontend/src/app/features/board/column-manager/column-manager.component.ts`

**Implementation:**
- Add `<input type="number" min="0">` per column row, bound to `column.wip_limit`
- On blur/change, call the existing `updateColumn()` API with `wip_limit` in payload
- Label: "WIP" with a small tooltip explaining work-in-progress limits

### 1F. Wire Up Card Three-Dot Context Menu
**Why:** Button renders on hover but has no action. Need a PrimeNG popover menu.
**File:** `frontend/src/app/features/board/task-card/task-card.component.ts`

**Implementation:**
- Add a PrimeNG `Menu` or `Popover` triggered by the three-dot button click
- Menu items: Set Priority (submenu), Move to Column (submenu), Copy Link, Delete
- Emit events to parent for priority change, column move, delete actions
- Keep it lightweight — 4-5 items max

---

## Phase 2: Critical Missing Features

### 2A. Task ID Numbering System
**Why:** Teams can't verbally reference tasks. Every serious PM tool has this (Jira: PROJ-123, Linear: ENG-123).
**Files:**
- New migration: `backend/crates/db/src/migrations/YYYYMMDD_task_numbering.sql`
- `backend/crates/db/src/models/task.rs`
- `backend/crates/db/src/queries/tasks.rs` + `boards.rs`
- `frontend/src/app/features/board/task-card/task-card.component.ts`
- `frontend/src/app/core/services/task.service.ts`

**Implementation:**
- Add `task_number SERIAL` column to `tasks` table, scoped per board via a trigger/sequence:
  ```sql
  ALTER TABLE tasks ADD COLUMN task_number INTEGER;
  -- Backfill existing tasks
  -- Add per-board auto-increment trigger
  ```
- Add `board_prefix VARCHAR(6)` to `boards` table (default: first 2-3 chars of board name, uppercase)
- Display as `{prefix}-{number}` (e.g., `TF-42`) on card face (top-left, muted text, 10px)
- Show in task detail header
- Make copyable (click to copy full task reference)

### 2B. Right-Click Context Menu on Cards
**Why:** Power users expect quick actions without opening drawers. Linear, Jira, ClickUp all have this.
**File:** `frontend/src/app/features/board/task-card/task-card.component.ts`

**Implementation:**
- Add `(contextmenu)` event handler on the card div
- Show PrimeNG `ContextMenu` with items: Change Priority (submenu), Move to Column (submenu), Assign (submenu), Copy Link, Duplicate, Delete
- Reuse the same menu model from 1F (three-dot and right-click share the same menu)

### 2C. Markdown Description Editor
**Why:** Technical teams need formatted descriptions. Every competitor except Asana supports markdown.
**Files:**
- `frontend/src/app/features/board/task-detail/task-detail.component.ts` (description tab)
- Add a lightweight markdown renderer (e.g., `marked` or `ngx-markdown`)

**Implementation:**
- Replace plain `<textarea>` with a toggle between edit (textarea with monospace font) and preview (rendered markdown)
- Support: headings, bold, italic, code blocks, inline code, lists, links, blockquotes
- Add a small toolbar above textarea: Bold, Italic, Code, Link buttons that insert markdown syntax
- Keep it simple — no full WYSIWYG, just markdown + preview

---

## Phase 3: Competitive Parity Features

### 3A. Column Collapse
**Files:**
- `frontend/src/app/features/board/kanban-column/kanban-column.component.ts`
- `frontend/src/app/features/board/board-view/board-state.service.ts`

**Implementation:**
- Add `collapsedColumnIds` signal to board state service (persisted in localStorage)
- Add collapse toggle button (chevron) in column header
- Collapsed state: narrow vertical strip (40px wide) showing column name rotated 90deg + task count badge
- Click collapsed strip to expand

### 3B. Card Density Settings
**Files:**
- `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`
- `frontend/src/app/features/board/task-card/task-card.component.ts`

**Implementation:**
- Add a density toggle in toolbar (3 icons: compact/normal/full)
- **Compact:** Title + priority dot only, no labels/badges/assignees, reduced padding
- **Normal:** Current layout (default)
- **Full:** Show description snippet (1 line), estimated hours, milestone, group, comment count, attachment count
- Persist preference in localStorage

### 3C. Inline Quick Edit on Cards
**File:** `frontend/src/app/features/board/task-card/task-card.component.ts`

**Implementation:**
- On card hover, show small action icons below the three-dot menu: Priority cycle (click to cycle through), Assignee quick-pick, Due date quick-set
- Or: make priority flag clickable to cycle, due date chip clickable to open inline datepicker
- Keep it minimal — 2-3 quick actions max to avoid clutter

### 3D. Drag-Reorder Columns on Kanban Board
**Files:**
- `frontend/src/app/features/board/board-view/board-view.component.ts` (kanban section)

**Implementation:**
- Wrap column container in a CDK `cdkDropList` with horizontal orientation
- Make each column a `cdkDrag` item (drag handle on column header)
- On drop, recalculate fractional positions and call `updateColumn()` API
- Use the same fractional indexing pattern already used for task reorder

### 3E. Task Detail as Side Panel (Not Route Navigation)
**Files:**
- `frontend/src/app/features/board/board-view/board-view.component.ts`

**Implementation:**
- Instead of `router.navigate(['/task', task.id])`, toggle a side panel state
- Show the existing `TaskDetailComponent` in a right-side drawer/panel overlaying the board
- Board remains visible and interactive underneath
- URL updates via `replaceUrl` for deep-linking without full route change
- Escape key closes the panel

---

## Phase 4: Polish & Micro-Interactions

### 4A. Empty Board State
- Show illustration + "Create your first column to get started" CTA when board has 0 columns

### 4B. Column Header Menu
- Wire the dead column menu button with: Rename, Set Color, Set WIP Limit, Collapse, Delete Column

### 4C. Attachment Count Badge on Cards
- Add paperclip icon + count badge (similar pattern to comment count)

### 4D. Relative Timestamps
- Replace "MMM D, YYYY" with relative time ("2h ago", "Yesterday") + hover tooltip for absolute time

### 4E. Board Favorite from Board Header
- Add star icon next to board name in board-view header, toggle favorite via API

### 4F. Add Label Picker in Task Detail
- Currently labels can only be removed. Add a `p-multiSelect` to add labels from the board's label set.

---

## Implementation Order

| Order | Item | Effort | Impact |
|-------|------|--------|--------|
| 1 | 1A: Comments & Attachments | 4-6h | **Critical** |
| 2 | 1B: Comment count badge | 30min | Medium |
| 3 | 1C: Bulk selection trigger | 2h | High |
| 4 | 1D: Label filter toolbar | 1h | Medium |
| 5 | 1E: WIP limit input | 1h | Medium |
| 6 | 1F: Card three-dot menu | 3h | High |
| 7 | 2A: Task ID numbering | 4-6h | High |
| 8 | 2B: Right-click context menu | 2h (shares 1F menu) | High |
| 9 | 2C: Markdown editor | 3-4h | High |
| 10 | 3A: Column collapse | 3h | Medium-High |
| 11 | 3B: Card density | 3h | Medium |
| 12 | 3C: Inline quick edit | 3h | High |
| 13 | 3D: Drag-reorder columns | 2h | Medium |
| 14 | 3E: Side panel task detail | 3h | High |
| 15 | 4A-4F: Polish items | 4-6h | Medium |

**Total estimated: ~35-45 hours across all phases**

---

## Success Criteria Checklist

- [ ] Comments: Users can create, edit, delete, reply to comments with @mentions on any task
- [ ] Attachments: Users can upload, download, delete files on any task (MinIO-backed)
- [ ] Comment count badge visible on kanban cards when comments exist
- [ ] Bulk select works via Ctrl+click on cards; BulkActionsBar appears
- [ ] Label filter dropdown present in toolbar and filters cards correctly
- [ ] WIP limit editable in Board Settings column manager
- [ ] Card three-dot menu opens with working actions (priority, move, copy link, delete)
- [ ] Tasks display board-scoped numeric IDs (e.g., TF-42) on cards and detail view
- [ ] Right-click on card shows context menu
- [ ] Task descriptions support markdown with preview toggle
- [ ] Columns collapsible to narrow strips on the kanban board
- [ ] Card density toggle (compact/normal/full) in toolbar
- [ ] All code passes `cargo check && cargo clippy` (backend) and `npx tsc --noEmit && npm run build` (frontend)
- [ ] No console.log statements in production code

## Verification

```bash
# Backend
cd /home/ankur/taskflow/backend && cargo check --workspace --all-targets && cargo clippy --workspace --all-targets -- -D warnings

# Frontend
cd /home/ankur/taskflow/frontend && npx tsc --noEmit && npm run build -- --configuration=production

# Full check
./scripts/quick-check.sh
```

Manual verification:
1. Open a board → Activity tab → post a comment → verify it appears with author/timestamp
2. Upload a file → verify it appears in attachment list → download it
3. Check kanban card shows comment count badge
4. Ctrl+click multiple cards → verify bulk action bar appears
5. Use label filter in toolbar → verify cards filter correctly
6. Set WIP limit in settings → add cards beyond limit → verify warning shows
7. Right-click / three-dot menu on card → verify all actions work
8. Verify task IDs (e.g., TF-1, TF-2) display on cards
