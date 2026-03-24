# F3: Conflict Resolution — Implementation Plan

> Feature: Real-Time Conflict Resolution for Collaborative Task Editing
> Status: Planning
> Created: 2026-03-02

---

## 1. Requirements

### What F3 Means

When multiple users edit the same task simultaneously, TaskBolt must:

1. **Detect** that another user changed a field you are also viewing/editing.
2. **Notify** the current user with a clear, non-blocking message ("Priority changed by Alice 3s ago").
3. **Resolve** discrete field conflicts via Last-Write-Wins (LWW) with notifications.
4. **Prevent** silent data loss via version-based optimistic concurrency control (OCC).
5. **Handle** text field conflicts (description) with a simplified conflict dialog.

### Sub-Features In Scope

| # | Sub-Feature | Phase |
|---|-------------|-------|
| F3.1 | Field-level change tracking in WebSocket broadcasts | 1 |
| F3.2 | Conflict notification toasts ("X changed Y while you were editing") | 1 |
| F3.3 | `version` column on tasks for OCC | 2 |
| F3.4 | `expected_version` on update requests, 409 Conflict response | 2 |
| F3.5 | Frontend conflict dialog on 409 (show diff, choose action) | 2 |
| F3.6 | Description conflict detection + simplified merge dialog | 3 |

### Out of Scope

| Item | Reason |
|------|--------|
| Full Operational Transform (OT) for text | Requires server-side OT engine (e.g., ShareDB), 10x complexity; ship LWW first |
| CRDT-based real-time co-editing | Same complexity as OT; overkill for a task management app |
| Per-character conflict resolution | Full collaborative editing (Google Docs-level) is a separate product feature |
| Comment conflict resolution | Comments are append-only, no conflict possible |
| Per-field locking | Section 06 already plans task-level locking via Redis; field-level locks add complexity for little value |

---

## 2. Competitor Benchmark

### Winner Pattern (from comp.md)

> **OT for text fields (description, comments) + LWW for discrete fields (status, assignee, priority). On conflict: toast notification "Status changed by X (4s ago) while you edited -- your change was applied." Two strategies, two field types.**

### Key Gap

TaskBolt currently has **zero conflict detection**. The WebSocket broadcasts include only the updated task data (title, priority, column_id, position) but no information about *which fields changed* or *who made the change* (beyond a UUID). When two users edit the same task, the last HTTP response wins silently -- no notification, no version check, no field-level diff.

### Pragmatic Target

Full OT is out of scope. Our target is the **Notion pattern**: LWW with timestamp-based ordering for discrete fields, conflict notification toasts for awareness, version-based OCC to prevent stale overwrites, and a simplified "your version / their version" dialog for description text conflicts. This covers 90% of real-world task editing conflicts.

---

## 3. What Already Exists

### Version/Timestamp Tracking

- `tasks.updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` -- exists in DB schema
- `updated_at = NOW()` is set on every UPDATE in `update_task()` query
- **No `version` integer column** -- no OCC mechanism
- `TaskBroadcast.updated_at` is broadcast via WebSocket
- Frontend `Task` interface has `updated_at: string`

### Current Update Flow

1. User edits a field in task detail drawer (e.g., priority)
2. `BoardStateService.optimisticUpdateTask()` takes a snapshot, applies change locally
3. `TaskService.updateTask()` sends `PATCH /api/tasks/:id` with changed fields
4. Backend `update_task_handler()` calls `update_task()` SQL query (no version check)
5. SQL query updates fields + sets `updated_at = NOW()`, returns updated Task
6. Backend broadcasts `WsBoardEvent::TaskUpdated` via Redis pub/sub to `board:UUID` channel
7. On success: frontend replaces optimistic state with server response
8. On error: frontend rolls back to snapshot

### WebSocket Broadcast Flow

1. `BroadcastService.broadcast_board_event(board_id, event)` publishes to Redis channel
2. `WsBoardEvent::TaskUpdated { task: TaskBroadcast, origin_user_id }` is the event payload
3. Frontend `BoardWebsocketHandler.handleMessage()` receives via `WebSocketService.messages$`
4. Handler checks `origin_user_id == currentUser.id` -- **skips own messages**
5. Handler calls `boardState.update()` to replace/add/remove tasks in state

### What's Missing for Conflict Resolution

- **No `changed_fields` in broadcasts** -- other clients don't know which fields changed
- **No `origin_user_name` in broadcasts** -- can't show "Alice changed priority"
- **No version check on UPDATE** -- stale writes succeed silently
- **No frontend conflict detection** -- no comparison of "what I'm editing" vs "what changed remotely"
- **No conflict UI** -- no toasts, no diff dialog

---

## 4. Backend Changes

### Phase 1: Field-Level Change Tracking in Broadcasts

#### 4.1.1 SQL Migration: Add `version` column

**File:** `backend/crates/db/src/migrations/20260305000001_task_version.sql`

```sql
-- Add version column for optimistic concurrency control
ALTER TABLE tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Create trigger to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_task_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version := OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_version_increment
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION increment_task_version();
```

#### 4.1.2 Update Task Model

**File:** `backend/crates/db/src/models/task.rs`

Add `version: i32` field to the `Task` struct.

#### 4.1.3 Enhance TaskBroadcast

**File:** `backend/crates/db/src/models/ws_events.rs`

Add to `TaskBroadcast`:
- `version: i32` -- current version after update
- `changed_fields: Vec<String>` -- list of field names that changed (e.g., `["priority", "due_date"]`)
- `origin_user_name: String` -- display name of the user who made the change

#### 4.1.4 Compute Changed Fields in Update Handler

**File:** `backend/crates/api/src/routes/task_crud.rs`

In `update_task_handler()`:
1. Before calling `update_task()`, fetch the current task state
2. After update, compare old vs new to determine `changed_fields`
3. Fetch the user's display name for `origin_user_name`
4. Include both in the broadcast event

#### 4.1.5 Add User Name Lookup Helper

**File:** `backend/crates/api/src/routes/task_helpers.rs`

Add `get_user_display_name(pool, user_id) -> Option<String>` helper.

### Phase 2: Optimistic Concurrency Control

#### 4.2.1 Add `expected_version` to Update Request

**File:** `backend/crates/api/src/routes/task_helpers.rs`

Add `expected_version: Option<i32>` to `UpdateTaskRequest`.

#### 4.2.2 Version-Checked Update Query

**File:** `backend/crates/db/src/queries/tasks.rs`

Create `update_task_with_version()`:
```sql
UPDATE tasks
SET title = COALESCE($2, title), ...
    updated_at = NOW()
WHERE id = $1 AND deleted_at IS NULL AND version = $14
RETURNING ...
```

If `expected_version` is provided and the row is not found (version mismatch), return a new error variant `TaskQueryError::VersionConflict { current_version: i32, expected_version: i32 }`.

#### 4.2.3 Return 409 Conflict

**File:** `backend/crates/api/src/routes/task_crud.rs`

Map `TaskQueryError::VersionConflict` to HTTP 409 Conflict with body:
```json
{
  "error": "version_conflict",
  "current_version": 5,
  "expected_version": 3,
  "current_task": { ... }
}
```

#### 4.2.4 Add `VersionConflict` Error Variant

**File:** `backend/crates/db/src/queries/tasks.rs` (TaskQueryError enum)

Add:
```rust
VersionConflict {
    current_version: i32,
    expected_version: i32,
}
```

**File:** `backend/crates/api/src/errors.rs`

Map to HTTP 409.

### Phase 3: Move Task Version Check

#### 4.3.1 Add version check to move_task

**File:** `backend/crates/api/src/routes/task_movement.rs`

Add optional `expected_version` to `MoveTaskRequest`. When provided, check version before moving.

---

## 5. Frontend Changes

### Phase 1: Conflict Notification Toasts

#### 5.1.1 Update Task Interface

**File:** `frontend/src/app/core/services/task.service.ts`

Add to `Task` interface:
```typescript
version?: number;
```

Add to `UpdateTaskRequest`:
```typescript
expected_version?: number;
```

#### 5.1.2 Create ConflictNotificationService

**File:** `frontend/src/app/core/services/conflict-notification.service.ts` (NEW)

Responsibilities:
- Track which fields the current user is actively editing (signal-based)
- Compare incoming WS `changed_fields` against active editing fields
- Show PrimeNG toast when conflict detected
- Provide `registerEditingField(taskId, fieldName)` and `unregisterEditingField(taskId, fieldName)`

```typescript
@Injectable({ providedIn: 'root' })
export class ConflictNotificationService {
  private messageService = inject(MessageService);

  // Map<taskId, Set<fieldName>> -- fields currently being edited by this user
  private readonly editingFields = signal<Map<string, Set<string>>>(new Map());

  registerEditingField(taskId: string, fieldName: string): void { ... }
  unregisterEditingField(taskId: string, fieldName: string): void { ... }
  clearEditingFields(taskId: string): void { ... }

  /**
   * Called by BoardWebsocketHandler when a task:updated event arrives from another user.
   * Returns true if any of the changed fields overlap with fields being edited.
   */
  checkConflict(taskId: string, changedFields: string[], originUserName: string): boolean { ... }
}
```

Toast format:
```
"Priority changed by Alice (3s ago)"
"Title and description changed by Bob while you were editing"
```

#### 5.1.3 Enhance BoardWebsocketHandler

**File:** `frontend/src/app/features/board/board-view/board-websocket.handler.ts`

Changes:
- Inject `ConflictNotificationService`
- When handling `task:updated`, extract `changed_fields`, `origin_user_name`, `version`
- Call `conflictService.checkConflict()` before applying state update
- If conflict detected, show toast but still apply the remote change (LWW)
- Update the task's `version` in local state

Updated `handleTaskUpdated()`:
```typescript
private handleTaskUpdated(data: {
  task: Task;
  changed_fields?: string[];
  origin_user_name?: string;
}): void {
  // Check for conflict with fields being edited by current user
  if (data.changed_fields?.length && data.origin_user_name) {
    this.conflictService.checkConflict(
      data.task.id,
      data.changed_fields,
      data.origin_user_name
    );
  }

  // Apply remote state (LWW)
  this.state.boardState.update((state) => { ... });
}
```

#### 5.1.4 Track Editing Fields in Task Detail

**File:** `frontend/src/app/features/board/task-detail/task-detail.component.ts`

Changes:
- Inject `ConflictNotificationService`
- On task detail open: no editing fields registered yet
- When user focuses a field (priority dropdown, title input, etc.): `registerEditingField(taskId, 'priority')`
- When user blurs / saves: `unregisterEditingField(taskId, 'priority')`
- On task detail close: `clearEditingFields(taskId)`

#### 5.1.5 Track Editing Fields in Quick-Edit Popovers

**File:** `frontend/src/app/features/board/board-view/card-quick-edit/card-quick-edit-popover.component.ts`

Changes:
- Register editing field when popover opens
- Unregister when popover closes or value is saved

#### 5.1.6 Add Toast Container to Board View

**File:** `frontend/src/app/features/board/board-view/board-view.component.ts`

Ensure `p-toast` is present for conflict notifications (may already exist for error toasts -- verify).

### Phase 2: Handle 409 Conflict Response

#### 5.2.1 Create ConflictDialogComponent

**File:** `frontend/src/app/shared/components/conflict-dialog/conflict-dialog.component.ts` (NEW)

A PrimeNG Dialog that shows:
- "This task was modified by {name} while you were editing"
- Two-column diff: "Your changes" vs "Current version"
- Three actions: "Keep my changes" (force overwrite), "Use their version" (discard mine), "Review" (show detail)
- Only shown when 409 is received (Phase 2 -- not for LWW toasts)

```typescript
@Component({
  selector: 'app-conflict-dialog',
  standalone: true,
  imports: [Dialog, ButtonModule, CommonModule],
  template: `...`
})
export class ConflictDialogComponent {
  visible = input(false);
  myChanges = input<Partial<Task>>({});
  currentTask = input<Task | null>(null);
  conflictFields = input<string[]>([]);
  originUserName = input('');

  resolved = output<'force' | 'discard' | 'merge'>();
}
```

#### 5.2.2 Enhance TaskService for 409 Handling

**File:** `frontend/src/app/core/services/task.service.ts`

Add an interceptor or handler in `updateTask()` that:
- Catches HTTP 409
- Extracts `current_version` and `current_task` from response body
- Emits a conflict event that the calling component can handle

Approach: Return a typed error observable that BoardStateService can catch:

```typescript
export interface ConflictError {
  type: 'version_conflict';
  currentVersion: number;
  expectedVersion: number;
  currentTask: Task;
}
```

#### 5.2.3 Update BoardStateService for Version Tracking

**File:** `frontend/src/app/features/board/board-view/board-state.service.ts`

Changes to `optimisticUpdateTask()`:
- Include `expected_version` in the update request (from the task's current `version`)
- On 409 error: show conflict dialog instead of just rolling back
- After user resolves conflict: either force-update with new version, or discard

#### 5.2.4 Update Task Detail for Version-Aware Saves

**File:** `frontend/src/app/features/board/task-detail/task-detail.component.ts`

When saving any field change:
- Include the task's current `version` in the update request
- Handle 409 by showing the conflict dialog

### Phase 3: Description Conflict Detection

#### 5.3.1 Description Conflict Banner

**File:** `frontend/src/app/features/board/task-detail/task-detail-description.component.ts`

When the user is editing the description and a WS event shows another user changed the description:
- Show an inline banner above the editor: "Description was updated by Alice. [View changes] [Keep editing] [Reload]"
- "View changes" shows a side-by-side diff (simple text diff, not line-by-line OT)
- "Keep editing" dismisses the banner (user's save will overwrite)
- "Reload" discards local changes and loads the server version

#### 5.3.2 Simple Text Diff Utility

**File:** `frontend/src/app/shared/utils/text-diff.ts` (NEW)

A lightweight function to compute a simple word-level diff between two strings. Used by the description conflict banner to highlight what changed. No external library needed -- use a minimal LCS-based diff.

---

## 6. Phased Implementation

### Phase 1: LWW with Conflict Notifications (Core Value)

**Scope:** Backend field-level change tracking + frontend conflict toasts.

**Tasks:**
1. SQL migration: add `version` column + auto-increment trigger
2. Update `Task` Rust model with `version: i32`
3. Update all `RETURNING` clauses in task queries to include `version`
4. Enhance `TaskBroadcast` with `changed_fields`, `origin_user_name`, `version`
5. Compute `changed_fields` in `update_task_handler` by comparing before/after
6. Add `get_user_display_name()` helper
7. Update frontend `Task` interface with `version?: number`
8. Create `ConflictNotificationService`
9. Enhance `BoardWebsocketHandler` to extract and pass conflict info
10. Wire up editing field tracking in task detail + quick-edit popovers
11. Add conflict toast display via PrimeNG MessageService
12. Update `BoardStateService.loadBoard()` to include `version` in task mapping
13. Verify: two browser tabs, edit same task, see toast notification

**Estimated effort:** 2-3 sessions

### Phase 2: Optimistic Concurrency Control (Safety Net)

**Scope:** Version-based conflict rejection + conflict dialog.

**Tasks:**
1. Add `expected_version` to `UpdateTaskRequest` (backend + frontend)
2. Create `update_task_with_version()` query
3. Add `VersionConflict` error variant to `TaskQueryError`
4. Map `VersionConflict` to HTTP 409 in error handler
5. Update `update_task_handler` to use version-checked query when `expected_version` provided
6. Create `ConflictDialogComponent`
7. Update `TaskService` to handle 409 responses
8. Update `BoardStateService.optimisticUpdateTask()` with version + conflict dialog flow
9. Wire conflict dialog into task detail saves
10. Verify: two tabs, both edit same field, second save gets conflict dialog

**Estimated effort:** 2 sessions

### Phase 3: Text Field Conflict Handling (Polish)

**Scope:** Description-specific conflict detection + simplified merge.

**Tasks:**
1. Create `text-diff.ts` utility
2. Add description conflict banner to `task-detail-description.component.ts`
3. Wire WS events to detect description changes while editing
4. Implement "View changes" / "Keep editing" / "Reload" actions
5. Verify: two tabs, both edit description, see inline conflict banner

**Estimated effort:** 1 session

---

## 7. File Change List

### New Files

| File | Description |
|------|-------------|
| `backend/crates/db/src/migrations/20260305000001_task_version.sql` | Migration: add `version` column + auto-increment trigger |
| `frontend/src/app/core/services/conflict-notification.service.ts` | Service to track editing fields and show conflict toasts |
| `frontend/src/app/shared/components/conflict-dialog/conflict-dialog.component.ts` | Dialog for 409 conflict resolution (Phase 2) |
| `frontend/src/app/shared/utils/text-diff.ts` | Lightweight word-level text diff utility (Phase 3) |

### Modified Files

| File | Changes |
|------|---------|
| `backend/crates/db/src/models/task.rs` | Add `version: i32` to `Task` struct |
| `backend/crates/db/src/models/ws_events.rs` | Add `changed_fields`, `origin_user_name`, `version` to `TaskBroadcast` |
| `backend/crates/db/src/queries/tasks.rs` | Update RETURNING clauses to include `version`; add `update_task_with_version()`; add `VersionConflict` error variant |
| `backend/crates/api/src/routes/task_crud.rs` | Compute changed_fields, fetch user name, use version-checked update |
| `backend/crates/api/src/routes/task_helpers.rs` | Add `expected_version` to `UpdateTaskRequest`; add `get_user_display_name()` |
| `backend/crates/api/src/routes/task_movement.rs` | Add optional version check to move handler |
| `backend/crates/api/src/errors.rs` | Map `VersionConflict` to HTTP 409 |
| `frontend/src/app/core/services/task.service.ts` | Add `version` to `Task`; add `expected_version` to `UpdateTaskRequest`; handle 409 |
| `frontend/src/app/features/board/board-view/board-websocket.handler.ts` | Extract conflict info from WS events, call ConflictNotificationService |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | Include version in task mapping; version-aware `optimisticUpdateTask()` |
| `frontend/src/app/features/board/task-detail/task-detail.component.ts` | Register/unregister editing fields; handle conflict dialog |
| `frontend/src/app/features/board/task-detail/task-detail-description.component.ts` | Description conflict banner (Phase 3) |
| `frontend/src/app/features/board/board-view/card-quick-edit/card-quick-edit-popover.component.ts` | Register editing fields for quick-edit |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | Ensure p-toast for conflict notifications |

---

## 8. Signal Architecture for Conflict Detection

```
ConflictNotificationService
  editingFields: WritableSignal<Map<taskId, Set<fieldName>>>
    |
    | registerEditingField(taskId, field)
    | unregisterEditingField(taskId, field)
    |
    v
  checkConflict(taskId, changedFields, userName)
    |
    | compare changedFields vs editingFields.get(taskId)
    | if intersection: show toast via MessageService
    |
    v
  PrimeNG Toast: "Priority changed by Alice"
```

```
BoardWebsocketHandler
  on task:updated event from another user:
    1. Extract: task, changed_fields, origin_user_name, version
    2. Call conflictService.checkConflict(...)
    3. Update boardState with new task data (LWW -- remote wins)
    4. Update task.version in local state
```

```
BoardStateService.optimisticUpdateTask() (Phase 2):
  1. Snapshot state
  2. Apply optimistic update
  3. PATCH /api/tasks/:id with { ...changes, expected_version: task.version }
  4a. On 200: replace with server data, update version
  4b. On 409: show ConflictDialog
    - "Force overwrite": re-send with new expected_version
    - "Discard": rollback to snapshot, apply remote data
    - "Review": show diff dialog
  4c. On other error: rollback to snapshot
```

---

## 9. Conflict Notification UI Design

### Toast (Phase 1 -- LWW Notifications)

```
+------------------------------------------+
| i  Priority changed by Alice (3s ago)    |
|    Your board has been updated.          |
+------------------------------------------+
```

- Position: top-right
- Duration: 5 seconds, auto-dismiss
- Severity: `info` (blue)
- Multiple field changes grouped: "Title and priority changed by Bob"
- Link to task if not currently viewing it

### Conflict Dialog (Phase 2 -- 409 Response)

```
+--------------------------------------------------+
|  Conflict Detected                          [X]   |
|                                                   |
|  This task was modified by Alice while you        |
|  were editing.                                    |
|                                                   |
|  +-------------------+  +-------------------+     |
|  | Your Changes      |  | Current Version   |     |
|  | Priority: Urgent  |  | Priority: High    |     |
|  | Due: Mar 15       |  | Due: Mar 20       |     |
|  +-------------------+  +-------------------+     |
|                                                   |
|  [Keep My Changes]  [Use Their Version]  [Cancel] |
+--------------------------------------------------+
```

- Modal dialog (blocks interaction)
- Two-column layout showing differing fields
- Three actions:
  - "Keep My Changes" -- force update (sends with latest version)
  - "Use Their Version" -- discard local changes, reload from server
  - "Cancel" -- close dialog, leave in conflicted state

### Description Conflict Banner (Phase 3)

```
+--------------------------------------------------+
| !  Description was updated by Alice.              |
|    [View changes]  [Keep editing]  [Reload]       |
+--------------------------------------------------+
```

- Inline banner above the description editor
- Yellow/warning color
- "View changes" expands a diff view inline
- "Keep editing" dismisses (user's save will overwrite)
- "Reload" discards local, loads server version

---

## 10. Success Criteria Checklist

### Phase 1

- [ ] `tasks` table has `version INTEGER NOT NULL DEFAULT 1` column
- [ ] Version auto-increments on every UPDATE (trigger verified)
- [ ] `TaskBroadcast` includes `changed_fields`, `origin_user_name`, `version`
- [ ] WebSocket `task:updated` events contain field-level change information
- [ ] Opening task detail in two browser tabs, editing priority in Tab A, shows a toast in Tab B: "Priority changed by [user] (Xs ago)"
- [ ] Quick-edit popover changes also trigger conflict toasts in other tabs
- [ ] Conflict toasts auto-dismiss after 5 seconds
- [ ] Multiple field changes are grouped in a single toast
- [ ] LWW is applied: remote changes always update local state regardless of conflict
- [ ] `cargo check --workspace --all-targets` passes
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build -- --configuration=production` passes

### Phase 2

- [ ] `UpdateTaskRequest` accepts `expected_version` field
- [ ] Sending an update with stale `expected_version` returns HTTP 409
- [ ] 409 response body contains `current_version`, `current_task`
- [ ] ConflictDialogComponent renders with two-column diff of changed fields
- [ ] "Keep My Changes" re-sends update with latest version and succeeds
- [ ] "Use Their Version" discards local changes and reloads from server
- [ ] Updates WITHOUT `expected_version` still work (backward compatible)
- [ ] All cargo/tsc/build checks pass

### Phase 3

- [ ] Editing description in Tab A while Tab B modifies description shows inline banner
- [ ] "View changes" shows a word-level diff of the two description versions
- [ ] "Keep editing" dismisses the banner
- [ ] "Reload" discards local description changes and loads server version
- [ ] All cargo/tsc/build checks pass

---

## 11. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Version trigger conflicts with existing UPDATE queries | Low | Medium | Trigger only fires on UPDATE, transparent to existing code |
| Performance: extra query to fetch old task for diff | Low | Low | Single SELECT by PK, <1ms |
| Toast notification fatigue | Medium | Low | Group multiple field changes, auto-dismiss, only show for tasks user is actively viewing |
| 409 conflicts confusing non-tech users | Medium | Medium | Clear, friendly dialog with "Keep my changes" as primary action |
| Description diff inaccuracy | Low | Low | Word-level diff is sufficient; not char-level |

---

## 12. Testing Strategy

### Backend Unit Tests

- `test_task_version_increments_on_update` -- verify version goes 1 -> 2 -> 3
- `test_update_task_with_version_succeeds` -- matching version updates successfully
- `test_update_task_with_version_conflicts` -- mismatched version returns error
- `test_changed_fields_computation` -- verify correct field diff
- `test_task_broadcast_includes_version` -- serialization roundtrip

### Frontend Unit Tests

- `ConflictNotificationService should register and unregister editing fields`
- `ConflictNotificationService should detect conflict when changed_fields overlap`
- `ConflictNotificationService should not alert when no overlap`
- `ConflictDialogComponent should show diff of conflicting fields`
- `ConflictDialogComponent should emit 'force' when user keeps changes`
- `BoardWebsocketHandler should pass conflict info to ConflictNotificationService`

### E2E Tests

- Open same task in two browser contexts
- Edit priority in context A
- Verify toast appears in context B
- Edit priority in both contexts simultaneously
- Verify conflict dialog appears (Phase 2)

---

*Plan complete. Ready for implementation.*
