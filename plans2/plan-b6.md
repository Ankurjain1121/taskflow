# Plan: B6 — Swimlanes (Group By)

**Generated:** 2026-03-02
**Feature:** B6 from TASK.md — Swimlanes / Group By
**Stack:** Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19, Rust/Axum, PostgreSQL 16

---

## Requirements

### What B6 Means

Swimlanes transform the kanban board from a flat column layout into a 2D grid: columns on the X-axis, swimlane rows (groups) on the Y-axis. A "Group by" dropdown in the toolbar selects the dimension (assignee, priority, label) used to partition tasks into horizontal bands. Each band has a label on the left, and within each band the existing columns are repeated. Dragging a card from one swimlane row to another changes the grouped property on that task.

### Sub-Features In Scope

1. **Group By dropdown** in the board toolbar — options: None / Assignee / Priority / Label
2. **Swimlane row rendering** — horizontal bands with a sticky left label column showing the group identity (avatar for assignee, colored dot for priority, color chip for label)
3. **"None / Unassigned" catch-all row** — tasks with no assignee / undefined priority / no labels get their own row at the bottom
4. **Read-only swimlane view** (Phase 1) — renders correctly, tasks visible in correct rows, no cross-lane drag required first
5. **Cross-lane drag-drop** (Phase 2) — drag from one swimlane to another reassigns the grouped property (assignee, priority, or label) on the task via API
6. **Swimlane collapse** — click a row's label to collapse/expand it (localStorage persistence)
7. **Empty lane handling** — lanes with zero tasks after filtering show a subtle empty-state placeholder
8. **Swimlane state persistence** — selected `groupBy` persists in `localStorage` per board (key: `tf_swimlane_${boardId}`)

### Sub-Features Explicitly Out of Scope

| Sub-Feature | Reason |
|-------------|--------|
| "Group by: Due Date" (date buckets) | Requires date-range bucketing logic and date-aware UX — deferred to B6 follow-up |
| "Group by: Custom Fields" | Custom fields are heterogeneous (text/select/number) — separate feature |
| Swimlane ordering / reorder by drag | Not a standard pattern in any competitor — adds complexity without clear gain |
| Server-side swimlane API | All data is already loaded in `boardState`; grouping is pure client-side computed logic |
| WebSocket sync of swimlane property changes | Existing WS handler for `TaskUpdated` will surface changes; no new WS events needed |

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> "Group by" dropdown → generates horizontal row bands with label on left. Each band = one CDK drop list group. Drag within row = normal. Drag across rows = reassign the group property. "None" row catches unassigned items. Start with read-only swimlanes (no cross-row DnD), add cross-group DnD later.

Linear, ClickUp, Jira, Height and Notion all implement this pattern. The key design decisions from the top implementations:

- **Linear:** Group by dropdown in the "Display" menu, horizontal bands, sticky label column, collapse per row
- **Jira:** Epic swimlanes with explicit "None" row, collapsible, card count per cell (column × row)
- **ClickUp:** Full cross-swimlane drag with property reassignment, most polished version

### Most Important Gap vs Best-in-Class

TaskBolt currently has **no swimlane / group-by capability at all**. The single most important gap is that the board is always flat — there is no way to group tasks by assignee or priority, which is a core workflow feature in every major competitor. This limits team visibility when boards have multiple assignees.

---

## What Already Exists

### Frontend

| File | What Exists | What to Extend |
|------|-------------|----------------|
| `board-state.service.ts` | `boardState` signal, `filteredBoardState` computed, `columns` signal, `boardMembers` signal, `allAssignees` computed, `allLabels` computed, `cardDensity` signal | Add: `groupBy` signal, `swimlaneGroups` computed, `collapsedSwimlaneIds` signal, `swimlaneFilteredState` computed |
| `board-toolbar.component.ts` | Search, priority/assignee/label filters, density toggle, view mode toggle, filter presets | Add: "Group By" dropdown before density toggle; emit `groupByChanged` output |
| `board-view.component.ts` | Kanban grid with `@for (column of columns)` → `<app-kanban-column>`, CDK horizontal drop list for column reorder | Replace kanban grid block with swimlane-aware branch when `groupBy !== 'none'`; add `cdkDropListGroup` |
| `board-drag-drop.handler.ts` | `onTaskMoved` — reads `filteredBoardState`, computes fractional position, calls `moveTask` API, broadcasts WS | Extend: when swimlanes active, `onTaskMoved` must also call property-update API when lane changed |
| `task.service.ts` | `moveTask(taskId, {column_id, position})`, `updateTask(taskId, request)`, `assignUser/unassignUser` | Add: `updateTaskGroupProperty(taskId, groupBy, value)` — thin wrapper routing to correct API |
| `board-shortcuts.service.ts` | Existing shortcuts | No changes needed for Phase 1 |

### Backend

| File | What Exists | What to Extend |
|------|-------------|----------------|
| `task_movement.rs` | `PATCH /api/tasks/:id/move` — changes `column_id` + `position` | Does NOT change assignee/priority/label — those use separate endpoints |
| `task_crud.rs` | `PATCH /api/tasks/:id` — accepts `UpdateTaskRequest` (title, description, priority, due_date, etc.) — **priority is already patchable** | Priority reassignment already works. Extend `UpdateTaskRequest` to accept `assignee_ids` if cross-assignee DnD needed |
| `task_assignment.rs` | `POST /api/tasks/:id/assignees` (add), `DELETE /api/tasks/:id/assignees/:user_id` (remove) | Used for cross-assignee swimlane moves — no changes needed, just needs frontend calls |
| `task_crud.rs` `UpdateTaskRequest` | Has `priority: Option<TaskPriority>` | Already supports priority change via PATCH — no backend change needed for priority swimlane |

**Key insight: For Phase 1 (read-only) and Phase 2 (cross-lane drag), no new backend endpoints are required.** All needed APIs already exist:
- Priority change: `PATCH /api/tasks/:id` with `{ priority: "..." }`
- Assignee change: `POST /api/tasks/:id/assignees` + `DELETE /api/tasks/:id/assignees/:user_id`
- Label reassignment: `POST /api/tasks/:id/labels/:labelId` + `DELETE /api/tasks/:id/labels/:labelId`

---

## Backend Changes

**No backend changes required.** All APIs for property reassignment already exist:

| Action | Existing API |
|--------|-------------|
| Change priority when dragged across priority lane | `PATCH /api/tasks/:id` with `{ "priority": "high" }` |
| Change assignee when dragged across assignee lane | `DELETE /api/tasks/:id/assignees/:old_id` + `POST /api/tasks/:id/assignees` with `{ "user_id": "..." }` |
| Change/add label when dragged across label lane | `POST /api/tasks/:id/labels/:labelId` |
| Move within same lane (column change) | Existing `PATCH /api/tasks/:id/move` |

Note: The `UpdateTaskRequest` struct in `task_helpers.rs` does NOT currently include `assignee_ids`. For Phase 2 cross-assignee DnD, the frontend should call the existing separate `assignUser`/`unassignUser` endpoints sequentially, not modify the PATCH handler.

---

## Frontend Changes

### New Components

#### 1. `swimlane-row.component.ts`
- **Path:** `frontend/src/app/features/board/swimlane-row/swimlane-row.component.ts`
- **Selector:** `app-swimlane-row`
- **Purpose:** Renders one horizontal swimlane band: sticky label column on left + repeated kanban columns for that row
- **Inputs:**
  ```typescript
  readonly swimlaneGroup = input.required<SwimlaneGroup>();
  readonly columns = input.required<Column[]>();
  readonly tasksByCell = input.required<Record<string, Task[]>>(); // key: `${columnId}:${groupKey}`
  readonly connectedListIds = input.required<string[]>();
  readonly density = input.required<'compact' | 'normal' | 'expanded'>();
  readonly isCollapsed = input.required<boolean>();
  readonly celebratingTaskId = input<string | null>(null);
  readonly focusedTaskId = input<string | null>(null);
  readonly selectedTaskIds = input<string[]>([]);
  ```
- **Outputs:** Same as KanbanColumnComponent (taskMoved, taskClicked, addTaskClicked, selectionToggled, etc.) — pass-through
- **Template sketch:**
  ```
  <div class="swimlane-row border-b border-[var(--border)] mb-2">
    <!-- Sticky label on left -->
    <div class="swimlane-label sticky left-0 z-10 w-[160px] flex-shrink-0 bg-[var(--card)] border-r border-[var(--border)] flex items-center gap-2 px-3 py-2 cursor-pointer" (click)="toggleCollapse.emit()">
      [group avatar/dot/chip]
      <span class="text-sm font-medium">{{ swimlaneGroup().label }}</span>
      <span class="text-xs text-[var(--muted-foreground)]">({{ totalCount() }})</span>
      <i class="pi pi-chevron-down text-xs transition-transform" [class.rotate-180]="isCollapsed()"></i>
    </div>

    @if (!isCollapsed()) {
      <!-- Columns for this row -->
      <div class="flex gap-2 flex-1 min-w-0 overflow-x-auto p-2">
        @for (column of columns(); track column.id) {
          <app-kanban-column
            [column]="column"
            [tasks]="getTasksForCell(column.id)"
            [cdkDropListId]="getListId(column.id)"
            [connectedLists]="connectedListIds()"
            ... (same bindings as board-view)
            (taskMoved)="onTaskMoved($event)"
          />
        }
      </div>
    }
  </div>
  ```
- **Size estimate:** ~200 lines

#### 2. `swimlane-container.component.ts`
- **Path:** `frontend/src/app/features/board/swimlane-container/swimlane-container.component.ts`
- **Selector:** `app-swimlane-container`
- **Purpose:** Wraps all swimlane rows inside a `cdkDropListGroup`. Owns the swimlane scroll container. Manages cross-lane drop routing.
- **Inputs:**
  ```typescript
  readonly swimlaneGroups = input.required<SwimlaneGroup[]>();
  readonly columns = input.required<Column[]>();
  readonly swimlaneState = input.required<SwimlaneState>(); // SwimlaneState = Record<string, Record<string, Task[]>>
  readonly groupBy = input.required<GroupByMode>();
  readonly density = input.required<'compact' | 'normal' | 'expanded'>();
  readonly collapsedSwimlaneIds = input.required<Set<string>>();
  ```
- **Outputs:** `taskMoved` (with extra `fromGroupKey`/`toGroupKey`), `taskClicked`, `swimlaneToggled`
- **Template sketch:**
  ```
  <div cdkDropListGroup class="flex-1 overflow-x-auto overflow-y-auto p-4">
    @for (group of swimlaneGroups(); track group.key) {
      <app-swimlane-row
        [swimlaneGroup]="group"
        [columns]="columns()"
        [tasksByCell]="getCellsForGroup(group.key)"
        [connectedListIds]="allListIds()"
        [isCollapsed]="collapsedSwimlaneIds().has(group.key)"
        (taskMoved)="onTaskMovedInRow($event, group.key)"
        (toggleCollapse)="swimlaneToggled.emit(group.key)"
      />
    }
  </div>
  ```
- **Size estimate:** ~150 lines

### Modified Components

#### `board-state.service.ts`
**Path:** `frontend/src/app/features/board/board-view/board-state.service.ts`
**Changes:**

1. Add `GroupByMode` type and `SwimlaneGroup` interface (or put in shared types file):
```typescript
export type GroupByMode = 'none' | 'assignee' | 'priority' | 'label';

export interface SwimlaneGroup {
  key: string;          // unique key: assignee ID, priority string, label ID, or 'none'
  label: string;        // display: user name, "High", label name, "No Assignee"
  color?: string;       // avatar bg or label/priority color
  avatarUrl?: string;   // for assignee mode
  isNone: boolean;      // true for the "unassigned/no label" catch-all row
}
```

2. Add signals:
```typescript
readonly groupBy = signal<GroupByMode>(
  (localStorage.getItem(`tf_swimlane_${this.boardId}`) as GroupByMode) ?? 'none'
);
readonly collapsedSwimlaneIds = signal<Set<string>>(new Set());
```

3. Add computed `swimlaneGroups`:
```typescript
readonly swimlaneGroups = computed((): SwimlaneGroup[] => {
  const mode = this.groupBy();
  const state = this.boardState();
  if (mode === 'none') return [];

  const groupMap = new Map<string, SwimlaneGroup>();
  const noneGroup: SwimlaneGroup = { key: '__none__', label: this.getNoneLabel(mode), isNone: true };

  for (const tasks of Object.values(state)) {
    for (const task of tasks) {
      const groups = this.getTaskGroups(task, mode);
      if (groups.length === 0) {
        groupMap.set('__none__', noneGroup);
      } else {
        for (const g of groups) {
          if (!groupMap.has(g.key)) groupMap.set(g.key, g);
        }
      }
    }
  }

  // Sort: named groups first (alphabetical by label), then none row last
  const sorted = Array.from(groupMap.values())
    .filter(g => !g.isNone)
    .sort((a, b) => a.label.localeCompare(b.label));

  if (groupMap.has('__none__')) sorted.push(noneGroup);
  return sorted;
});
```

4. Add computed `swimlaneFilteredState`:
```typescript
// Returns: Record<groupKey, Record<columnId, Task[]>>
readonly swimlaneFilteredState = computed(() => {
  const mode = this.groupBy();
  const filtered = this.filteredBoardState();
  const groups = this.swimlaneGroups();
  if (mode === 'none') return {};

  const result: Record<string, Record<string, Task[]>> = {};

  for (const group of groups) {
    result[group.key] = {};
    for (const [columnId, tasks] of Object.entries(filtered)) {
      result[group.key][columnId] = tasks.filter(task => {
        const taskGroups = this.getTaskGroups(task, mode);
        if (group.isNone) return taskGroups.length === 0;
        return taskGroups.some(g => g.key === group.key);
      });
    }
  }

  return result;
});
```

5. Add helper methods:
```typescript
private getTaskGroups(task: Task, mode: GroupByMode): SwimlaneGroup[] {
  switch (mode) {
    case 'assignee':
      return (task.assignees ?? []).map(a => ({
        key: a.id,
        label: a.display_name ?? a.email ?? 'Unknown',
        avatarUrl: a.avatar_url ?? undefined,
        color: undefined,
        isNone: false,
      }));
    case 'priority':
      return task.priority ? [{
        key: task.priority,
        label: this.priorityLabel(task.priority),
        color: this.priorityColor(task.priority),
        isNone: false,
      }] : [];
    case 'label':
      return (task.labels ?? []).map(l => ({
        key: l.id,
        label: l.name,
        color: l.color,
        isNone: false,
      }));
    default:
      return [];
  }
}

private getNoneLabel(mode: GroupByMode): string {
  switch (mode) {
    case 'assignee': return 'No Assignee';
    case 'priority': return 'No Priority';
    case 'label': return 'No Label';
    default: return 'Other';
  }
}

private priorityLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

private priorityColor(p: string): string {
  const colors: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280',
  };
  return colors[p] ?? '#6b7280';
}
```

6. Add `setGroupBy` method:
```typescript
setGroupBy(mode: GroupByMode, boardId: string): void {
  this.groupBy.set(mode);
  localStorage.setItem(`tf_swimlane_${boardId}`, mode);
}

toggleSwimlaneCollapse(groupKey: string): void {
  const current = this.collapsedSwimlaneIds();
  const updated = new Set(current);
  if (updated.has(groupKey)) updated.delete(groupKey);
  else updated.add(groupKey);
  this.collapsedSwimlaneIds.set(updated);
}
```

**Size impact:** ~120 new lines added. File will be ~820 lines — extract `getTaskGroups` + priority helpers to a `swimlane-utils.ts` file to stay under 800 lines.

#### `board-toolbar.component.ts`
**Path:** `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`
**Changes:**

1. Add output: `groupByChanged = output<GroupByMode>()`
2. Add input: `groupBy = input<GroupByMode>('none')`
3. Add "Group By" dropdown button in template (before density toggle, only when `viewMode() === 'kanban'`):
```html
@if (viewMode() === 'kanban') {
  <div class="relative">
    <p-button
      icon="pi pi-th-large"
      [label]="groupByLabel()"
      severity="secondary"
      size="small"
      (onClick)="groupByMenu.toggle($event)"
    />
    <p-menu #groupByMenu [popup]="true" [model]="groupByOptions()" />
  </div>
}
```
4. Add computed `groupByOptions()` returning `MenuItem[]` for None/Assignee/Priority/Label
5. Add `groupByLabel()` computed returning current mode as human label

**Estimated change:** +60 lines

#### `board-view.component.ts`
**Path:** `frontend/src/app/features/board/board-view/board-view.component.ts`
**Changes:**

1. Import `SwimlaneContainerComponent`, `GroupByMode`
2. Add to `imports` array: `SwimlaneContainerComponent`
3. Wire `groupByChanged` from toolbar:
```typescript
onGroupByChanged(mode: GroupByMode): void {
  this.state.setGroupBy(mode, this.boardId);
}
```
4. Replace the `@else { <!-- Kanban Board --> }` block with a conditional:
```html
} @else if (state.groupBy() !== 'none') {
  <!-- Swimlane Board -->
  <app-swimlane-container
    [swimlaneGroups]="state.swimlaneGroups()"
    [columns]="state.columns()"
    [swimlaneState]="state.swimlaneFilteredState()"
    [groupBy]="state.groupBy()"
    [density]="state.cardDensity()"
    [collapsedSwimlaneIds]="state.collapsedSwimlaneIds()"
    (taskMoved)="onSwimlanTaskMoved($event)"
    (taskClicked)="onTaskClicked($event)"
    (swimlaneToggled)="onSwimlaneToggled($event)"
  />
} @else {
  <!-- Existing flat kanban grid -->
  ...existing code...
}
```
5. Add handler:
```typescript
onSwimlaneToggled(groupKey: string): void {
  this.state.toggleSwimlaneCollapse(groupKey);
}

onSwimlaneTaskMoved(event: SwimlaneTaskMoveEvent): void {
  this.dragDrop.onSwimlaneTaskMoved(event);
}
```

**Estimated change:** +80 lines

#### `board-drag-drop.handler.ts`
**Path:** `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts`
**Changes:**

Add `onSwimlaneTaskMoved` method that:
1. Determines if the `fromGroupKey !== toGroupKey` (cross-lane move)
2. If same lane: delegates to existing `onTaskMoved` (column move only)
3. If cross-lane: calls existing `onTaskMoved` first, then calls property reassignment
4. Property reassignment based on `groupBy` mode:
   - `priority`: call `updateTask(taskId, { priority: toGroupKey })`
   - `assignee`: call `unassignUser(taskId, fromGroupKey)` then `assignUser(taskId, toGroupKey)` — skip if toGroupKey is `__none__`
   - `label`: call `removeLabel(taskId, fromGroupKey)` then `addLabel(taskId, toGroupKey)` — skip if `__none__`
5. Optimistic update: update `boardState` immediately (move task to new cell)
6. Rollback to snapshot on error

```typescript
// Interface for the event
export interface SwimlaneTaskMoveEvent extends TaskMoveEvent {
  fromGroupKey: string;
  toGroupKey: string;
  groupBy: GroupByMode;
}

onSwimlaneTaskMoved(event: SwimlaneTaskMoveEvent): void {
  const snapshot = structuredClone(this.state.boardState());

  // Step 1: Apply optimistic column move (updates boardState position + column_id)
  this.onTaskMoved(event); // reuses existing logic

  if (event.fromGroupKey === event.toGroupKey) return; // same lane, done

  // Step 2: Optimistically update the task's grouping property in boardState
  this.applyOptimisticGroupChange(event.task.id, event.groupBy, event.toGroupKey);

  // Step 3: Call property API
  this.reassignGroupProperty(event, snapshot);
}
```

**Estimated change:** +100 lines

#### `board-toolbar.component.ts` output addition
The toolbar already uses `output()` for `densityChanged` — add `groupByChanged = output<GroupByMode>()` and `groupBy = input<GroupByMode>('none')`.

### New Services / Utilities

#### `swimlane-utils.ts`
- **Path:** `frontend/src/app/features/board/board-view/swimlane-utils.ts`
- **Purpose:** Pure functions for extracting group keys from tasks (extracted from board-state.service.ts to keep file size under 800 lines)
- **Exports:**
  - `getTaskGroups(task: Task, mode: GroupByMode): SwimlaneGroup[]`
  - `getPriorityColor(priority: string): string`
  - `getPriorityLabel(priority: string): string`
  - `getNoneGroupLabel(mode: GroupByMode): string`
  - `buildSwimlaneGroups(boardState: Record<string, Task[]>, mode: GroupByMode): SwimlaneGroup[]`
- **Size estimate:** ~80 lines

### Type Definitions

Add to a shared types location or inline in board-state.service.ts:
```typescript
// frontend/src/app/features/board/board-view/swimlane.types.ts
export type GroupByMode = 'none' | 'assignee' | 'priority' | 'label';

export interface SwimlaneGroup {
  key: string;
  label: string;
  color?: string;
  avatarUrl?: string;
  isNone: boolean;
}

export type SwimlaneState = Record<string, Record<string, Task[]>>;

export interface SwimlaneTaskMoveEvent extends TaskMoveEvent {
  fromGroupKey: string;
  toGroupKey: string;
  groupBy: GroupByMode;
}
```

### Signal Architecture Summary

| Signal | Location | Type | Purpose |
|--------|----------|------|---------|
| `groupBy` | `board-state.service.ts` | `signal<GroupByMode>` | Selected grouping dimension; persisted to localStorage |
| `collapsedSwimlaneIds` | `board-state.service.ts` | `signal<Set<string>>` | Which swimlane rows are collapsed |
| `swimlaneGroups` | `board-state.service.ts` | `computed<SwimlaneGroup[]>` | Derived list of rows from boardState + groupBy |
| `swimlaneFilteredState` | `board-state.service.ts` | `computed<SwimlaneState>` | 2D filtered task map: `groupKey → columnId → Task[]` |
| `isCollapsed` (per row) | `swimlane-row.component.ts` | `input<boolean>` | Passed from container, drives row expansion |

---

## Phased Implementation

### Phase 1 — Read-Only Swimlanes (Frontend Only, No Backend Changes)

**Goal:** "Group by" dropdown renders the board as swimlane rows. Tasks appear in the correct cells. No cross-lane drag required — dragging is still column-to-column within the same row only.

**What to build:**
1. `swimlane.types.ts` — types and interfaces
2. `swimlane-utils.ts` — pure grouping functions
3. Extend `board-state.service.ts` — add `groupBy` signal, `swimlaneGroups` computed, `swimlaneFilteredState` computed, `collapsedSwimlaneIds` signal, helper methods
4. Extend `board-toolbar.component.ts` — add Group By dropdown with `groupByChanged` output
5. Create `swimlane-row.component.ts` — renders one row (label + columns for that row)
6. Create `swimlane-container.component.ts` — wraps all rows in `cdkDropListGroup`, handles column-only drag-drop
7. Extend `board-view.component.ts` — conditional rendering: swimlane branch when `groupBy !== 'none'`

**CDK pattern for Phase 1** (within-row only):
```
<div cdkDropListGroup>                   ← swimlane-container
  @for row of swimlaneGroups {
    <div class="swimlane-row">           ← swimlane-row
      @for col of columns {
        <div cdkDropList                 ← kanban-column's internal drop list
          [id]="'cell-' + col.id + '-' + row.key"
          [cdkDropListConnectedTo]="getConnectedListsForRow(row.key)"
        >
          <!-- task cards -->
        </div>
      }
    </div>
  }
</div>
```

For Phase 1, `getConnectedListsForRow(rowKey)` returns only the list IDs within the **same row**, preventing cross-lane drag.

**Estimated effort:** 1 day

---

### Phase 2 — Cross-Lane Drag (Property Reassignment)

**Goal:** Dragging a card from one swimlane row to another reassigns the grouped property (assignee, priority, label) via existing API calls. Optimistic update + rollback pattern.

**What to build:**
1. Extend `swimlane-container.component.ts` — change `cdkDropListConnectedTo` to include lists from **all rows** for the same column (enabling cross-lane drop targets)
2. Extend `board-drag-drop.handler.ts` — add `onSwimlaneTaskMoved` with cross-lane property reassignment
3. Extend `task.service.ts` — add `updateTaskPriority(taskId, priority)` convenience method (thin wrapper over existing `updateTask`)
4. Update `board-view.component.ts` — wire `onSwimlaneTaskMoved` handler

**Cross-lane CDK pattern:**
```
// For cross-lane: connected lists = same column ID across ALL rows
getConnectedListsForColumn(columnId: string): string[] {
  return this.swimlaneGroups().map(g => `cell-${columnId}-${g.key}`);
}
```

When drop event fires, check: `event.container.id` vs `event.previousContainer.id` — extract `groupKey` from list ID suffix. If different: trigger property reassignment.

**Property reassignment logic:**
```
groupBy === 'priority'  →  PATCH /api/tasks/:id  { priority: toGroupKey }
groupBy === 'assignee'  →  DELETE /api/tasks/:id/assignees/:fromGroupKey
                           POST  /api/tasks/:id/assignees  { user_id: toGroupKey }
groupBy === 'label'     →  DELETE /api/tasks/:id/labels/:fromGroupKey
                           POST  /api/tasks/:id/labels/:toGroupKey
```

Special case — drop into "No Assignee" / "No Label" row: only call the DELETE, skip the POST.

**Estimated effort:** 0.5 days

---

### Phase 3 — Polish and Edge Cases (Optional)

**Goal:** Production-quality swimlane UX matching Linear/ClickUp.

**What to build:**
1. **Task count badges per cell** — show `(n)` count in each cell header: `column name (3)`
2. **Empty cell placeholder** — when a cell has 0 tasks after filtering, show a subtle dashed drop zone "Drop here" that still accepts drops
3. **Swimlane collapse persistence** — persist collapsed row IDs to localStorage (key: `tf_swimlane_collapsed_${boardId}`)
4. **Swimlane label icons** — assignee mode shows avatar; priority mode shows colored dot; label mode shows color swatch
5. **Quick-add task in swimlane cell** — "+" button in each cell header to create task pre-filled with that row's property
6. **"Clear Group By" shortcut** — pressing `G` when swimlanes active should toggle groupBy back to 'none'

**Estimated effort:** 0.5 days

---

## File Change List

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/features/board/board-view/swimlane.types.ts` | CREATE | `GroupByMode`, `SwimlaneGroup`, `SwimlaneState`, `SwimlaneTaskMoveEvent` types |
| `frontend/src/app/features/board/board-view/swimlane-utils.ts` | CREATE | Pure functions: `getTaskGroups`, `buildSwimlaneGroups`, priority color/label helpers |
| `frontend/src/app/features/board/swimlane-row/swimlane-row.component.ts` | CREATE | Single swimlane row: left label + repeated column drop lists |
| `frontend/src/app/features/board/swimlane-container/swimlane-container.component.ts` | CREATE | `cdkDropListGroup` wrapper for all rows; routes drop events |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | MODIFY | Add `groupBy` signal, `collapsedSwimlaneIds` signal, `swimlaneGroups` computed, `swimlaneFilteredState` computed, `setGroupBy()`, `toggleSwimlaneCollapse()` |
| `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | MODIFY | Add `groupBy` input, `groupByChanged` output, Group By dropdown UI |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | MODIFY | Import swimlane components; add swimlane conditional rendering branch; wire `onGroupByChanged`, `onSwimlaneToggled`, `onSwimlaneTaskMoved` |
| `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts` | MODIFY | Add `onSwimlaneTaskMoved` method with cross-lane property reassignment and optimistic rollback |
| `frontend/src/app/core/services/task.service.ts` | MODIFY (Phase 2 only) | Add `updateTaskPriority(taskId, priority)` convenience method; document existing `assignUser`/`unassignUser`/`addLabel`/`removeLabel` as the swimlane reassignment APIs |

**Total new files:** 4
**Total modified files:** 5 (Phase 1: 4, Phase 2: +1 minor)

---

## CDK Architecture Deep-Dive

### List ID Convention

Each drop-list in swimlane mode gets a compound ID:
```
cell-{columnId}-{groupKey}
```

Example for a board with columns `todo`, `doing` and swimlane groups `alice`, `bob`, `__none__`:
```
cell-<todo-uuid>-<alice-uuid>
cell-<todo-uuid>-<bob-uuid>
cell-<todo-uuid>-__none__
cell-<doing-uuid>-<alice-uuid>
cell-<doing-uuid>-<bob-uuid>
cell-<doing-uuid>-__none__
```

### Connected Lists Strategy

**Phase 1 (within-row only):**
```typescript
// swimlane-row.component.ts
getConnectedListsForColumn(columnId: string): string[] {
  // Only connect to other columns in the SAME row
  return this.columns().map(col => `cell-${col.id}-${this.swimlaneGroup().key}`);
}
```

**Phase 2 (cross-row):**
```typescript
// swimlane-container.component.ts
allListIds = computed(() => {
  const ids: string[] = [];
  for (const group of this.swimlaneGroups()) {
    for (const col of this.columns()) {
      ids.push(`cell-${col.id}-${group.key}`);
    }
  }
  return ids;
});
```

### Drop Event Routing

When a drop fires in `swimlane-container.component.ts`:
```typescript
onDrop(event: CdkDragDrop<Task[]>, toGroupKey: string, toColumnId: string): void {
  const fromListId = event.previousContainer.id;
  // Parse fromListId: "cell-{columnId}-{groupKey}"
  const [, fromColumnId, ...fromGroupParts] = fromListId.split('-');
  const fromGroupKey = fromGroupParts.join('-'); // handles UUIDs with hyphens

  const moveEvent: SwimlaneTaskMoveEvent = {
    task: event.previousContainer.data[event.previousIndex],
    targetColumnId: toColumnId,
    previousColumnId: fromColumnId,
    previousIndex: event.previousIndex,
    currentIndex: event.currentIndex,
    fromGroupKey,
    toGroupKey,
    groupBy: this.groupBy(),
  };

  this.taskMoved.emit(moveEvent);
}
```

**Important:** The list ID parsing uses the convention that the groupKey may itself contain hyphens (UUID format). The ID is structured as `cell-{columnId}-{groupKey}`. Since `columnId` is a UUID (36 chars), the parsing should split at the first and second occurrences of the separator pattern to extract both.

Alternative: use `_` as separator: `cell_{columnId}_{groupKey}` — avoids UUID hyphen ambiguity.

---

## Template Sketches

### Group By Dropdown (in board-toolbar.component.ts)

```html
@if (viewMode() === 'kanban') {
  <div class="flex items-center gap-1">
    <button
      (click)="groupByMenu.toggle($event)"
      [class]="groupBy() !== 'none'
        ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--primary)] text-[var(--primary-foreground)]'
        : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] border border-[var(--border)]'"
    >
      <i class="pi pi-table text-xs"></i>
      {{ groupBy() !== 'none' ? 'Group: ' + groupByLabel() : 'Group by' }}
      @if (groupBy() !== 'none') {
        <i class="pi pi-times text-xs" (click)="onClearGroupBy($event)"></i>
      }
    </button>
    <p-menu #groupByMenu [popup]="true" [model]="groupByMenuItems" />
  </div>
}
```

### Swimlane Row Label (in swimlane-row.component.ts)

```html
<div class="flex items-start">
  <!-- Sticky label column -->
  <div
    class="sticky left-0 z-10 w-[152px] min-w-[152px] bg-[var(--card)] border-r border-[var(--border)] flex items-center gap-2 px-3 py-3 cursor-pointer hover:bg-[var(--muted)] select-none"
    (click)="toggleCollapse.emit(swimlaneGroup().key)"
  >
    <!-- Assignee mode: avatar -->
    @if (swimlaneGroup().avatarUrl) {
      <img [src]="swimlaneGroup().avatarUrl" class="w-6 h-6 rounded-full flex-shrink-0" />
    } @else if (!swimlaneGroup().isNone && swimlaneGroup().color) {
      <!-- Priority / Label mode: color swatch -->
      <span
        class="w-3 h-3 rounded-full flex-shrink-0"
        [style.background-color]="swimlaneGroup().color"
      ></span>
    } @else {
      <!-- No-assignee / no-label: dash icon -->
      <span class="w-3 h-3 rounded-full flex-shrink-0 bg-[var(--border)]"></span>
    }

    <span class="text-xs font-medium text-[var(--foreground)] truncate flex-1">
      {{ swimlaneGroup().label }}
    </span>

    <span class="text-xs text-[var(--muted-foreground)] flex-shrink-0">
      {{ totalTaskCount() }}
    </span>

    <i
      class="pi pi-chevron-right text-xs text-[var(--muted-foreground)] transition-transform duration-200"
      [class.rotate-90]="!isCollapsed()"
    ></i>
  </div>

  <!-- Column cells for this row -->
  @if (!isCollapsed()) {
    <div class="flex gap-2 flex-1 overflow-x-auto p-2">
      @for (column of columns(); track column.id) {
        <app-kanban-column
          [column]="column"
          [tasks]="getTasksForCell(column.id)"
          [connectedLists]="connectedListIds()"
          [density]="density()"
          ... (all other bindings)
        />
      }
    </div>
  } @else {
    <!-- Collapsed: show counts per column -->
    <div class="flex gap-2 flex-1 p-2 items-center">
      @for (column of columns(); track column.id) {
        <div class="w-[272px] flex-shrink-0 flex items-center justify-center py-2">
          <span class="text-xs text-[var(--muted-foreground)]">
            {{ getTasksForCell(column.id).length }}
          </span>
        </div>
      }
    </div>
  }
</div>
```

---

## Success Criteria Checklist

### Phase 1: Read-Only Swimlanes

- [ ] "Group by" dropdown appears in the board toolbar when view mode is Kanban
- [ ] Dropdown has 4 options: None, Assignee, Priority, Label — all render without TypeScript errors
- [ ] Selecting "Assignee" renders horizontal swimlane bands, one per unique assignee on the board
- [ ] Selecting "Priority" renders bands: Urgent / High / Medium / Low (only for priorities that have tasks), plus "No Priority" if any unassigned tasks exist
- [ ] Selecting "Label" renders bands per label, plus "No Label" catch-all row
- [ ] Tasks appear in the correct row (a task assigned to Alice appears only in Alice's row)
- [ ] Tasks with multiple assignees/labels appear in **multiple rows** simultaneously (read-only duplication is acceptable in Phase 1)
- [ ] "No Assignee" / "No Label" / "No Priority" row renders at the bottom when unassigned tasks exist
- [ ] Column names and WIP badges are visible in each swimlane row's column header
- [ ] Within-row drag-drop works (column-to-column within same swimlane) — does NOT fire cross-lane property update
- [ ] Clicking a swimlane row label collapses/expands it with a transition
- [ ] Collapsed swimlane shows per-column task counts instead of the full column
- [ ] Selecting "None" returns to the flat kanban view (no swimlanes)
- [ ] `groupBy` selection persists across page reload (localStorage key: `tf_swimlane_${boardId}`)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build -- --configuration=production` succeeds
- [ ] No `console.log` statements in any new file

### Phase 2: Cross-Lane Drag

- [ ] Dragging a card from Bob's row to Alice's row changes the card's first assignee from Bob to Alice via API
- [ ] Dragging from any row to "No Assignee" removes the assignee from the task
- [ ] Dragging across priority lanes (High → Low) updates priority via `PATCH /api/tasks/:id`
- [ ] Dragging across label lanes updates label via remove + add API calls
- [ ] Cross-lane move is **optimistic** — card moves instantly, reverts on API error with error toast
- [ ] Board WS events still fire correctly after cross-lane moves (task update broadcast received by other users)
- [ ] `cargo check --workspace` passes with zero errors (no backend changes, but confirm nothing broken)

### Phase 3: Polish

- [ ] Each cell shows task count in the column header within the swimlane row
- [ ] Empty cells show a dashed drop zone "Drop here" (not a blank void)
- [ ] Swimlane collapse state persists to localStorage per board
- [ ] Priority swimlanes show colored dot next to priority name in row label
- [ ] Assignee swimlanes show avatar (or initials fallback) in row label
- [ ] Label swimlanes show color swatch in row label
- [ ] Pressing `G` on the board toggles groupBy between 'none' and the last-used mode

### Cross-Cutting

- [ ] Existing flat kanban view (groupBy = 'none') is unchanged and still passes all existing specs
- [ ] Board keyboard shortcuts (`N`, `F`, `?`, `J`/`K`) still work when swimlanes are active
- [ ] Quick filters (My Tasks, Due This Week, High Priority) still filter correctly within swimlane view
- [ ] Card density toggle (Compact/Normal/Expanded) applies to cards inside swimlane rows
- [ ] No orphaned endpoints — every API call has a corresponding UI action

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| CDK list ID parsing broken for UUID keys | Medium | Use `_` instead of `-` as separator in list IDs; test with UUID values explicitly |
| Tasks with multiple assignees duplicated across rows causes confusing DnD | Medium | Document in Phase 1: "drag moves task from one lane; if task has multiple assignees, both lanes update" — or defer multi-assignee handling to Phase 3 |
| `filteredBoardState` recomputes too often with swimlane computed layered on top | Low | Use `ChangeDetectionStrategy.OnPush` on all swimlane components; inputs are signals so change detection is already optimized |
| swimlane-container grows large (many groups × many columns = many drop lists) | Low | Angular CDK handles 100+ drop lists efficiently; swimlane boards rarely exceed 20 rows × 6 columns |
| Board horizontal scroll breaks with sticky left label column | Medium | `overflow-x-auto` on swimlane-container's inner div; sticky `left-0` on label works within the scroll container |

---

## Sources Consulted

- [Angular CDK Drag & Drop — Official Docs](https://angular.dev/guide/drag-drop)
- [CdkDropListGroup API](https://angular.dev/api/cdk/drag-drop/CdkDropListGroup)
- [Angular CDK: Multi-Direction Movement](https://dev.to/ngmaterialdev/angular-cdk-drag-drop-multi-direction-movement-54l5)
- RESEARCH.md — B6 Swimlanes competitor analysis (Linear, ClickUp, Jira, Asana, Height, Shortcut, Monday, Plane, Trello, Notion)
- comp.md — Winner pattern: "Group by" dropdown → CDK drop list group → drag across rows = reassign property
- TaskBolt codebase: `board-state.service.ts`, `board-view.component.ts`, `board-drag-drop.handler.ts`, `task_movement.rs`, `task_helpers.rs`
