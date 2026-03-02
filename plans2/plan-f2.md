# F2: Optimistic UI Updates — Implementation Plan

**Date:** 2026-03-02
**Feature:** F2 — Optimistic UI Updates (Real-Time Collaboration section)
**Status:** Planning
**Depends on:** E2 (Optimistic Updates — completed 2026-03-02)

---

## Requirements

### What F2 Means

F2 builds on the optimistic update foundation laid by E2. Where E2 focused on ensuring every user interaction applies instantly (snapshot → apply → API → confirm/rollback), F2 adds the **visibility and reliability layer** that separates good UX from best-in-class:

1. **"Saving..." / "Saved" status indicator** — persistent UI element showing sync state (like Google Docs, Notion, ClickUp)
2. **Retry logic for transient failures** — automatic single retry on network/5xx errors before rolling back
3. **Extend optimistic coverage** to the few remaining non-optimistic write operations
4. **Unified save tracking** — centralized service tracking all in-flight mutations across the entire app

### Sub-Features In Scope

| # | Sub-Feature | Description |
|---|------------|-------------|
| F2.1 | SaveStatusService | Centralized service tracking in-flight API mutations, exposing reactive save status signal |
| F2.2 | Save status indicator component | Persistent UI element in top-nav showing "Saving..." / "Saved" / "Error" |
| F2.3 | Retry-on-transient utility | RxJS operator that retries once on network/5xx errors, passes through 4xx immediately |
| F2.4 | Integrate tracking into BoardStateService | Wrap all optimistic API calls with save status tracking |
| F2.5 | Integrate tracking into task detail components | Board drawer and standalone task page report save status |
| F2.6 | Remaining optimistic conversions | Convert last few non-optimistic write operations |

### Sub-Features Explicitly OUT OF SCOPE

| Sub-Feature | Reason |
|-------------|--------|
| Offline queue / IndexedDB persistence | Requires significant infrastructure; better suited for a dedicated offline-first phase |
| Conflict resolution (F3) | Separate feature — requires server-side version vectors, OT/LWW, and WebSocket-based conflict broadcasting |
| Presence indicators (F1) | Separate feature — requires WebSocket presence protocol |
| Real-time collaborative editing | Requires OT/CRDT infrastructure not yet built |
| Per-card pending spinner | Anti-pattern — contradicts the "feels instant" goal; the whole point of optimistic updates is no spinners |
| Retry on comment/file upload | These are inherently async operations where users expect to wait |

### What E2 Covered vs What F2 Adds

**E2 completed (all verified in current codebase):**
- Board-level: drag-drop, quick-edit popover, create/delete task, create/delete/reorder column — all fully optimistic with snapshot/rollback
- Board task drawer: title, description, priority, due date, assignee add/remove, label add/remove, milestone assign/clear — all optimistic with rollback + PrimeNG error toast
- Standalone task page: title, description, priority, due date, assignee add/remove, label remove — all optimistic with rollback + PrimeNG error toast
- Subtask toggle and create — already optimistic with snapshot/rollback
- Bulk actions — already optimistic with snapshot/rollback
- Group collapse toggle — already optimistic with rollback
- Error notification: `BoardStateService.showError()` for board, `MessageService` toast for drawers/pages

**F2 adds (NEW):**
- Save status tracking service (SaveStatusService)
- "Saving..." / "Saved" indicator component in top-nav
- Retry-on-transient utility (single automatic retry for 5xx/network errors)
- Integration of save tracking into all optimistic paths
- Convert remaining non-optimistic writes: watcher add/remove (standalone page), subtask delete, subtask reorder, group create/rename/color/delete

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> **Google Docs + Notion hybrid:** immediate client-side optimistic move → server confirms → rollback with undo-style notification if rejected. No blocking locks. Show "Saving..." / "Saved" indicators.

### Most Important Gap TaskFlow Has vs Best-in-Class

**No save status indicator.** Every competitor (Google Docs, Notion, ClickUp, Linear) shows a persistent "Saving..." → "Saved" indicator that gives users confidence their work is being persisted. TaskFlow currently has zero visibility into save state — changes either silently succeed or pop an error toast. The user has no way to know if their edits have been saved, which creates anxiety especially when closing the browser or navigating away. This is the single most impactful gap to close.

---

## What Already Exists

### Fully Optimistic (No Changes Needed for Core Pattern)

| File | Methods | Pattern |
|------|---------|---------|
| `board-state.service.ts` | `optimisticUpdateTask`, `optimisticAssignUser`, `optimisticUnassignUser`, `optimisticAddLabel`, `optimisticRemoveLabel`, `createTask`, `deleteTask`, `createColumn`, `reorderColumn`, `deleteColumn` | snapshot → apply → API → confirm/rollback + `showError()` |
| `board-drag-drop.handler.ts` | `onTaskMoved`, `onSwimlaneTaskMoved` | snapshot → move → API → rollback |
| `board-bulk-actions.service.ts` | `executeBulkAction` | snapshot → apply → API → rollback |
| `card-quick-edit-popover.component.ts` | all handlers | delegates to BoardStateService |
| `task-detail.component.ts` (drawer) | `onAssign`, `onUnassign`, `onRemoveLabel`, `onAddLabel`, `onMilestoneChange`, `onClearMilestone`, `updateTask` | snapshot → apply → API → rollback + MessageService toast |
| `task-detail-page.component.ts` | `onAssign`, `onUnassign`, `onRemoveLabel`, `updateTask` | snapshot → apply → API → rollback + MessageService toast |
| `subtask-list.component.ts` | `onToggle`, `onAdd` | snapshot → apply → API → rollback + showError |

### Needs Extension (Optimistic Apply But Missing Save Tracking)

All of the above methods need to be wrapped with `SaveStatusService.trackSave()` to report their state to the global indicator.

### Not Yet Optimistic (Needs Conversion)

| File | Method | Current Behavior | Fix |
|------|--------|-----------------|-----|
| `task-detail-page.component.ts` | `onWatch()` | Waits for `next:` to update UI | Apply watcher immediately, rollback on error |
| `task-detail-page.component.ts` | `onUnwatch()` | Waits for `next:` to update UI | Apply removal immediately, rollback on error |
| `subtask-list.component.ts` | `onDelete()` | Waits for `next:` to remove from list | Apply removal immediately, rollback on error |
| `subtask-list.component.ts` | `onReorder()` | Waits for `next:` to reorder | Apply reorder immediately, rollback on error |
| `board-state.service.ts` | `createGroup()` | Waits for `next:`, then reloads all groups | Optimistic insert temp group, swap on confirm |
| `board-state.service.ts` | `updateGroupName()` | Waits for `next:`, then reloads | Optimistic rename, rollback on error |
| `board-state.service.ts` | `updateGroupColor()` | Waits for `next:`, then reloads | Optimistic color change, rollback on error |
| `board-state.service.ts` | `deleteGroup()` | Waits for `next:`, then full board reload | Optimistic remove, rollback on error |

---

## Backend Changes

**No backend changes required.**

All changes are purely frontend. The existing API contracts are sufficient:
- APIs return the updated entity on success (used to reconcile server-confirmed state)
- APIs return HTTP error codes on failure (used to trigger rollback)
- No idempotency tokens needed — the snapshot/rollback pattern handles this at the UI layer
- No version numbers needed — F2 does not implement conflict resolution (that is F3)

---

## Frontend Changes

### New Services

#### 1. `SaveStatusService` — Global save state tracker

**File:** `frontend/src/app/core/services/save-status.service.ts`
**Selector:** N/A (injectable service, `providedIn: 'root'`)

```
Signals:
  status: signal<'idle' | 'saving' | 'saved' | 'error'>('idle')
  pendingCount: signal<number>(0)
  lastError: signal<string | null>(null)

Methods:
  trackSave<T>(obs: Observable<T>, errorLabel?: string): Observable<T>
    - On subscribe: increment pendingCount, set status = 'saving'
    - On next/complete: decrement pendingCount
    - If pendingCount reaches 0: set status = 'saved', schedule transition to 'idle' after 2s
    - On error: decrement pendingCount, set status = 'error', set lastError, schedule transition to 'idle' after 5s
    - Re-throws the error so callers can still handle rollback

  reset(): void
    - Force status back to 'idle', clear pending

Private:
  savedTimeoutId: stores the 2s auto-clear timer
  errorTimeoutId: stores the 5s auto-clear timer
  Clears previous timer when a new save starts (prevents stale "Saved" showing during new save)
```

This service acts as a transparent wrapper — it does NOT change the semantics of the underlying API call. Callers still get the same Observable behavior. The service just observes the lifecycle to update the status signal.

#### 2. `retryTransient` — RxJS utility

**File:** `frontend/src/app/shared/utils/retry-transient.ts`

```
function retryTransient<T>(maxRetries = 1): MonoTypeOperatorFunction<T>
  - Uses RxJS `retry({ count: maxRetries, delay: (error, retryCount) => ... })`
  - Only retries if: error.status >= 500 OR error.status === 0 (network error) OR error.status === 408 (timeout)
  - Does NOT retry: 4xx errors (client errors, validation errors, auth errors)
  - Delay: 500ms * retryCount (linear backoff, max 1s)
  - After max retries exhausted, throws the original error
```

### New Components

#### 3. `SaveStatusIndicatorComponent` — "Saving..." / "Saved" badge

**File:** `frontend/src/app/shared/components/save-status-indicator/save-status-indicator.component.ts`
**Selector:** `app-save-status-indicator`

```
Template:
  @switch (saveStatus.status()) {
    @case ('saving') {
      <span class="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] animate-fade-in">
        <svg class="w-3.5 h-3.5 animate-spin"><!-- spinner icon --></svg>
        Saving...
      </span>
    }
    @case ('saved') {
      <span class="flex items-center gap-1.5 text-xs text-green-600 animate-fade-in">
        <svg class="w-3.5 h-3.5"><!-- checkmark icon --></svg>
        Saved
      </span>
    }
    @case ('error') {
      <span class="flex items-center gap-1.5 text-xs text-red-500 animate-fade-in">
        <svg class="w-3.5 h-3.5"><!-- warning icon --></svg>
        Save failed
      </span>
    }
    @case ('idle') {
      <!-- nothing rendered -->
    }
  }

Styles:
  - Tailwind utility classes only
  - animate-fade-in: opacity 0→1 over 200ms (defined in tailwind config or @keyframes)
  - Position: inline within top-nav, between breadcrumbs and right-side icons
  - Minimal footprint: ~50 lines total

Dependencies:
  - SaveStatusService (inject)
  - No PrimeNG components
```

### Modified Components

#### 4. `top-nav.component.ts` — Add save status indicator

**File:** `frontend/src/app/shared/components/top-nav/top-nav.component.ts`

Changes:
- Import `SaveStatusIndicatorComponent`
- Add `<app-save-status-indicator />` in the top nav bar between the breadcrumb and right-side icons
- Single line addition in template, single import addition

#### 5. `board-state.service.ts` — Wrap API calls with save tracking + retry

**File:** `frontend/src/app/features/board/board-view/board-state.service.ts`

Changes:
- Inject `SaveStatusService`
- Import `retryTransient` from shared utils
- Wrap every `.subscribe()` API call with `.pipe(retryTransient(), this.saveStatus.trackSave())` before subscribing
- Affected methods: `createTask`, `optimisticUpdateTask`, `optimisticAssignUser`, `optimisticUnassignUser`, `optimisticAddLabel`, `optimisticRemoveLabel`, `createColumn`, `reorderColumn`, `deleteColumn`, `deleteTask`
- Convert group operations to optimistic: `createGroup`, `updateGroupName`, `updateGroupColor`, `deleteGroup`
- No new signals or computed signals needed

Pattern for wrapping:
```typescript
// Before:
this.taskService.updateTask(taskId, req).subscribe({
  next: (updatedTask) => { /* reconcile */ },
  error: () => { /* rollback */ },
});

// After:
this.taskService.updateTask(taskId, req)
  .pipe(retryTransient(), this.saveStatus.trackSave('Update task'))
  .subscribe({
    next: (updatedTask) => { /* reconcile */ },
    error: () => { /* rollback */ },
  });
```

Group operations conversion to optimistic:
- `createGroup()`: insert temp group with UUID, swap on server response, rollback on error
- `updateGroupName()`: snapshot → apply rename → API → rollback on error (no full reload)
- `updateGroupColor()`: snapshot → apply color → API → rollback on error (no full reload)
- `deleteGroup()`: snapshot → remove → API → rollback on error (no full board reload)

#### 6. `board-drag-drop.handler.ts` — Wrap API calls with save tracking + retry

**File:** `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts`

Changes:
- Inject `SaveStatusService`
- Import `retryTransient`
- Wrap `onTaskMoved()` API call with `.pipe(retryTransient(), this.saveStatus.trackSave())`
- Wrap assignee/label API calls in `onSwimlaneTaskMoved()` similarly

#### 7. `board-bulk-actions.service.ts` — Wrap API calls with save tracking

**File:** `frontend/src/app/features/board/board-view/board-bulk-actions.service.ts`

Changes:
- Inject `SaveStatusService`
- Import `retryTransient`
- Wrap `bulkUpdate` and `bulkDelete` calls

#### 8. `task-detail.component.ts` (board drawer) — Wrap API calls with save tracking + retry

**File:** `frontend/src/app/features/board/task-detail/task-detail.component.ts`

Changes:
- Inject `SaveStatusService`
- Import `retryTransient`
- Wrap all API calls in `updateTask`, `onAssign`, `onUnassign`, `onAddLabel`, `onRemoveLabel`, `onMilestoneChange`, `onClearMilestone`

#### 9. `task-detail-page.component.ts` (standalone page) — Wrap API calls + fix remaining non-optimistic

**File:** `frontend/src/app/features/task-detail/task-detail-page.component.ts`

Changes:
- Inject `SaveStatusService`
- Import `retryTransient`
- Wrap all existing API calls with save tracking + retry
- Convert `onWatch()` to optimistic: apply watcher immediately, rollback on error, add MessageService toast
- Convert `onUnwatch()` to optimistic: apply removal immediately, rollback on error, add MessageService toast

#### 10. `subtask-list.component.ts` — Wrap API calls + fix remaining non-optimistic

**File:** `frontend/src/app/features/board/subtask-list/subtask-list.component.ts`

Changes:
- Inject `SaveStatusService`
- Import `retryTransient`
- Wrap `onToggle()` and `onAdd()` API calls with save tracking + retry
- Convert `onDelete()` to optimistic: snapshot → remove → API → rollback + showError on error
- Convert drag-reorder to optimistic: snapshot → reorder → API → rollback on error

---

## Signal Architecture

### New Signals (SaveStatusService)

| Signal | Type | Description |
|--------|------|-------------|
| `status` | `signal<'idle' \| 'saving' \| 'saved' \| 'error'>` | Global save state for the entire app |
| `pendingCount` | `signal<number>` | Number of in-flight save operations |
| `lastError` | `signal<string \| null>` | Description of most recent error |

### No New Computed Signals Needed

The `SaveStatusIndicatorComponent` reads `saveStatus.status()` directly via template signal binding.

### No Changes to Existing Signals

All existing `boardState`, `columns`, `task`, etc. signals remain unchanged. F2 is a non-invasive overlay that observes API call lifecycle without changing existing data flow.

---

## "Saving..." / "Saved" Status Indicator Design

### Placement
- In the top navigation bar, between breadcrumbs and the right-side icons (search, notifications, avatar)
- Always visible regardless of which page the user is on (board, standalone task page, settings)
- Small footprint: ~100px wide, single line of text + icon

### States

| State | Icon | Text | Color | Duration |
|-------|------|------|-------|----------|
| `idle` | none | none | — | Indefinite (default state) |
| `saving` | Spinning circle SVG | "Saving..." | `var(--muted-foreground)` | Until all in-flight calls resolve |
| `saved` | Checkmark SVG | "Saved" | `text-green-600` | 2 seconds, then fades to idle |
| `error` | Warning triangle SVG | "Save failed" | `text-red-500` | 5 seconds, then fades to idle |

### Transitions
```
idle ──[API call starts]──> saving
saving ──[all calls succeed]──> saved ──[2s]──> idle
saving ──[any call fails]──> error ──[5s]──> idle
saving ──[new call starts while saving]──> saving (reset saved timer)
saved ──[new call starts]──> saving (cancel saved timer)
```

### Animation
- Fade-in on appear (200ms ease-in)
- Fade-out on disappear (200ms ease-out)
- Spinner: CSS `animate-spin` (standard Tailwind)
- No layout shift: component has `min-width: 0` and uses flex positioning

---

## Phased Implementation

### Phase 1 — SaveStatusService + Indicator Component + retryTransient Utility

**Goal:** Build the core infrastructure — service, component, utility — and integrate into the top nav. Verify the indicator works with a manual test.

**Steps:**
1. Create `SaveStatusService` in `frontend/src/app/core/services/save-status.service.ts`
2. Create `retryTransient` utility in `frontend/src/app/shared/utils/retry-transient.ts`
3. Create `SaveStatusIndicatorComponent` in `frontend/src/app/shared/components/save-status-indicator/save-status-indicator.component.ts`
4. Add `<app-save-status-indicator />` to `top-nav.component.ts` template
5. Integrate `SaveStatusService.trackSave()` into `BoardStateService` (wrap all existing optimistic API calls)
6. Integrate `retryTransient()` into `BoardStateService` API call pipes
7. Run `npx tsc --noEmit` and fix any type errors
8. Manual test: make edits on the board, verify "Saving..." → "Saved" shows in top nav

**Deliverable:** Global save indicator working for all board-level operations.

### Phase 2 — Extend Tracking to All Contexts

**Goal:** Integrate save tracking into the board drawer, standalone task page, subtask list, drag-drop handler, and bulk actions.

**Steps:**
1. Wrap API calls in `task-detail.component.ts` (board drawer) with `trackSave()` + `retryTransient()`
2. Wrap API calls in `task-detail-page.component.ts` (standalone page) with `trackSave()` + `retryTransient()`
3. Wrap API calls in `board-drag-drop.handler.ts` with `trackSave()` + `retryTransient()`
4. Wrap API calls in `board-bulk-actions.service.ts` with `trackSave()`
5. Wrap API calls in `subtask-list.component.ts` with `trackSave()` + `retryTransient()`
6. Run `npx tsc --noEmit` and fix any type errors
7. Manual test: verify indicator works on board drawer edits, standalone task page edits, subtask toggles

**Deliverable:** Save indicator reflects ALL write operations across the entire app.

### Phase 3 — Remaining Optimistic Conversions + Error Recovery

**Goal:** Convert the last few non-optimistic write operations and improve error recovery.

**Steps:**
1. Convert `onWatch()` / `onUnwatch()` in `task-detail-page.component.ts` to optimistic with rollback + toast
2. Convert `onDelete()` in `subtask-list.component.ts` to optimistic (snapshot → remove → API → rollback)
3. Convert `onReorder()` in `subtask-list.component.ts` to optimistic (snapshot → reorder → API → rollback)
4. Convert `createGroup()` in `board-state.service.ts` to optimistic (temp group with UUID, swap on confirm, rollback on error)
5. Convert `updateGroupName()` in `board-state.service.ts` to optimistic (snapshot → rename → API → rollback, no full reload)
6. Convert `updateGroupColor()` in `board-state.service.ts` to optimistic (snapshot → color → API → rollback, no full reload)
7. Convert `deleteGroup()` in `board-state.service.ts` to optimistic (snapshot → remove → API → rollback, no full board reload)
8. Run `npx tsc --noEmit` and `npm run build -- --configuration=production`
9. Manual test with Slow 3G throttle: verify all operations feel instant
10. Test retry: simulate network error, verify retry + eventual rollback + toast

**Deliverable:** Every write operation in the app is optimistic with retry, rollback, and save status tracking.

---

## File Change List

### New Files

| File | Description |
|------|-------------|
| `frontend/src/app/core/services/save-status.service.ts` | Global save state tracking service with `trackSave()` RxJS operator |
| `frontend/src/app/shared/components/save-status-indicator/save-status-indicator.component.ts` | "Saving..." / "Saved" / "Error" indicator component for top nav |
| `frontend/src/app/shared/utils/retry-transient.ts` | RxJS operator that retries on 5xx/network errors, passes 4xx through |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/app/shared/components/top-nav/top-nav.component.ts` | Import and render `<app-save-status-indicator />` in top nav bar |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | Inject SaveStatusService; wrap all optimistic API calls with `trackSave()` + `retryTransient()`; convert group CRUD to optimistic |
| `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts` | Inject SaveStatusService; wrap API calls with `trackSave()` + `retryTransient()` |
| `frontend/src/app/features/board/board-view/board-bulk-actions.service.ts` | Inject SaveStatusService; wrap bulk API calls with `trackSave()` |
| `frontend/src/app/features/board/task-detail/task-detail.component.ts` | Inject SaveStatusService; wrap API calls with `trackSave()` + `retryTransient()` |
| `frontend/src/app/features/task-detail/task-detail-page.component.ts` | Inject SaveStatusService; wrap API calls; convert onWatch/onUnwatch to optimistic |
| `frontend/src/app/features/board/subtask-list/subtask-list.component.ts` | Inject SaveStatusService; wrap API calls; convert onDelete/onReorder to optimistic |

### Files That Do NOT Need Changes

| File | Reason |
|------|--------|
| `card-quick-edit-popover.component.ts` | Delegates entirely to BoardStateService (which gets tracking) |
| `board-websocket.handler.ts` | Handles incoming WS messages, no outgoing API calls |
| `board-shortcuts.service.ts` | Delegates to other services |
| All backend Rust files | No backend changes required |
| `undo.service.ts` | Separate concern, not affected by save tracking |

---

## Success Criteria Checklist

### Phase 1 — Core Infrastructure
- [ ] `SaveStatusService` exists and exports `trackSave<T>()` method
- [ ] `SaveStatusIndicatorComponent` renders in the top nav between breadcrumbs and right icons
- [ ] Making any board edit (drag card, change priority, add assignee) shows "Saving..." → "Saved" in top nav
- [ ] "Saved" indicator auto-hides after 2 seconds
- [ ] Multiple rapid edits show "Saving..." continuously until all complete, then "Saved"
- [ ] `retryTransient` utility retries once on simulated 500 error, does NOT retry on 400 error
- [ ] `npx tsc --noEmit` passes

### Phase 2 — Full Integration
- [ ] Editing task in board drawer (title, assignee, label, milestone) triggers save indicator
- [ ] Editing task on standalone `/task/:id` page triggers save indicator
- [ ] Toggling subtask checkbox triggers save indicator
- [ ] Bulk actions trigger save indicator
- [ ] Drag-and-drop triggers save indicator
- [ ] No duplicate "Saving..." messages — concurrent saves show a single "Saving..."

### Phase 3 — Remaining Conversions
- [ ] Adding/removing a watcher on standalone task page is instant (no wait for server)
- [ ] Deleting a subtask is instant with rollback on error
- [ ] Reordering subtasks by drag is instant with rollback on error
- [ ] Creating a task group is instant (temp group appears immediately)
- [ ] Renaming a task group is instant (no full group reload)
- [ ] Changing a task group color is instant (no full group reload)
- [ ] Deleting a task group is instant (no full board reload)
- [ ] On simulated API error with retryTransient: first retry fires automatically, second failure triggers rollback + "Save failed" in indicator + error toast
- [ ] Slow 3G throttle test: all operations feel instant (< 100ms perceived latency)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build -- --configuration=production` passes
- [ ] `cargo check --workspace --all-targets` passes (verifying no accidental breakage)

### Overall Quality
- [ ] Save status indicator matches or exceeds Google Docs / Notion "Saving..." UX
- [ ] No orphaned code — every new file is imported and used
- [ ] No `console.log` statements in production code
- [ ] All files under 800 lines
- [ ] No new RxJS Subjects for state — signals only for reactive state
- [ ] retryTransient only retries on 5xx/network/timeout — never on 4xx

---

## Anti-Patterns to Avoid

1. **Do not show per-card spinners** — the save indicator is global and subtle, not per-element
2. **Do not retry on 4xx errors** — these are client errors (validation, auth) that will never succeed on retry
3. **Do not block the UI during retry** — retry happens in the background; UI is already updated optimistically
4. **Do not introduce new RxJS Subjects/BehaviorSubjects** — use Angular signals for all reactive state
5. **Do not make `trackSave` change the Observable semantics** — it must re-throw errors so existing rollback logic still works
6. **Do not add `trackSave` to read operations** (GET requests) — only track mutations (POST/PUT/PATCH/DELETE)
7. **Do not show "Saved" on page load** — initial state should be 'idle', not 'saved'
8. **Do not use `setTimeout` for retry delays** — use RxJS `delay()` within the `retry` operator for proper teardown

---

## Notes on Architecture Decisions

### Why a Global Service (Not Per-Component State)

The save indicator must be visible in the top nav regardless of which component initiated the save. A global `providedIn: 'root'` service is the only way to achieve this without prop drilling or complex event bus patterns. The signal-based architecture means Angular's change detection handles the top-nav update automatically.

### Why trackSave Returns an Observable (Not Void)

By returning the same Observable with side effects, we can chain it with `retryTransient()` and still have the caller handle `next:` and `error:` for reconciliation and rollback. This is a transparent wrapper pattern — callers don't need to know about save tracking.

### Why retryTransient Is Separate from SaveStatusService

Separation of concerns: `retryTransient` handles retry logic (when to retry, how many times), `SaveStatusService` handles status display (when to show "Saving...", "Saved", "Error"). They compose via `pipe()` but are independently testable and optional.

### Why "Saved" Auto-Hides After 2 Seconds

User attention studies show that persistent status indicators become invisible noise after ~3 seconds. Google Docs uses 2s, Notion uses ~1.5s. We go with 2 seconds for a balance between reassurance and unobtrusiveness.
