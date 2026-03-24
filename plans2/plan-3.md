# Eisenhower Matrix Enhancement Plan

## Context

The Eisenhower Matrix exists but has a critical bug (tasks don't reliably appear when assigned) and lacks interactivity compared to competitors. No top-10 PM tool has a native Eisenhower Matrix — TaskBolt already has one. The goal is to fix the bug and add polish/interactivity to make it best-in-class.

**Competitive edge targets**: Drag-and-drop (Trello Power-Up), customizable rules (TickTick), daily focus view (Amazing Marvin), working delegation (Jira).

---

## Phase 0: Bug Fix — Tasks Not Showing

**Root cause**: The eisenhower query is missing two filters that `my_tasks.rs:153-155` has:

| Issue | Eisenhower Query | My Tasks Query |
|-------|-----------------|----------------|
| Deleted boards | `INNER JOIN boards b ON t.board_id = b.id` (no filter) | `b.deleted_at IS NULL` |
| Board membership | Not checked | `INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1` |
| Completed tasks | All shown (clutters view) | Filtered via `is_done` |

Additionally, tasks with no due date + medium/low priority auto-classify to "Eliminate" quadrant, making them appear invisible to users who expect them in a different quadrant.

### Step 0.1: Fix SQL query
**File**: `backend/crates/db/src/queries/eisenhower.rs:135-141`
- Add `AND b.deleted_at IS NULL` to boards join
- Add `INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.user_id = $1`
- Add `AND NOT COALESCE((c.status_mapping->>'done')::boolean, false)` to exclude completed tasks

### Step 0.2: Verify with backend check
```bash
cd backend && cargo check --workspace --all-targets
```

---

## Phase 1: Core Interactivity

### Step 1.1: Fix dark mode colors
**File**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-matrix.component.ts:217-253`

Replace hardcoded hex `bgColor` values with Tailwind classes:
- Do First: `bg-red-500/5 dark:bg-red-500/10` + `border-red-300 dark:border-red-400/50`
- Schedule: `bg-yellow-500/5 dark:bg-yellow-500/10` + `border-yellow-300 dark:border-yellow-400/50`
- Delegate: `bg-orange-500/5 dark:bg-orange-500/10` + `border-orange-300 dark:border-orange-400/50`
- Eliminate: `bg-[var(--muted)]/50` + `border-[var(--border)]`

Also fix priority badge classes (`bg-red-100 text-red-800`) to include dark variants.

### Step 1.2: Extract EisenhowerTaskCard component
**File (new)**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-task-card.component.ts`

Extract task card from lines 134-176 of matrix component into standalone component with:
- `cdkDrag` directive from `@angular/cdk/drag-drop` (already installed: `package.json:18`)
- Input: task object, quadrant key
- Output events: `taskClicked`, `priorityChanged`, `dueDateChanged`, `reassignClicked`
- Hover toolbar with quick action icons (priority, due date, reassign)
- Override indicator badge when `eisenhower_urgency !== null || eisenhower_importance !== null`

**Pattern reference**: `frontend/src/app/features/board/task-card/task-card.component.ts`

### Step 1.3: Add drag-and-drop between quadrants
**File**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-matrix.component.ts`

- Import `CdkDropList, CdkDrag, CdkDragDrop, transferArrayItem` (pattern: `kanban-column.component.ts:10-14`)
- Each quadrant becomes a `cdkDropList` with id `quadrant-{key}`
- Connect all 4 via `[cdkDropListConnectedTo]="allDropLists"`
- On drop: map target quadrant to urgency/importance booleans:
  - `do_first` → `(true, true)`, `schedule` → `(false, true)`, `delegate` → `(true, false)`, `eliminate` → `(false, false)`
- Call `eisenhowerService.updateTaskOverride()` with optimistic UI update (move immediately, revert on error)

### Step 1.4: Fix delegate action — member picker
**File (new)**: `frontend/src/app/features/my-tasks/eisenhower-matrix/member-picker-popover.component.ts`

- Input: `boardId`, `taskId`
- Fetches board members via `boardService.getBoardMembers(boardId)` (service at `core/services/board.service.ts:181`)
- Searchable list with avatar + name
- On selection: calls `taskService.assignUser(taskId, userId)` (service at `core/services/task.service.ts:224`)
- Emits `memberSelected`

Then wire into matrix component replacing the "Not Available" dialog at lines 318-329.

### Step 1.5: Inline quick actions on task cards
**File**: `eisenhower-task-card.component.ts` (from Step 1.2)

Hover toolbar with:
- Priority dropdown (urgent/high/medium/low) → calls `taskService.updateTask()`
- Due date picker (native input or PrimeNG DatePicker) → calls `taskService.updateTask()`
- Reassign button → opens member picker popover

---

## Phase 2: Filtering & Custom Rules

### Step 2.1: Backend — add filter params to GET /api/eisenhower
**File**: `backend/crates/api/src/routes/eisenhower.rs`

Add query params struct:
```rust
pub struct EisenhowerQueryParams {
    pub workspace_id: Option<Uuid>,
    pub board_id: Option<Uuid>,
    pub daily: Option<bool>,        // today + overdue only
    pub include_done: Option<bool>,  // default false
}
```

**File**: `backend/crates/db/src/queries/eisenhower.rs`

Use dynamic query building pattern from `my_tasks.rs:121-133`:
- If `workspace_id` set: `AND b.workspace_id = $N`
- If `board_id` set: `AND t.board_id = $N`
- If `daily=true`: `AND (t.due_date IS NOT NULL AND t.due_date::date <= CURRENT_DATE)`
- If `include_done=false` (default): exclude done tasks (from Phase 0)

### Step 2.2: Frontend — filter bar component
**File (new)**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-filters.component.ts`

- Workspace dropdown (from `workspaceService.list()` at `core/services/workspace.service.ts:44`)
- Board dropdown (filtered by selected workspace)
- "Daily Focus" toggle button
- "Show Completed" toggle
- Emits `filtersChanged` with filter object
- Persist to localStorage

### Step 2.3: Frontend — update service with filter params
**File**: `frontend/src/app/core/services/eisenhower.service.ts`

Update `getMatrix()` to accept optional HttpParams for workspace_id, board_id, daily, include_done.

### Step 2.4: Customizable rules — migration + backend
**File (new migration)**: `backend/crates/db/src/migrations/YYYYMMDD_eisenhower_settings.sql`
```sql
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS eisenhower_urgency_days INTEGER DEFAULT 2;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS eisenhower_importance_criteria TEXT DEFAULT 'priority';
```

**File**: `backend/crates/db/src/models/user_preferences.rs` — add fields
**File**: `backend/crates/db/src/queries/user_preferences.rs` — update upsert/get
**File**: `backend/crates/api/src/routes/eisenhower.rs` — add `GET/PUT /api/eisenhower/settings`
**File**: `backend/crates/db/src/queries/eisenhower.rs` — replace hardcoded `Duration::days(2)` with user's `urgency_days`

### Step 2.5: Frontend — settings dialog
**File (new)**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-settings-dialog.component.ts`

- Slider: urgency threshold (1-7 days, default 2)
- Info text explaining what each setting does
- Save → PUT /api/eisenhower/settings → reload matrix

---

## Phase 3: Real-time & Intelligence

### Step 3.1: WebSocket integration
**File**: `backend/crates/services/src/broadcast.rs` — add `EISENHOWER_UPDATED` event
**File**: `backend/crates/api/src/routes/eisenhower.rs` — broadcast after override updates
**File**: `backend/crates/api/src/routes/task_assignment.rs` — broadcast on assign/unassign

**File**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-matrix.component.ts`
- Inject `WebSocketService` (at `core/services/websocket.service.ts`)
- Subscribe to `eisenhower:updated`, `task:assigned`, `task:updated` events
- Debounced `loadMatrix()` on relevant events (500ms)

### Step 3.2: Enhanced auto-classification
**File**: `backend/crates/db/src/queries/eisenhower.rs`

Add SQL subqueries for richer signals:
- `(SELECT COUNT(*) FROM task_assignees WHERE task_id = t.id) as assignee_count`
- Subtask completion percentage
- `EXTRACT(DAY FROM NOW() - t.updated_at)` as staleness

Update `compute_urgency()`: overdue tasks = always urgent
Update `compute_importance()`: consider subtask progress

### Step 3.3: Analytics endpoint + component
**File**: `backend/crates/api/src/routes/eisenhower.rs` — add `GET /api/eisenhower/analytics`
**File (new)**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-analytics.component.ts`

Collapsible panel with:
- Quadrant distribution bar (CSS-only, no chart library)
- Override count, overdue count, total tasks

### Step 3.4: Keyboard shortcuts
**File**: `frontend/src/app/features/my-tasks/eisenhower-matrix/eisenhower-matrix.component.ts`

`@HostListener('document:keydown')`:
- `1-4`: Focus quadrant
- Arrow keys: Navigate tasks within quadrant
- `Enter`: Open task
- `d`: Toggle daily view
- `r`: Refresh
- `?`: Show shortcut help

---

## New Files Summary

| File | Phase |
|------|-------|
| `frontend/.../eisenhower-task-card.component.ts` | 1 |
| `frontend/.../member-picker-popover.component.ts` | 1 |
| `frontend/.../eisenhower-filters.component.ts` | 2 |
| `frontend/.../eisenhower-settings-dialog.component.ts` | 2 |
| `backend/.../migrations/YYYYMMDD_eisenhower_settings.sql` | 2 |
| `frontend/.../eisenhower-analytics.component.ts` | 3 |

## Modified Files Summary

| File | Phase | Changes |
|------|-------|---------|
| `backend/crates/db/src/queries/eisenhower.rs` | 0,2,3 | Fix query, add filters, custom rules, signals |
| `backend/crates/api/src/routes/eisenhower.rs` | 0,2,3 | Add query params, settings endpoint, analytics, WS |
| `backend/crates/db/src/models/user_preferences.rs` | 2 | Add eisenhower settings fields |
| `backend/crates/db/src/queries/user_preferences.rs` | 2 | Update upsert/get |
| `backend/crates/services/src/broadcast.rs` | 3 | Add EISENHOWER_UPDATED event |
| `frontend/.../eisenhower-matrix.component.ts` | 0-3 | Full enhancement (drag-drop, filters, dark mode, WS, shortcuts) |
| `frontend/.../eisenhower.service.ts` | 2 | Add filter params, settings methods |

---

## Verification

After each phase:
```bash
# Backend
cd backend && cargo check --workspace --all-targets && cargo clippy --workspace --all-targets -- -D warnings

# Frontend
cd frontend && npx tsc --noEmit && npm run build -- --configuration=production
```

End-to-end:
1. Create a task with high priority + due tomorrow → appears in "Do First"
2. Create a task with medium priority + no due date → appears in "Eliminate"
3. Drag task from Eliminate to Schedule → persists after refresh
4. Toggle "Daily Focus" → only today/overdue tasks shown
5. Change urgency threshold to 5 days → task reclassification updates
6. Open matrix in two tabs → change in one reflects in other via WebSocket

---

## Success Criteria

- [ ] Assigned tasks from non-deleted boards appear in correct quadrant
- [ ] Completed tasks excluded by default
- [ ] Drag-and-drop moves tasks between quadrants and persists
- [ ] Delegate "Reassign" button opens working member picker
- [ ] Dark mode renders correctly (no hardcoded light colors)
- [ ] Workspace/board filter dropdowns work
- [ ] "Daily Focus" toggle shows only today + overdue tasks
- [ ] Custom urgency threshold (1-7 days) persists per user
- [ ] WebSocket updates refresh matrix in real-time
- [ ] Analytics panel shows quadrant distribution
- [ ] Keyboard shortcuts (1-4, arrows, enter, d, r) work
- [ ] `cargo check` + `cargo clippy` pass with zero warnings
- [ ] `tsc --noEmit` + production build pass
