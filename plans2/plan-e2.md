# E2: Optimistic Updates — Implementation Plan

**Date:** 2026-03-02
**Feature:** E2 — Optimistic Updates
**Status:** Planning

---

## Requirements

### What E2 Means in This Context

Optimistic updates is a UX pattern where the UI reflects the user's intended change **immediately**, before the server confirms the operation. If the server returns an error, the UI rolls back to the previous state and notifies the user. The goal is zero-lag interaction: no spinners, no waiting, no visual stutter on common actions.

### User Interactions That Need Optimistic Updates

| Interaction | Location | Current State |
|---|---|---|
| Card drag-and-drop between columns | Kanban board | DONE — instant move, rollback on error |
| Card drag-and-drop within a column (reorder) | Kanban board | DONE — instant reorder |
| Swimlane cross-lane DnD (priority, assignee, label changes) | Kanban board | DONE |
| Card priority change (quick-edit popover) | Board card | DONE via `optimisticUpdateTask` |
| Card assignee add/remove (quick-edit popover) | Board card | DONE via `optimisticAssignUser/UnassignUser` |
| Card due date change (quick-edit popover) | Board card | DONE via `optimisticUpdateTask` |
| Card label add/remove (quick-edit popover) | Board card | DONE via `optimisticAddLabel/RemoveLabel` |
| Card title change (context menu inline edit) | Board card | DONE via `optimisticUpdateTask` |
| Card priority change (context menu) | Board card | DONE via `optimisticUpdateTask` |
| Card column move (context menu "Move to") | Board card | DONE with inline snapshot/rollback |
| Task create | Board | DONE with temp task + ID swap |
| Task delete | Board | DONE with snapshot/rollback |
| Column create | Board | DONE with temp column + ID swap |
| Column reorder | Board | DONE with snapshot/rollback |
| Column delete | Board | DONE with snapshot/rollback |
| Task duplicate | Board | DONE with temp task + undo toast |
| Task title edit (board drawer) | Board task-detail drawer | DONE via `updateTask()` private method |
| Task description edit (board drawer) | Board task-detail drawer | DONE via `updateTask()` |
| Task priority change (board drawer) | Board task-detail drawer | DONE via `updateTask()` |
| Task due date change (board drawer) | Board task-detail drawer | DONE via `updateTask()` |
| Task label add (board drawer) | Board task-detail drawer | PARTIAL — add is optimistic, remove is NOT |
| Task label remove (board drawer) | Board task-detail drawer | NOT DONE — waits for server `next:` |
| Task assignee add (board drawer) | Board task-detail drawer | NOT DONE — waits for server `next:` |
| Task assignee remove (board drawer) | Board task-detail drawer | NOT DONE — waits for server `next:` |
| Task milestone assign/clear (board drawer) | Board task-detail drawer | NOT DONE — waits for server `next:` |
| Task title edit (standalone task page) | `/task/:id` page | DONE via `updateTask()` |
| Task description edit (standalone task page) | `/task/:id` page | DONE |
| Task priority change (standalone task page) | `/task/:id` page | DONE |
| Task due date change (standalone task page) | `/task/:id` page | DONE |
| Task assignee add (standalone task page) | `/task/:id` page | NOT DONE — waits for server `next:` |
| Task assignee remove (standalone task page) | `/task/:id` page | NOT DONE — waits for server `next:` |
| Task label remove (standalone task page) | `/task/:id` page | NOT DONE — waits for server `next:` |

### Interactions Explicitly OUT OF SCOPE

| Interaction | Reason |
|---|---|
| Comment add/edit/delete | Comments are social data; optimistic adds without server ID cause ordering bugs and are confusing if rolled back mid-read. Acceptable to wait. |
| Subtask create/delete | Subtasks have their own IDs and counter fields (`subtask_total`, `subtask_completed`). Safe to wait for server to confirm before updating parent task counters. |
| File attachment upload | Binary upload progress is inherently async; user expects to wait. |
| Time entry add/stop | Timer precision requires server timestamp. Optimistic clock is unreliable. |
| Dependency add/remove | Dependency graph is complex; partial optimistic update of graph edges without full validation is error-prone. |
| Recurring rule save | Low-frequency, high-impact. User expects save to complete before seeing it. |
| Board settings changes | Admin-level changes with side effects (archive, color, name). Frequency too low to warrant complexity. |
| Custom field values | Custom fields have varied validation server-side. Acceptable to wait. |
| Bulk operations | Batch mutations are complex to reverse. Server response is needed for accurate bulk count feedback. |
| Watcher add/remove | Low-frequency, low-visibility action. |

---

## Competitor Benchmark

### Winner Pattern (Linear, Notion, Jira)

1. **Instant client-side state change** — no spinner, no debounce, no "saving..." overlay.
2. **Background API call** — fire-and-forget from user perspective.
3. **Server confirmation** — silently reconcile server response into local state (replace temp ID, fix server-corrected fields).
4. **Rollback on error** — restore pre-action state exactly, show a dismissible error toast with a clear message ("Couldn't move task — check your connection and try again").

### Most Important Gap TaskFlow Has vs Best-in-Class

**Board task-detail drawer (side panel) does NOT apply optimistic updates for assignee add/remove, label remove, and milestone changes.**

When a user opens the board task drawer and changes an assignee, there is a visible delay between click and visual change because the update only applies in the `next:` callback after the server responds. Assignee/label changes are among the most frequent card edits. This is the single most painful UX gap remaining.

---

## What Already Exists

### Robust, Reusable (can be used as the canonical pattern)

| File | Methods | Pattern |
|---|---|---|
| `board-state.service.ts` | `optimisticUpdateTask()` | snapshot → apply → API call → confirm/rollback + `showError()` |
| `board-state.service.ts` | `optimisticAssignUser()` | snapshot → apply → API call → rollback + `showError()` |
| `board-state.service.ts` | `optimisticUnassignUser()` | same |
| `board-state.service.ts` | `optimisticAddLabel()` | same |
| `board-state.service.ts` | `optimisticRemoveLabel()` | same |
| `board-state.service.ts` | `createTask()` | optimistic temp task with UUID, ID-swap on success |
| `board-state.service.ts` | `deleteTask()` | snapshot → remove → rollback |
| `board-state.service.ts` | `createColumn()` | optimistic temp column with UUID |
| `board-state.service.ts` | `reorderColumn()` | snapshot → reorder → rollback |
| `board-state.service.ts` | `deleteColumn()` | snapshot → remove → rollback |
| `board-state.service.ts` | `showError(message)` | sets `errorMessage` signal → board view shows red snackbar |
| `board-drag-drop.handler.ts` | `onTaskMoved()` | snapshot → move in boardState → API → rollback |
| `board-drag-drop.handler.ts` | `onSwimlaneTaskMoved()` | delegates to `onTaskMoved()` + extra property updates |
| `card-quick-edit-popover.component.ts` | all handlers | delegates 100% to `BoardStateService` optimistic methods |
| `board-view.component.ts` | `onCardColumnMove()`, `onCardDuplicate()` | inline snapshot/rollback |

### Partial (optimistic apply, but no rollback on error)

| File | Methods | Gap |
|---|---|---|
| `task-detail.component.ts` (board drawer) | `onAddLabel()` | Add is optimistic with rollback, but `onRemoveLabel()` waits for `next:` |
| `task-detail.component.ts` (board drawer) | `updateTask()` | Optimistic + rollback — GOOD |
| `task-detail.component.ts` (board drawer) | `onAssign()`, `onUnassign()` | Wait for server `next:`, no rollback |
| `task-detail.component.ts` (board drawer) | `onMilestoneChange()`, `onClearMilestone()` | Wait for server `next:`, no rollback |

### Not Optimistic (waits for server)

| File | Methods | Fix Required |
|---|---|---|
| `task-detail-page.component.ts` (standalone `/task/:id`) | `onAssign()`, `onUnassign()` | Apply immediately, rollback on error |
| `task-detail-page.component.ts` (standalone `/task/:id`) | `onRemoveLabel()` | Apply immediately, rollback on error |

### Error Notification — Current vs Needed

**Current:** `BoardStateService.showError(message)` sets an `errorMessage` signal. The board view template renders a red snackbar at `bottom-4 right-4`. This is bespoke per-component HTML, not a shared component. The board task drawer (`task-detail.component.ts`) uses `MessageService` (PrimeNG) for template save errors. The standalone task page (`task-detail-page.component.ts`) has **no error notification at all** on rollback — errors are silently swallowed.

**Needed:** A single shared error toast mechanism for optimistic rollback notifications, usable from any context (board drawer, standalone page, board state service). The existing custom `ToastService` is for realtime notifications and has a typed `NotificationEventType` that doesn't include error/system messages — it should not be overloaded. PrimeNG `MessageService` is already injected in `task-detail.component.ts` and `board-view.component.ts`. This is the right tool to use for rollback toasts.

---

## Backend Changes

**No backend changes required.**

All optimistic update patterns are purely frontend concerns. The existing API contracts are sufficient:
- APIs return the updated entity on success (used to reconcile server-confirmed state)
- APIs return HTTP error codes on failure (used to trigger rollback)
- No idempotency tokens are needed because the snapshot/rollback pattern handles retries at the UI layer

---

## Frontend Changes

### Problem Summary

There are three distinct contexts where task property edits happen:

1. **Board state (via `BoardStateService`)** — fully optimistic, pattern is mature and correct. ✓
2. **Board task drawer (`task-detail.component.ts`)** — partial. `updateTask()` is optimistic, but `onAssign`, `onUnassign`, `onRemoveLabel`, `onMilestoneChange`, `onClearMilestone` are not.
3. **Standalone task page (`task-detail-page.component.ts`)** — partial. `updateTask()` is optimistic with rollback, but `onAssign`, `onUnassign`, `onRemoveLabel` are not, and errors are silently swallowed.

### 1. BoardStateService — No Changes Needed

The pattern in `board-state.service.ts` is the gold standard. All board-level optimistic methods follow: snapshot → apply → API → confirm or rollback + `showError()`. This should be the reference implementation for all new work.

### 2. Board Task Drawer — `task-detail.component.ts`

**File:** `frontend/src/app/features/board/task-detail/task-detail.component.ts`

Fix these methods to be optimistic with rollback:

#### `onAssign(member)` — currently waits for `next:`
```
Pattern to use:
1. snapshot = { ...task }
2. Immediately compute newAssignee from member data (available locally)
3. Apply: task.set({ ...task, assignees: [...existing, newAssignee] })
4. Emit: taskUpdated.emit(updatedTask)
5. taskService.assignUser(task.id, member.id).subscribe({
     next: () => { /* already applied */ },
     error: () => { task.set(snapshot); taskUpdated.emit(snapshot); messageService.add({severity:'error', ...}) }
   })
```

#### `onUnassign(assignee)` — currently waits for `next:`
```
Pattern:
1. snapshot = { ...task }
2. Apply removal immediately
3. taskService.unassignUser().subscribe({ error: rollback + toast })
```

#### `onRemoveLabel(labelId)` — currently waits for `next:`
```
Pattern:
1. snapshot = { ...task }
2. Apply removal immediately
3. taskService.removeLabel().subscribe({ error: rollback + toast })
```

#### `onMilestoneChange(milestoneId)` — currently waits for `next:`
```
Pattern:
1. snapshot = { ...task }
2. Apply milestone_id immediately
3. milestoneService.assignTask().subscribe({ error: rollback + toast })
```

#### `onClearMilestone()` — currently waits for `next:`
```
Pattern:
1. snapshot = { ...task }
2. Set milestone_id: null immediately
3. milestoneService.unassignTask().subscribe({ error: rollback + toast })
```

**Error notification:** `task-detail.component.ts` already injects `MessageService` and has a `<p-toast>` in its template (via `providers: [MessageService]`). Use `this.messageService.add({ severity: 'error', summary: 'Update failed', detail: '...', life: 4000 })`.

### 3. Standalone Task Page — `task-detail-page.component.ts`

**File:** `frontend/src/app/features/task-detail/task-detail-page.component.ts`

This component does NOT have `MessageService` injected. Need to inject it, add `<p-toast>` to template, and provide it.

Fix these methods:

#### `onAssign(member)` — currently waits for `next:`
Same pattern: apply immediately, rollback in `error:`.

#### `onUnassign(assignee)` — currently waits for `next:`
Same pattern.

#### `onRemoveLabel(labelId)` — currently waits for `next:`
Same pattern.

**Important:** The `updateTask()` private method in this file IS already optimistic with rollback, and restores `editTitle` and `editDescription` signals on rollback. This is the correct model to follow.

### 4. Error Notification Unification — `BoardStateService`

**File:** `frontend/src/app/features/board/board-view/board-state.service.ts`

Current `showError()` is a bespoke snackbar via an `errorMessage` signal rendered in the board view component template. This is fine for the board context but cannot be reused in drawers or standalone pages.

No structural change needed to `BoardStateService` — the pattern already works correctly for the board. The drawer and standalone page will use `MessageService` directly (as the drawer already does for template saves).

### 5. Pending State Indicator — Assessment

The question is whether to add a `pendingTaskIds` signal to track which tasks have in-flight API calls, and show a subtle loading indicator on those cards.

**Decision: Do NOT add pending state indicators in Phase 1 or 2.**

Rationale:
- The whole point of optimistic updates is to feel instant — adding a spinner contradicts that goal.
- The existing pattern (snapshot → apply → confirm) means the UI is already correct on success and reverts gracefully on failure.
- Best-in-class tools (Linear, Notion) do not show per-card pending indicators for property edits.
- The only scenario where a pending indicator adds value is when the user makes a second conflicting edit before the first resolves. This is an edge case and will be addressed by the existing snapshot-per-call pattern (each call takes its own snapshot).

If this is reconsidered later, the signal would be: `readonly pendingTaskIds = signal<Set<string>>(new Set())` added to `BoardStateService`, with task card UI checking `state.pendingTaskIds().has(task.id)` to show a subtle pulsing ring. This is straightforward to add incrementally.

---

## Phased Implementation

### Phase 1 — Audit and Document Gaps (No Code Changes)

**Goal:** Confirm the full gap list by manually testing each interaction in the browser. Identify any additional non-optimistic paths missed in static analysis.

**Steps:**
1. Open the board in Chrome DevTools, throttle network to "Slow 3G".
2. Test every interaction in the "User Interactions" table above.
3. Record actual behavior vs expected (instant vs wait).
4. Verify the "already done" items truly have no visible lag.
5. Update this plan with any discrepancies found.

**Deliverable:** Confirmed gap list, no code changed.

**Estimated scope:** 1-2 hours of manual testing.

### Phase 2 — Fix Board Task Drawer (Highest Impact)

**Goal:** Make all property edits in the board task drawer (`task-detail.component.ts`) fully optimistic with rollback and error toast.

**Changes:**

1. **`task-detail.component.ts`** — `onAssign()`, `onUnassign()`, `onRemoveLabel()`, `onMilestoneChange()`, `onClearMilestone()`
   - Apply snapshot before API call
   - Apply change immediately to local `task` signal and emit `taskUpdated`
   - On error: restore snapshot, emit, show `messageService.add()` error toast

**Testing:**
- Throttle network, verify each field change is instant
- Simulate API error (add HTTP interceptor error for test), verify rollback and toast

**Estimated scope:** 30-45 minutes of implementation, 15 minutes of browser verification.

### Phase 3 — Fix Standalone Task Page

**Goal:** Make the standalone `/task/:id` page (`task-detail-page.component.ts`) fully optimistic for assignee and label changes, with error toast.

**Changes:**

1. **`task-detail-page.component.ts`** — `onAssign()`, `onUnassign()`, `onRemoveLabel()`
   - Same pattern as Phase 2
   - Add `MessageService` to providers and inject it
   - Add `<p-toast>` to the page template
   - Add `MessageService` import

**Testing:**
- Same network throttle test
- Verify `editTitle` and `editDescription` rollback still works (existing behavior must not regress)

**Estimated scope:** 30 minutes implementation, 15 minutes verification.

---

## File Change List

### Phase 2

| File | Change |
|---|---|
| `frontend/src/app/features/board/task-detail/task-detail.component.ts` | Make `onAssign`, `onUnassign`, `onRemoveLabel`, `onMilestoneChange`, `onClearMilestone` optimistic with rollback + error toast via existing `MessageService` |

### Phase 3

| File | Change |
|---|---|
| `frontend/src/app/features/task-detail/task-detail-page.component.ts` | Make `onAssign`, `onUnassign`, `onRemoveLabel` optimistic with rollback + error toast. Inject `MessageService`, add `<p-toast>` to template. |

### No Changes Needed

| File | Reason |
|---|---|
| `board-state.service.ts` | Pattern is already correct and complete |
| `board-drag-drop.handler.ts` | Already fully optimistic |
| `card-quick-edit-popover.component.ts` | Delegates entirely to `BoardStateService` |
| `board-view.component.ts` | Card-level handlers already optimistic |
| Backend (all Rust files) | No backend changes required |

---

## Success Criteria Checklist

- [ ] Card DnD (column move, reorder, swimlane cross-lane) feels instant with no spinner
- [ ] Quick-edit popover changes (priority, assignee, due date, label) feel instant with no spinner
- [ ] Board task drawer: assignee add/remove is instant (no wait for server response before UI updates)
- [ ] Board task drawer: label remove is instant
- [ ] Board task drawer: milestone assign/clear is instant
- [ ] Standalone task page (`/task/:id`): assignee add/remove is instant
- [ ] Standalone task page: label remove is instant
- [ ] On simulated API error, board drawer reverts to previous state AND shows a PrimeNG error toast
- [ ] On simulated API error, standalone page reverts to previous state AND shows a PrimeNG error toast
- [ ] On simulated API error, board card reverts to previous state AND shows the existing red snackbar
- [ ] No duplicate optimistic update code introduced — drawer and standalone page use the same per-method snapshot/rollback pattern
- [ ] Existing `BoardStateService` optimistic methods are unchanged and all tests pass
- [ ] `cargo check` passes (no backend changes, but verifying no accidental breakage)
- [ ] `npx tsc --noEmit` passes on the frontend
- [ ] Manual test with Slow 3G throttle confirms each operation feels instant

---

## Notes on the Existing Error UX

The current error notification has two different mechanisms:

1. **Board view errors** — `boardState.showError(msg)` → custom red snackbar in `board-view.component.ts` template (bottom-right corner, dismissible).
2. **Board drawer errors** — `MessageService.add()` → PrimeNG `<p-toast>` (top-right, auto-dismiss after 3s).
3. **Standalone task page errors** — currently nothing.

This inconsistency is acceptable for now. A future cleanup (out of scope for E2) could standardize on one mechanism. The PrimeNG `<p-toast>` is the better long-term choice because it is already provided globally via `app.config.ts` and has better accessibility and animation.

---

## Anti-Patterns to Avoid

1. **Do not wrap optimistic calls in `setTimeout`** — this creates artificial lag.
2. **Do not show a "Saving..." spinner** on the mutated element — defeats the purpose.
3. **Do not take a single global snapshot** shared across multiple concurrent calls — each method call must take its own snapshot so concurrent edits don't clobber each other's rollback state.
4. **Do not re-fetch from server on success** — use the server response to reconcile only the changed fields, not trigger a full board reload.
5. **Do not silently swallow errors** — every `error: () => {}` that follows an optimistic apply should be `error: () => { rollback; toast }`.
