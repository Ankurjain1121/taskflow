# Plan: B8 — Card Quick-Edit Popover

Generated: 2026-03-02
Stack: Angular 19 · TypeScript 5.7 · Tailwind CSS 4 · PrimeNG 19 · Rust 1.93 · Axum 0.8

---

## Requirements

### What B8 Means

B8 is **Card Quick-Edit**: the ability to edit a task's key fields (title, assignee, due date, priority, labels) directly from the Kanban card — without opening the full task detail panel. The interaction is triggered by hovering over the card and clicking an edit icon, which opens a popover anchored to the card.

### Sub-Features In Scope

| # | Feature | Trigger |
|---|---------|---------|
| B8-1 | Inline title edit | Click pencil icon on card hover (already partially exists) |
| B8-2 | Priority picker popover | Click priority badge/flag on card hover |
| B8-3 | Assignee picker popover | Click assignee avatar area on card hover |
| B8-4 | Due date picker popover | Click due-date chip on card hover |
| B8-5 | Label picker popover | Click labels area on card hover |
| B8-6 | "Open full card" shortcut | Button inside popover → navigate to task detail |
| B8-7 | Keyboard shortcut `E` | When card is focused, press `E` to open quick-edit |
| B8-8 | Optimistic UI updates | All edits apply instantly; rollback on server error |
| B8-9 | Popover accessibility | Esc closes, focus trap, ARIA roles, return focus on close |

### Sub-Features Explicitly OUT OF SCOPE

| Feature | Reason |
|---------|--------|
| Column/status change from popover | Moving tasks is already done via drag-drop and the right-click context menu |
| Description edit from popover | Description requires a rich-text editor; belongs in full task detail only |
| Subtask management from popover | Complexity warrants full task detail; keeps popover small |
| Comment from popover | Comments need thread context; full task detail only |
| Full Trello-style "card back" overlay | Too heavyweight; this plan is field-level popovers only |

---

## Competitor Benchmark

### Winner Pattern (from comp.md#b8)

> **(1) Title: single-click → inline text edit. (2) Other fields (assignee, due date, priority): hover → small CDK Overlay popover. Gap: date picker popover, assignee picker popover, priority picker on hover.**

The single most important gap TaskBolt has vs best-in-class:

**TaskBolt already has inline title edit and priority cycling.** The missing piece is the **field-level popover system**: when you hover a due date chip, assignee avatar, or label pill on a card, a small anchored popover opens with a mini-editor for that specific field. This is the core Linear/Asana/Height UX that TaskBolt lacks.

---

## What Already Exists

### Existing Task Card (`task-card.component.ts` — 1114 lines)

The component already has:
- `isEditingTitle` signal + `titleInput` viewChild — inline title editing (all density modes)
- `onTitleEditStart()` / `onTitleSave()` / `onTitleCancel()` — full save/cancel lifecycle
- `onPriorityCycle(event)` — cycles through priority values (low → medium → high → urgent → low)
- `onRightClick()` + `buildContextMenu()` — full right-click context menu with priority submenu and move-to-column
- Hover quick-action buttons already visible (priority flag button + three-dot menu) at top-right
- All density modes (compact / normal / expanded) implemented
- Outputs: `titleChanged`, `priorityChanged`, `columnMoveRequested`, `duplicateRequested`, `deleteRequested`

### Existing Board State (`board-state.service.ts`)

- `optimisticUpdateTask(taskId, updates, serverUpdates?)` — already implemented at line ~363
  - Takes a snapshot, applies client-side update immediately, sends PATCH to server, rolls back on error
- `boardMembers` signal — list of all board members (used for assignee picker)
- `allLabels` computed signal — all unique labels across tasks

### Existing Backend

- `PATCH /api/tasks/:id` — handles: `title`, `priority`, `due_date`, `clear_due_date`, `start_date`, `estimated_hours`, `milestone_id`, `clear_*`
- `POST /api/tasks/:id/assignees` + `DELETE /api/tasks/:id/assignees/:user_id` — separate endpoints for assign/unassign
- `POST /api/tasks/:id/labels/:label_id` + `DELETE /api/tasks/:id/labels/:label_id` — separate endpoints for label add/remove
- `TaskService.assignUser(taskId, userId)` + `TaskService.unassignUser(taskId, userId)` — already in frontend service
- `TaskService.addLabel(taskId, labelId)` + `TaskService.removeLabel(taskId, labelId)` — already in frontend service

### What the Old mutable-zooming-moler Plan Proposed

The plan file was not found at `.claude/plans/mutable-zooming-moler.md` — it may have been removed. Based on TASK.md and RESEARCH.md references, the old plan proposed the same CDK Overlay approach and identified the same gaps (date picker popover, assignee picker popover, priority picker on hover).

### What We Are Building vs What Exists

| Area | Status | Action |
|------|--------|--------|
| Title inline edit | Exists (normal + expanded) | Extend to compact mode |
| Priority picker | Partial (cycle-only via button) | Add popover with 4 options |
| Assignee picker | Missing | Build new popover |
| Due date picker | Missing | Build new popover with PrimeNG Calendar |
| Label picker | Missing | Build new popover with checklist |
| Quick-edit service | Missing | Build `CardQuickEditService` |
| Keyboard shortcut `E` | Missing | Add to `board-shortcuts.service.ts` |

---

## Backend Changes

### Assessment: NO new backend routes needed

All required API endpoints already exist:

| Operation | Endpoint | Status |
|-----------|----------|--------|
| Update title/priority/due_date | `PATCH /api/tasks/:id` | EXISTS |
| Add assignee | `POST /api/tasks/:id/assignees` | EXISTS |
| Remove assignee | `DELETE /api/tasks/:id/assignees/:user_id` | EXISTS |
| Add label | `POST /api/tasks/:id/labels/:label_id` | EXISTS |
| Remove label | `DELETE /api/tasks/:id/labels/:label_id` | EXISTS |

### Backend `UpdateTaskRequest` — Verify label_ids support

The current `UpdateTaskRequest` in `task_helpers.rs` does NOT include `label_ids` — labels are managed via dedicated endpoints (`POST/DELETE /tasks/:id/labels/:label_id`). This is correct and already wired in the frontend `TaskService`. No backend changes required.

### Frontend `UpdateTaskRequest` — needs `clear_due_date`

The frontend `UpdateTaskRequest` interface in `task.service.ts` (line 122) is missing `clear_due_date: boolean`. Add this field to the interface so the "clear due date" button works in the popover.

```typescript
// task.service.ts — update interface
export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  clear_due_date?: boolean;       // ADD THIS
  milestone_id?: string | null;
}
```

---

## Frontend Changes

### Core Concept

Rather than one monolithic "quick-edit popover" component (Trello style, opens the whole card as a panel), TaskBolt uses **field-level popovers**: each editable field on the card has its own small, focused popover. This matches Linear/Height's approach and is more modular.

**Trigger mechanism: hover edit buttons on card fields** (not right-click, not a separate pencil icon for the whole card — each field is independently clickable).

### New Components

#### 1. `card-quick-edit-popover.component.ts`
**Path:** `frontend/src/app/features/board/task-card/card-quick-edit-popover.component.ts`
**Selector:** `app-card-quick-edit-popover`
**Purpose:** Generic wrapper component that renders inside a CDK Overlay. Contains the shared shell (header with task title read-only, close button) and dynamically renders the appropriate field editor based on the `editMode` input signal.

```
┌─────────────────────────────────────────────┐
│  Edit Priority               [×]            │
│─────────────────────────────────────────────│
│  ○ Urgent   ● High   ○ Medium   ○ Low       │
│─────────────────────────────────────────────│
│             [Open full card →]              │
└─────────────────────────────────────────────┘
```

#### 2. `priority-picker.component.ts`
**Path:** `frontend/src/app/features/board/task-card/pickers/priority-picker.component.ts`
**Selector:** `app-priority-picker`
**Purpose:** 4-option priority selector rendered inside the quick-edit popover. Emits `prioritySelected: EventEmitter<TaskPriority>`.

#### 3. `assignee-picker.component.ts`
**Path:** `frontend/src/app/features/board/task-card/pickers/assignee-picker.component.ts`
**Selector:** `app-assignee-picker`
**Purpose:** Searchable list of board members with checkboxes (multi-select). Shows current assignees checked. Emits `assigneeToggled: EventEmitter<{ userId: string; assigned: boolean }>`.

#### 4. `due-date-picker.component.ts`
**Path:** `frontend/src/app/features/board/task-card/pickers/due-date-picker.component.ts`
**Selector:** `app-due-date-picker`
**Purpose:** Mini date picker using PrimeNG `<p-datePicker>` inline mode + "Clear date" button. Emits `dateSelected: EventEmitter<string | null>`.

#### 5. `label-picker.component.ts`
**Path:** `frontend/src/app/features/board/task-card/pickers/label-picker.component.ts`
**Selector:** `app-label-picker`
**Purpose:** Searchable list of board labels with checkboxes. Current labels are pre-checked. Emits `labelToggled: EventEmitter<{ labelId: string; checked: boolean }>`.

#### 6. `card-quick-edit.service.ts`
**Path:** `frontend/src/app/features/board/task-card/card-quick-edit.service.ts`
**Purpose:** Manages the CDK Overlay lifecycle. Opens/closes the popover overlay anchored to a trigger element. Singleton service (providedIn the board feature — not root).

### Modified Components

#### `task-card.component.ts` (existing, 1114 lines)

Changes:
1. Add hover-reveal edit buttons on each field (priority badge, assignee area, due-date chip, labels area)
2. Inject `CardQuickEditService` and call `openPopover(triggerEl, task, 'priority' | 'assignee' | 'due_date' | 'labels')`
3. Add `editRequested` output for delegating edits upward (the popover service handles the actual saves via `BoardStateService`)
4. Extend inline title edit to compact density mode
5. Add `'e'` keyboard shortcut listener on the focused card (calls `openPopover` with the first field)
6. Keep file under 800 lines — extract hover button template into a separate template reference

#### `board-view.component.ts` (existing)

Changes:
1. Provide `CardQuickEditService` at the board-view level (not task-card level — one instance for the whole board)
2. Handle `quickEditSave` events from the service — delegate to `boardStateService.optimisticUpdateTask()` or the assignee/label service methods

### New Service: `card-quick-edit.service.ts`

```typescript
// Responsibilities:
// 1. Create CDK OverlayRef anchored to the trigger element
// 2. Render card-quick-edit-popover via ComponentPortal
// 3. Close on: Esc keydown, backdrop click, explicit close()
// 4. Return focus to trigger element on close
// 5. Emit save events (title, priority, assignee, dueDate, labels)

@Injectable()
export class CardQuickEditService {
  private overlayRef = signal<OverlayRef | null>(null);
  readonly isOpen = computed(() => this.overlayRef() !== null);

  open(triggerEl: HTMLElement, task: Task, mode: QuickEditMode): void { ... }
  close(): void { ... }

  // Save operations (called by the popover component outputs)
  savePriority(taskId: string, priority: TaskPriority): void { ... }
  saveAssignee(taskId: string, userId: string, assign: boolean): void { ... }
  saveDueDate(taskId: string, dueDate: string | null): void { ... }
  saveLabel(taskId: string, labelId: string, checked: boolean): void { ... }
}
```

**CDK Overlay positioning:**
```typescript
const positionStrategy = this.overlay
  .position()
  .flexibleConnectedTo(triggerEl)
  .withPositions([
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end',   originY: 'bottom', overlayX: 'end',   overlayY: 'top', offsetY: 4 },
  ])
  .withPush(true)        // push into viewport if needed
  .withViewportMargin(8);

const scrollStrategy = this.overlay.scrollStrategies.reposition();
```

### Signal Architecture

No new signals in `BoardStateService` are required. The existing `optimisticUpdateTask` method covers title/priority/due_date. Assignee and label changes will use their dedicated service methods with local optimistic updates to the `boardState` signal.

New signals INSIDE `CardQuickEditService`:

```typescript
// State owned by the service
private readonly _task = signal<Task | null>(null);
private readonly _mode = signal<QuickEditMode>('priority');
readonly currentTask = this._task.asReadonly();
readonly currentMode = this._mode.asReadonly();
```

New signals INSIDE `TaskCardComponent`:

```typescript
// Local hover state (no change detection concerns since OnPush)
readonly isHovered = signal(false);
// Already exists: isEditingTitle = signal(false)
```

### Template Sketch

**Card hover state (added to each field in the card template):**

```html
<!-- Due Date chip — with hover edit button -->
<div class="relative group/duedate flex items-center">
  <span class="due-date-chip ...">{{ formatDueDate(task().due_date) }}</span>
  <button
    (click)="onOpenDueDatePicker($event)"
    class="opacity-0 group-hover/duedate:opacity-100 absolute -right-4 top-0
           w-3.5 h-3.5 flex items-center justify-center text-muted-foreground
           hover:text-foreground transition-opacity duration-100"
    aria-label="Edit due date"
  >
    <i class="pi pi-pencil text-[9px]"></i>
  </button>
</div>
```

**Quick-edit popover shell (`card-quick-edit-popover.component.ts`):**

```
┌────────────────────────────────────┐
│  [Priority]              [× close] │  ← aria-label="Close quick edit"
│────────────────────────────────────│
│                                    │
│  [Field-specific picker rendered   │
│   here: priority / assignee /      │
│   due-date / labels]               │
│                                    │
│────────────────────────────────────│
│         [↗ Open full card]         │
└────────────────────────────────────┘
Width: 240px (priority/date) or 280px (assignee/labels with search)
```

**Priority picker:**
```
○ Urgent  (red dot)
● High    (orange dot)  ← currently selected
○ Medium  (yellow dot)
○ Low     (blue dot)
```

**Assignee picker:**
```
[Search members...        ]
─────────────────────────
☑ Alice Chen (you)
☐ Bob Smith
☐ Carol White
─────────────────────────
Unassign all
```

**Due date picker:**
```
[PrimeNG p-datePicker inline]
─────────────────────────────
           [Clear date]
```

**Label picker:**
```
[Search labels...         ]
─────────────────────────
☑ ● Bug           (red)
☐ ● Feature       (blue)
☐ ● Enhancement   (green)
─────────────────────────
```

---

## Phased Implementation

### Phase 1 — Priority Picker + Title Edit Compact Mode (est. 4–6 hours)

**Goal:** Replace the current "cycle priority" button with a proper popover picker. Extend title edit to compact density. Establish the CDK Overlay infrastructure.

**Files:**
1. **CREATE** `card-quick-edit.service.ts` — CDK Overlay open/close, keyboard/backdrop dismissal, focus management
2. **CREATE** `card-quick-edit-popover.component.ts` — popover shell (header + close button + "Open full card" link)
3. **CREATE** `pickers/priority-picker.component.ts` — 4-radio-button priority selection, keyboard (arrow keys)
4. **MODIFY** `task-card.component.ts` — inject service, replace `onPriorityCycle()` with `onOpenPriorityPicker()`, add title edit to compact mode, remove separate priority cycling button (or keep as a fallback action inside the popover)
5. **MODIFY** `board-view.component.ts` — provide `CardQuickEditService`, handle save events
6. **MODIFY** `task.service.ts` — add `clear_due_date` to `UpdateTaskRequest` interface

**Acceptance:** Priority popover opens when clicking priority flag, shows 4 options, selecting one closes popover and updates card optimistically (no reload). Esc closes it. Focus returns to trigger.

### Phase 2 — Assignee, Due Date, and Label Pickers (est. 6–8 hours)

**Goal:** Complete all four field-level popover editors.

**Files:**
1. **CREATE** `pickers/assignee-picker.component.ts` — board member list with search, checkboxes, instant apply
2. **CREATE** `pickers/due-date-picker.component.ts` — PrimeNG datePicker inline + clear button
3. **CREATE** `pickers/label-picker.component.ts` — label list with color swatches, search, checkboxes
4. **MODIFY** `card-quick-edit-popover.component.ts` — wire in all three new pickers via `@if (mode() === 'assignee')` branches
5. **MODIFY** `task-card.component.ts` — add hover buttons on assignee avatar area, due-date chip, labels area
6. **MODIFY** `card-quick-edit.service.ts` — add `saveAssignee()`, `saveDueDate()`, `saveLabel()` methods with optimistic updates

**Acceptance:** All 4 fields editable from card. Changes apply immediately (optimistic). Errors revert and show toast. Popovers handle viewport edge cases (push strategy).

### Phase 3 — Keyboard Shortcut + Accessibility Polish (est. 2–3 hours)

**Goal:** Add `E` shortcut for focused cards, full ARIA compliance, screen reader testing.

**Files:**
1. **MODIFY** `board-shortcuts.service.ts` — add `E` shortcut to open priority picker on focused card
2. **MODIFY** `card-quick-edit-popover.component.ts` — add `cdkTrapFocus [cdkTrapFocusAutoCapture]="true"`, `role="dialog"`, `aria-label`, `aria-modal="true"`
3. **MODIFY** `pickers/priority-picker.component.ts` — arrow key navigation (ArrowUp/Down), enter to select
4. **MODIFY** `pickers/assignee-picker.component.ts` — full keyboard search + checkbox navigation
5. **MODIFY** `pickers/due-date-picker.component.ts` — verify PrimeNG datePicker keyboard accessibility
6. **MODIFY** `pickers/label-picker.component.ts` — keyboard search + checkbox navigation

**Acceptance:** `E` key on focused card opens priority picker. All pickers navigable by keyboard. Screen reader announces popover correctly. Tab cycles through fields inside popover. Esc closes and returns focus to card.

---

## File Change List

### New Files (CREATE)

| File | Description |
|------|-------------|
| `frontend/src/app/features/board/task-card/card-quick-edit.service.ts` | CDK Overlay lifecycle manager — open/close/position/focus/save |
| `frontend/src/app/features/board/task-card/card-quick-edit-popover.component.ts` | Popover shell with header, mode switcher, close button, full-card link |
| `frontend/src/app/features/board/task-card/pickers/priority-picker.component.ts` | 4-option priority radio picker |
| `frontend/src/app/features/board/task-card/pickers/assignee-picker.component.ts` | Board member checklist with search |
| `frontend/src/app/features/board/task-card/pickers/due-date-picker.component.ts` | PrimeNG datePicker inline + clear button |
| `frontend/src/app/features/board/task-card/pickers/label-picker.component.ts` | Label checklist with color swatches and search |

### Modified Files (MODIFY)

| File | Changes |
|------|---------|
| `frontend/src/app/features/board/task-card/task-card.component.ts` | Inject `CardQuickEditService`; add per-field hover edit buttons; replace `onPriorityCycle()` with `onOpenPriorityPicker()`; add title edit to compact mode; add `E` key listener on focused state; add new output `openCardRequested` |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | Provide `CardQuickEditService`; wire `cardOpened` output from task-card to navigate to task detail |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | Add `optimisticAssignUser(taskId, userId)` and `optimisticUnassignUser(taskId, userId)` methods for assignee changes that update the `boardState` signal; add `optimisticAddLabel(taskId, label)` and `optimisticRemoveLabel(taskId, labelId)` methods |
| `frontend/src/app/core/services/task.service.ts` | Add `clear_due_date?: boolean` to `UpdateTaskRequest` interface |
| `frontend/src/app/features/board/board-view/board-shortcuts.service.ts` | Add `E` shortcut: when a card is focused (`focusedTaskId` signal is set), open priority quick-edit for that card |

### No Backend Changes

All required API endpoints already exist. No new Rust files, no new SQL migrations.

---

## Key Implementation Patterns

### CDK Overlay Open Pattern

```typescript
// card-quick-edit.service.ts
import { Overlay, OverlayRef, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

open(triggerEl: HTMLElement, task: Task, mode: QuickEditMode): void {
  this.close(); // close any existing popover first

  const positionStrategy = this.overlay
    .position()
    .flexibleConnectedTo(triggerEl)
    .withPositions([
      { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
      { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
      { originX: 'end',   originY: 'bottom', overlayX: 'end',   overlayY: 'top', offsetY: 4 },
    ])
    .withPush(true)
    .withViewportMargin(8);

  const config: OverlayConfig = {
    positionStrategy,
    scrollStrategy: this.overlay.scrollStrategies.reposition(),
    hasBackdrop: true,
    backdropClass: 'cdk-overlay-transparent-backdrop',
    panelClass: 'card-quick-edit-panel',
  };

  const ref = this.overlay.create(config);
  this._overlayRef.set(ref);

  // Close on backdrop click
  ref.backdropClick().subscribe(() => this.close());

  // Close on Esc
  ref.keydownEvents()
    .pipe(filter(e => e.key === 'Escape'))
    .subscribe(() => this.close());

  // Render the popover component
  const portal = new ComponentPortal(CardQuickEditPopoverComponent);
  const componentRef = ref.attach(portal);
  componentRef.setInput('task', task);
  componentRef.setInput('mode', mode);
  componentRef.setInput('boardMembers', this._boardMembers());
  componentRef.setInput('allLabels', this._allLabels());

  // Wire outputs
  componentRef.instance.closed.subscribe(() => this.close());
  componentRef.instance.prioritySelected.subscribe(p => this.savePriority(task.id, p));
  componentRef.instance.assigneeToggled.subscribe(ev => this.saveAssignee(task.id, ev));
  componentRef.instance.dateSelected.subscribe(d => this.saveDueDate(task.id, d));
  componentRef.instance.labelToggled.subscribe(ev => this.saveLabel(task.id, ev));

  // Store trigger for focus return
  this._triggerEl = triggerEl;
}

close(): void {
  const ref = this._overlayRef();
  if (ref) {
    ref.dispose();
    this._overlayRef.set(null);
    this._triggerEl?.focus(); // return focus to card
  }
}
```

### Optimistic Assignee Update (board-state.service.ts)

```typescript
optimisticAssignUser(taskId: string, userId: string): void {
  const snapshot = structuredClone(this.boardState());
  const member = this.boardMembers().find(m => m.id === userId);
  if (!member) return;

  const newAssignee: Assignee = {
    id: member.id,
    display_name: member.display_name,
    avatar_url: member.avatar_url,
  };

  this.boardState.update(state => {
    const newState: Record<string, Task[]> = {};
    for (const [colId, tasks] of Object.entries(state)) {
      newState[colId] = tasks.map(t =>
        t.id === taskId
          ? { ...t, assignees: [...(t.assignees ?? []), newAssignee] }
          : t
      );
    }
    return newState;
  });

  this.taskService.assignUser(taskId, userId).subscribe({
    error: () => {
      this.boardState.set(snapshot);
      this.showError('Failed to assign user. Reverted.');
    },
  });
}
```

### Focus Trap in Popover

```html
<!-- card-quick-edit-popover.component.ts template -->
<div
  cdkTrapFocus
  [cdkTrapFocusAutoCapture]="true"
  role="dialog"
  aria-modal="true"
  [attr.aria-label]="'Quick edit: ' + modeLabel()"
  class="quick-edit-popover bg-[var(--card)] border border-[var(--border)]
         rounded-lg shadow-xl w-60 overflow-hidden"
>
  <!-- Header -->
  <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
    <span class="text-xs font-semibold text-[var(--foreground)]">{{ modeLabel() }}</span>
    <button
      (click)="closed.emit()"
      aria-label="Close quick edit"
      class="w-5 h-5 flex items-center justify-center text-[var(--muted-foreground)]
             hover:text-[var(--foreground)] rounded"
    >
      <i class="pi pi-times text-[10px]"></i>
    </button>
  </div>

  <!-- Field picker (switched by mode) -->
  @if (mode() === 'priority') {
    <app-priority-picker
      [current]="task()?.priority"
      (prioritySelected)="prioritySelected.emit($event)"
    />
  }
  @if (mode() === 'assignee') {
    <app-assignee-picker
      [boardMembers]="boardMembers()"
      [currentAssignees]="task()?.assignees ?? []"
      (assigneeToggled)="assigneeToggled.emit($event)"
    />
  }
  @if (mode() === 'due_date') {
    <app-due-date-picker
      [currentDate]="task()?.due_date"
      (dateSelected)="dateSelected.emit($event)"
    />
  }
  @if (mode() === 'labels') {
    <app-label-picker
      [allLabels]="allLabels()"
      [currentLabels]="task()?.labels ?? []"
      (labelToggled)="labelToggled.emit($event)"
    />
  }

  <!-- Footer: open full card -->
  <div class="px-3 py-2 border-t border-[var(--border)]">
    <button
      (click)="openFullCard.emit(task()?.id)"
      class="w-full text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]
             flex items-center justify-center gap-1 py-1 rounded hover:bg-[var(--muted)]"
    >
      <i class="pi pi-external-link text-[10px]"></i>
      Open full card
    </button>
  </div>
</div>
```

### Hover Trigger Button Pattern (task-card.component.ts)

The pattern for each field is a `group/[fieldname]` Tailwind hover group:

```html
<!-- Priority section — replaces current priority cycle button -->
<div class="relative group/priority inline-flex items-center">
  <app-priority-badge [priority]="task().priority" />
  <button
    #priorityTrigger
    (click)="onOpenPriorityPicker($event, priorityTrigger)"
    class="ml-1 opacity-0 group-hover/priority:opacity-100 transition-opacity duration-100
           w-4 h-4 flex items-center justify-center text-[var(--muted-foreground)]
           hover:text-[var(--foreground)] rounded"
    aria-label="Edit priority"
    aria-haspopup="dialog"
  >
    <i class="pi pi-pencil text-[9px]"></i>
  </button>
</div>
```

### `QuickEditMode` Type

```typescript
// card-quick-edit.service.ts
export type QuickEditMode = 'priority' | 'assignee' | 'due_date' | 'labels';
```

---

## Success Criteria Checklist

### Visual / Functional

- [ ] Hovering a task card reveals small pencil icons next to priority badge, assignee avatars, due-date chip, and labels area
- [ ] Clicking the priority pencil opens a 4-option priority popover anchored below the trigger element
- [ ] Selecting a priority in the popover immediately updates the card (optimistic), closes the popover, and sends PATCH to server
- [ ] Clicking the assignee pencil opens an assignee picker with all board members listed; current assignees are checked
- [ ] Toggling an assignee checkbox immediately updates card avatars optimistically
- [ ] Clicking the due-date pencil opens a mini PrimeNG calendar inline; selecting a date updates the chip immediately
- [ ] "Clear date" button in due-date picker removes the due date from the card optimistically
- [ ] Clicking the labels pencil opens a label picker with colored swatches; toggling adds/removes labels instantly
- [ ] "Open full card" button in every popover navigates to task detail view
- [ ] Inline title edit works in all 3 density modes (compact, normal, expanded)

### Keyboard / Accessibility

- [ ] Esc key closes the open popover and returns focus to the trigger button
- [ ] Clicking outside the popover (backdrop) closes it and returns focus
- [ ] Tab key cycles through focusable elements inside the popover (focus is trapped)
- [ ] Priority picker supports ArrowUp/ArrowDown navigation and Enter to select
- [ ] Assignee search input is auto-focused when the popover opens (`cdkTrapFocusAutoCapture`)
- [ ] Screen reader announces `role="dialog"` and `aria-label` when popover opens
- [ ] `E` keyboard shortcut on a focused card opens the priority quick-edit popover
- [ ] `aria-haspopup="dialog"` is set on each trigger button

### Technical

- [ ] `cargo check --workspace` passes (no backend changes, but verify no regressions)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build -- --configuration=production` succeeds
- [ ] No `console.log` statements in any new or modified file
- [ ] Each picker component is standalone (no NgModule)
- [ ] All new components use `ChangeDetectionStrategy.OnPush`
- [ ] `card-quick-edit.service.ts` is < 300 lines
- [ ] `task-card.component.ts` stays under 800 lines (split if needed after adding hover buttons)
- [ ] On server error, board state reverts to pre-edit snapshot and a toast notification appears
- [ ] Popover positioning handles viewport edges (push strategy keeps popover visible)
- [ ] Only ONE overlay instance is open at a time (opening a second one closes the first)

### Competitor Parity

- [ ] Priority picker matches or exceeds Linear's priority selector UX (4 options, color-coded, keyboard accessible)
- [ ] Assignee picker matches Asana's member picker (searchable, checkboxes, instant apply)
- [ ] Due date picker matches Height's date chip edit (mini calendar, clear option)
- [ ] Label picker matches Linear's label selector (colored swatches, multi-select, search)

---

## Dependencies

### New npm packages: NONE

All required libraries are already installed:
- `@angular/cdk` `^19.2.19` — CDK Overlay, CdkTrapFocus, ComponentPortal (already installed)
- `primeng` `^19.1.4` — `p-datePicker` (DatePicker component), `p-popover` (if needed as fallback)
- `tailwindcss` `^4.1.18` — all Tailwind utility classes

### Angular CDK Imports Required

```typescript
// card-quick-edit.service.ts
import { Overlay, OverlayRef, OverlayConfig } from '@angular/cdk/overlay';
import { ComponentPortal }                    from '@angular/cdk/portal';

// card-quick-edit-popover.component.ts
import { A11yModule }       from '@angular/cdk/a11y';       // cdkTrapFocus
import { DatePicker }       from 'primeng/datepicker';       // due date picker

// task-card.component.ts (already has these, just add):
// no new CDK imports needed — Overlay is in the service
```

---

## Sources

- [Angular CDK Overlay: Build Floating Panels the Right Way (v19+)](https://briantree.se/angular-cdk-overlay-tutorial-learn-the-basics/)
- [Angular CDK Overlay: Add Accessibility with ARIA and Focus Management (v19+)](https://briantree.se/angular-cdk-overlay-tutorial-adding-accessibility/)
- [Angular CDK Focus Trap: Make Modals Keyboard Accessible](https://briantree.se/using-the-angular-cdk-trap-focus-directive/)
- [Angular CDK Overlay Positioning: Custom Positions, Fallbacks, and Viewport Handling (v19+)](https://briantree.se/angular-cdk-overlay-tutorial-positioning/)
- [Angular CDK Overlay Scroll Strategies](https://briantree.se/angular-cdk-overlay-tutorial-scroll-strategies/)
- [Angular Material CDK Overlay API reference](https://material.angular.dev/cdk/overlay/overview)
- [Popover UX Pattern — UX Patterns for Developers](https://uxpatterns.dev/patterns/content-management/popover)
- [Accessibility Support for the Popover Component](https://www.telerik.com/design-system/docs/components/popover/accessibility/)
- [Angular Signals: Complete Guide — Angular University](https://blog.angular-university.io/angular-signals/)
- [PrimeNG 19 Popover Component](https://primeng.org/popover)
- [PrimeNG 19 DatePicker Component](https://primeng.org/datepicker)
- [Exploring Angular CDK: Creating Context Menu & Text Popover](https://angular-material.dev/articles/exploring-cdk-context-menu-text-popover)
