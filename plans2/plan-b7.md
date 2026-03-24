# Plan: B7 — Board Keyboard Shortcuts

Generated: 2026-03-02
Feature: B7 — Board Keyboard Shortcuts
Stack: Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19

---

## Requirements

### What B7 Means

B7 is the completion and significant expansion of keyboard shortcut coverage for the TaskBolt Kanban board. It builds on the existing `KeyboardShortcutsService` + `BoardShortcutsService` + `ShortcutHelpComponent` foundation, which already handles a subset of shortcuts, and fills the gaps identified in the competitor benchmark.

### Sub-Features IN SCOPE

| # | Feature | Description |
|---|---------|-------------|
| B7-1 | Cross-column card navigation | h/l keys to move focus left/right between columns; j/k already works vertically |
| B7-2 | Card action shortcuts | e=edit title, m=assign-to-me, d=open density toggle, del/backspace=delete focused card |
| B7-3 | Column jump shortcuts | Ctrl+1 through Ctrl+9 scroll to column N (replaces current 1–6 which switch view modes) |
| B7-4 | Drag simulation | Space=pick-up focused card, h/l=move left/right column, Enter/Space=drop, Esc=cancel |
| B7-5 | Help modal upgrade | Multi-column layout, keyboard-navigable, recently-used shortcuts highlighted, search |
| B7-6 | Shortcut hint tooltips | Hover any toolbar button → tooltip shows its keyboard shortcut |
| B7-7 | Disable shortcuts when modal open | Pause global shortcut handling while dialogs/overlays are open |
| B7-8 | Shortcut discovery indicators | First-run hint banner "Press ? to see all shortcuts" fades after 5s |

### Sub-Features EXPLICITLY OUT OF SCOPE

| Feature | Reason |
|---------|--------|
| Configurable/remappable shortcuts | High complexity, low value for current user base (non-tech-savvy target) |
| Macro sequences (record + replay) | Enterprise feature — not needed at this stage |
| Shortcut conflicts with browser OS | Detection too complex; document existing conflicts in help modal instead |
| `@ngneat/hotkeys` package | Already have a capable `KeyboardShortcutsService`; adding another library is redundant |
| Screen reader full live region announcements | Full ARIA live region for card moves is a separate accessibility epic |
| Vim-style `gg` / `G` jump to first/last | Adds complexity; j/k with scroll suffices for MVP |

---

## Competitor Benchmark

### Winner Pattern (from comp.md B7)

> `?` opens shortcuts modal, `Ctrl+K` = command palette, `N` = new task, `F` = focus filter, `C` = clear filters, `1-9` = scroll to column, `Esc` = close. Shortcut modal with categorized list.

### Detailed Competitor Comparison

| Shortcut | Linear | Jira | Trello | Asana | TaskBolt (current) |
|----------|--------|------|--------|-------|--------------------|
| Create task | `c` | `c` | `n` | Tab+Q | `n` |
| Open focused | Enter/`o` | Enter/`o` | Enter | Enter | Enter |
| Navigate cards (up/down) | `j`/`k` | `j`/`k` | `j`/`k` | — | `j`/`k` |
| Navigate columns (left/right) | `h`/`l` | `n`/`p` | Arrow L/R | — | MISSING |
| Jump to column 1-9 | — | `1`-`3` (board sections) | — | — | 1-6 (view mode switch) |
| Assign to me | `i` | `i` | — | — | MISSING |
| Edit title | `e` | `e` | `t` | — | MISSING |
| Filter focus | `/` | `f` | `f` | — | `f` (exists) |
| Search focus | `/` | `/` | — | — | `/` (exists) |
| Clear filters | `c` | — | `x` | — | MISSING |
| Delete card | — | — | `c`(archive) | — | MISSING |
| Help modal | `?` | `?` | `shift+?` | — | `?` (exists) |
| Command palette | Ctrl+K | — | — | — | MISSING (D1 scope) |
| Density toggle | — | — | — | — | `d` (to add) |
| Drag simulation | Space+arrows | — | — | — | MISSING |

### Most Important Gap vs Best-in-Class

**Cross-column navigation (h/l) is the single most impactful missing shortcut.** Linear and Trello both support it. Without it, keyboard users are stuck in one column — j/k vertical navigation is useless without the ability to move between columns. The second most impactful gap is the shortcut modal upgrade to multi-column layout (currently single-column, no search).

---

## What Already Exists

### Files That Partially Implement B7

| File | What Exists | What Is Missing |
|------|-------------|-----------------|
| `frontend/src/app/core/services/keyboard-shortcuts.service.ts` | Full shortcut registry: `register()`, `unregister()`, `getByCategory()`, `helpRequested$` Subject, `formatShortcut()`, `setEnabled()`, prefix/sequence support (g+i pattern) | No `disableFor()` method for modal suppression; `formatShortcut()` format needs update (currently "Ctrl then N" not "Ctrl+N") |
| `frontend/src/app/features/board/board-view/board-shortcuts.service.ts` | `n` (new task), `/` (search), `f` (filter), `Escape`, `1–6` (view modes), `j`/`k` (card nav via `handleKeydown`), Enter (open card) | `h`/`l` (column nav), `e` (edit), `m` (assign me), `d` (density), `Del` (delete), column jump (Ctrl+1–9), drag simulation (Space+h/l), `c` (clear filters) |
| `frontend/src/app/shared/components/shortcut-help/shortcut-help.component.ts` | Single-column modal triggered by `?`, reads from `KeyboardShortcutsService.getByCategory()`, shows all registered shortcuts with `<kbd>` tags | No search/filter, no multi-column layout, no recently-used tracking, no shortcut hints in tooltips, modal itself should call `setEnabled(false)` while open |
| `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts` | `navigateCard(direction)` + `openFocusedTask()` + `getAllVisibleTasks()` | `navigateCardColumn(direction)` (h/l cross-column), `pickUpCard()` / `moveCardToColumn()` / `dropCard()` / `cancelDrag()` for keyboard drag simulation |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | `focusedTaskId` signal, `cardDensity` signal, `filteredBoardState` computed, `columns` signal | `dragSimulationActive` signal (for drag simulation state), `dragSimulationSourceColumnIdx` signal |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | `@HostListener('document:keydown')` routes to `BoardShortcutsService.handleKeydown()`, `ShortcutHelpComponent` imported | Must pass new callbacks: `clearFilters`, `assignFocusedToMe`, `editFocusedTitle`, `deleteFocused`, `toggleDensity`, `scrollToColumn(n)` |
| `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | `focusSearchInput()` public method | Needs shortcut hint `[title]` attributes on toolbar buttons (tooltip pattern) |
| `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` | Column rendering, `focusedTaskId` input | Needs `[attr.data-column-index]` on column root elements for scroll-to-column |

### What Needs to Be Built From Scratch

1. `navigateCardColumn(direction: -1 | 1)` method in `BoardDragDropHandler` — cross-column card focus navigation
2. Drag simulation state + methods in `BoardDragDropHandler` — `pickUpCard()`, `moveCardColumn()`, `dropCard()`, `cancelDrag()`
3. `dragSimulationActive` and `dragSimulationSourceColumn` signals in `BoardStateService`
4. `disableFor(duration?: number)` method on `KeyboardShortcutsService` — or modal-aware pause
5. Multi-column grid layout + search input in `ShortcutHelpComponent`
6. Shortcut hint tooltips on toolbar buttons (Tailwind `title` attr + PrimeNG Tooltip)
7. First-run discovery banner (B7-8)
8. `data-column-index` attributes on kanban columns + `scrollToColumn(n)` implementation

---

## Backend Changes

**No backend changes required.**

All B7 functionality is purely frontend — keyboard shortcuts are client-side interactions. No new API endpoints, SQL migrations, or Rust code changes are needed.

---

## Frontend Changes

### New Files to Create

None — all changes extend existing files.

### Modified Files

#### 1. `frontend/src/app/core/services/keyboard-shortcuts.service.ts`

**Changes:**
- Add `disableFor(modalRef: unknown): void` — or simpler: add `pushDisable()` / `popDisable()` counter-based pause (increment/decrement a counter; shortcuts fire only when counter === 0)
- Fix `formatShortcut()` to output `Ctrl+N` style instead of current `Ctrl then N` style
- Add `recentlyUsed` signal: `Map<string, number>` (shortcut id → last-used timestamp), max 5 entries, persisted to localStorage
- Add `markUsed(id: string)` called from the `action` wrapper in `handleKeydown`

```typescript
// New additions to KeyboardShortcutsService

private disableCount = 0;

/** Call when opening a modal/overlay; call popDisable when closed */
pushDisable(): void { this.disableCount++; }
popDisable(): void { this.disableCount = Math.max(0, this.disableCount - 1); }

// In handleKeydown(), replace: if (!this.enabled) return;
// With:
private get isEnabled(): boolean {
  return this.enabled && this.disableCount === 0;
}

// recentlyUsed signal for ShortcutHelpComponent
readonly recentlyUsedIds = signal<string[]>([]);

private markUsed(id: string): void {
  this.recentlyUsedIds.update(ids => {
    const without = ids.filter(i => i !== id);
    return [id, ...without].slice(0, 5);
  });
}
```

**formatShortcut() fix:**
```typescript
// Before: parts.join(' ') → "Ctrl then N"
// After:
formatShortcut(s: KeyboardShortcut): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push('Ctrl');
  if (s.alt) parts.push('Alt');
  if (s.shift) parts.push('Shift');
  const key = s.key.length === 1 ? s.key.toUpperCase() : s.key;
  parts.push(key);
  if (s.prefix) return `${s.prefix.toUpperCase()} then ${key}`;
  return parts.join('+');
}
```

---

#### 2. `frontend/src/app/features/board/board-view/board-state.service.ts`

**Changes:**
- Add `dragSimulationActive = signal(false)` — true when keyboard drag is in progress
- Add `dragSimulationSourceColumnId = signal<string | null>(null)` — column the dragged card came from
- Add `dragSimulationCurrentColumnId = signal<string | null>(null)` — current hover column during drag simulation

```typescript
// Add to existing signals block:
readonly dragSimulationActive = signal(false);
readonly dragSimulationSourceColumnId = signal<string | null>(null);
readonly dragSimulationCurrentColumnId = signal<string | null>(null);
```

---

#### 3. `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts`

**Changes — add these methods:**

```typescript
// Cross-column card focus navigation (h/l keys)
navigateCardColumn(direction: -1 | 1): void {
  const focusedId = this.state.focusedTaskId();
  if (!focusedId) return;

  const cols = this.state.columns();
  const filtered = this.state.filteredBoardState();

  // Find which column currently holds the focused task
  let currentColIdx = -1;
  for (let i = 0; i < cols.length; i++) {
    const tasks = filtered[cols[i].id] || [];
    if (tasks.some(t => t.id === focusedId)) {
      currentColIdx = i;
      break;
    }
  }
  if (currentColIdx === -1) return;

  // Move to adjacent column
  const targetColIdx = currentColIdx + direction;
  if (targetColIdx < 0 || targetColIdx >= cols.length) return;

  const targetTasks = filtered[cols[targetColIdx].id] || [];
  if (targetTasks.length === 0) return;

  // Focus first task in target column (or same index if available)
  const currentColTasks = filtered[cols[currentColIdx].id] || [];
  const currentIdxInCol = currentColTasks.findIndex(t => t.id === focusedId);
  const targetIdx = Math.min(currentIdxInCol, targetTasks.length - 1);
  const nextTask = targetTasks[targetIdx];

  this.state.focusedTaskId.set(nextTask.id);
  setTimeout(() => {
    const el = document.querySelector(`[data-task-id="${nextTask.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 0);
}

// Drag simulation: pick up focused card
pickUpCard(): void {
  const focusedId = this.state.focusedTaskId();
  if (!focusedId || this.state.dragSimulationActive()) return;

  // Find source column
  const cols = this.state.columns();
  const filtered = this.state.filteredBoardState();
  let sourceColId: string | null = null;
  for (const col of cols) {
    if ((filtered[col.id] || []).some(t => t.id === focusedId)) {
      sourceColId = col.id;
      break;
    }
  }
  if (!sourceColId) return;

  this.state.dragSimulationActive.set(true);
  this.state.dragSimulationSourceColumnId.set(sourceColId);
  this.state.dragSimulationCurrentColumnId.set(sourceColId);
  // Visual: announce to screen readers via aria-live (handled in template)
}

// Drag simulation: move card left/right column during drag
moveCardToAdjacentColumn(direction: -1 | 1): void {
  if (!this.state.dragSimulationActive()) return;

  const cols = this.state.columns();
  const currentColId = this.state.dragSimulationCurrentColumnId();
  const currentIdx = cols.findIndex(c => c.id === currentColId);
  const targetIdx = currentIdx + direction;

  if (targetIdx < 0 || targetIdx >= cols.length) return;
  this.state.dragSimulationCurrentColumnId.set(cols[targetIdx].id);
}

// Drag simulation: drop card in current column
dropCard(): void {
  if (!this.state.dragSimulationActive()) return;

  const focusedId = this.state.focusedTaskId();
  const sourceColId = this.state.dragSimulationSourceColumnId();
  const targetColId = this.state.dragSimulationCurrentColumnId();
  if (!focusedId || !targetColId) {
    this.cancelDrag();
    return;
  }

  // Perform the actual move (reuse existing onTaskMoved logic via TaskService)
  if (sourceColId !== targetColId) {
    const snapshot = structuredClone(this.state.boardState());
    this.state.boardState.update(state => {
      const newState: Record<string, Task[]> = {};
      let movedTask: Task | null = null;
      for (const [colId, tasks] of Object.entries(state)) {
        const found = tasks.find(t => t.id === focusedId);
        if (found) movedTask = { ...found, column_id: targetColId, position: 'a0' };
        newState[colId] = tasks.filter(t => t.id !== focusedId);
      }
      if (movedTask) {
        newState[targetColId] = [movedTask, ...(newState[targetColId] || [])]
          .sort((a, b) => a.position.localeCompare(b.position));
      }
      return newState;
    });

    this.taskService
      .moveTask(focusedId, { column_id: targetColId, position: 'a0' })
      .subscribe({
        error: () => {
          this.state.boardState.set(snapshot);
          this.state.showError('Failed to move task');
        },
      });
  }

  this.cancelDrag();
}

// Drag simulation: cancel without moving
cancelDrag(): void {
  this.state.dragSimulationActive.set(false);
  this.state.dragSimulationSourceColumnId.set(null);
  this.state.dragSimulationCurrentColumnId.set(null);
}

// Scroll to column by index (0-based)
scrollToColumn(index: number): void {
  const cols = this.state.columns();
  if (index < 0 || index >= cols.length) return;
  const colEl = document.querySelector<HTMLElement>(
    `[data-column-index="${index}"]`
  );
  colEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
}
```

**Inject TaskService** (already injected — verify it's available in the handler).

---

#### 4. `frontend/src/app/features/board/board-view/board-shortcuts.service.ts`

**Changes:** Add new callback registrations and update `handleKeydown` to cover h/l, Space (drag), e, m, d, Del/Backspace, Ctrl+1–9, c (clear filters).

**Updated `registerShortcuts` callbacks interface:**
```typescript
registerShortcuts(callbacks: {
  // Existing:
  createTask: () => void;
  closePanel: () => void;
  clearSelection: () => void;
  closeTaskDetail: () => void;
  getFocusedTaskId: () => string | null;
  setFocusedTaskId: (id: string | null) => void;
  getSelectedTaskIds: () => string[];
  getSelectedTaskId: () => string | null;
  setViewMode: (mode: ViewMode) => void;
  onViewModeChanged: (mode: ViewMode) => void;
  focusFilter: () => void;
  // NEW:
  clearFilters: () => void;
  assignFocusedToMe: () => void;
  editFocusedTitle: () => void;
  deleteFocused: () => void;
  toggleDensity: () => void;
  scrollToColumn: (index: number) => void;
  isDragActive: () => boolean;
  pickUpCard: () => void;
  dropCard: () => void;
  cancelDrag: () => void;
}): void
```

**New shortcuts to register:**
```typescript
// Clear filters
this.shortcutsService.register('board-clear-filters', {
  key: 'c',
  description: 'Clear all filters',
  category: 'Board',
  action: () => callbacks.clearFilters(),
});

// Assign focused card to me
this.shortcutsService.register('board-assign-me', {
  key: 'm',
  description: 'Assign focused task to me',
  category: 'Cards',
  action: () => callbacks.assignFocusedToMe(),
});

// Edit focused card title
this.shortcutsService.register('board-edit-title', {
  key: 'e',
  description: 'Edit focused task title',
  category: 'Cards',
  action: () => callbacks.editFocusedTitle(),
});

// Delete focused card
this.shortcutsService.register('board-delete', {
  key: 'Delete',
  description: 'Delete focused task',
  category: 'Cards',
  action: () => callbacks.deleteFocused(),
});

// Toggle density
this.shortcutsService.register('board-density', {
  key: 'd',
  description: 'Toggle card density',
  category: 'Board',
  action: () => callbacks.toggleDensity(),
});
```

**Column jump shortcuts (Ctrl+1 through Ctrl+9):**

The current 1–6 shortcuts switch view modes (kanban/list/calendar/gantt/reports/time-report). These are already registered and should remain. Add Ctrl+1 through Ctrl+9 as separate shortcuts for column jumping:

```typescript
for (let i = 1; i <= 9; i++) {
  this.shortcutsService.register(`board-col-jump-${i}`, {
    key: String(i),
    ctrl: true,
    description: `Scroll to column ${i}`,
    category: 'Navigation',
    action: () => callbacks.scrollToColumn(i - 1),
  });
}
```

**Updated `handleKeydown` to add h/l and Space/drag simulation:**

```typescript
handleKeydown(
  event: KeyboardEvent,
  viewMode: ViewMode,
  focusedTaskId: string | null,
  isDragActive: boolean,
  callbacks: {
    navigateCard: (direction: number) => void;
    navigateCardColumn: (direction: -1 | 1) => void;
    openFocusedTask: () => void;
    pickUpCard: () => void;
    moveCardToAdjacentColumn: (direction: -1 | 1) => void;
    dropCard: () => void;
    cancelDrag: () => void;
  },
): void {
  const target = event.target as HTMLElement;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  ) {
    return;
  }

  if (viewMode !== 'kanban') return;

  // During drag simulation: only allow h/l (move column), Space/Enter (drop), Esc (cancel)
  if (isDragActive) {
    switch (event.key) {
      case 'h': case 'H': case 'ArrowLeft':
        callbacks.moveCardToAdjacentColumn(-1);
        event.preventDefault();
        break;
      case 'l': case 'L': case 'ArrowRight':
        callbacks.moveCardToAdjacentColumn(1);
        event.preventDefault();
        break;
      case ' ':
      case 'Enter':
        callbacks.dropCard();
        event.preventDefault();
        break;
      case 'Escape':
        callbacks.cancelDrag();
        event.preventDefault();
        break;
    }
    return; // Consume all keys during drag simulation
  }

  // Normal navigation mode:
  switch (event.key) {
    case 'j': case 'J':
      callbacks.navigateCard(1);
      event.preventDefault();
      break;
    case 'k': case 'K':
      callbacks.navigateCard(-1);
      event.preventDefault();
      break;
    case 'h': case 'H':
      if (focusedTaskId) {
        callbacks.navigateCardColumn(-1);
        event.preventDefault();
      }
      break;
    case 'l': case 'L':
      if (focusedTaskId) {
        callbacks.navigateCardColumn(1);
        event.preventDefault();
      }
      break;
    case 'Enter':
      if (focusedTaskId) {
        callbacks.openFocusedTask();
        event.preventDefault();
      }
      break;
    case ' ':
      if (focusedTaskId) {
        callbacks.pickUpCard();
        event.preventDefault();
      }
      break;
  }
}
```

**Shortcut category reorganization:**

| Category | Shortcuts |
|----------|-----------|
| Navigation | h/l (column left/right), j/k (card up/down), Ctrl+1–9 (jump to column) |
| Board | n (new task), / (search), f (filter), c (clear filters), d (density toggle), Esc |
| Cards | Enter (open), e (edit title), m (assign me), Del (delete), Space (pick up) |
| Views | 1 (kanban), 2 (list), 3 (calendar), 4 (gantt), 5 (reports), 6 (time report) |

---

#### 5. `frontend/src/app/features/board/board-view/board-view.component.ts`

**Changes:**

1. Add new callbacks in `ngOnInit()` → `shortcutsService.registerShortcuts({...})`:

```typescript
// Add to existing callback object:
clearFilters: () => this.state.filters.set({ ...DEFAULT_FILTERS }),
assignFocusedToMe: () => this.assignFocusedTaskToMe(),
editFocusedTitle: () => this.editFocusedTaskTitle(),
deleteFocused: () => this.deleteFocusedTask(),
toggleDensity: () => this.cycleDensity(),
scrollToColumn: (index) => this.dragDrop.scrollToColumn(index),
isDragActive: () => this.state.dragSimulationActive(),
pickUpCard: () => this.dragDrop.pickUpCard(),
dropCard: () => this.dragDrop.dropCard(),
cancelDrag: () => this.dragDrop.cancelDrag(),
```

2. Update `@HostListener('document:keydown')` to pass `isDragActive` and new callbacks:

```typescript
@HostListener('document:keydown', ['$event'])
onKeydown(event: KeyboardEvent): void {
  this.shortcutsService.handleKeydown(
    event,
    this.viewMode(),
    this.state.focusedTaskId(),
    this.state.dragSimulationActive(),   // NEW
    {
      navigateCard: (dir) => this.dragDrop.navigateCard(dir),
      navigateCardColumn: (dir) => this.dragDrop.navigateCardColumn(dir),  // NEW
      openFocusedTask: () => this.dragDrop.openFocusedTask(),
      pickUpCard: () => this.dragDrop.pickUpCard(),                        // NEW
      moveCardToAdjacentColumn: (dir) => this.dragDrop.moveCardToAdjacentColumn(dir), // NEW
      dropCard: () => this.dragDrop.dropCard(),                            // NEW
      cancelDrag: () => this.dragDrop.cancelDrag(),                        // NEW
    },
  );
}
```

3. Add new private methods:

```typescript
private assignFocusedTaskToMe(): void {
  const focusedId = this.state.focusedTaskId();
  if (!focusedId) return;
  const currentUser = this.authService.currentUser(); // inject AuthService
  if (!currentUser) return;
  this.state.optimisticUpdateTask(focusedId, { assignees: [currentUser as Assignee] });
}

private editFocusedTaskTitle(): void {
  const focusedId = this.state.focusedTaskId();
  if (!focusedId) return;
  // Trigger inline title edit on the focused task card
  const el = document.querySelector<HTMLElement>(
    `[data-task-id="${focusedId}"] [data-title-edit]`
  );
  el?.click();
}

private deleteFocusedTask(): void {
  const focusedId = this.state.focusedTaskId();
  if (!focusedId) return;
  this.state.deleteTask(focusedId);
  this.state.focusedTaskId.set(null);
}

private cycleDensity(): void {
  const current = this.state.cardDensity();
  const cycle: Record<string, 'compact' | 'normal' | 'expanded'> = {
    compact: 'normal',
    normal: 'expanded',
    expanded: 'compact',
  };
  this.state.setCardDensity(cycle[current]);
}
```

4. Add drag simulation visual overlay in template:

```html
<!-- Keyboard Drag Simulation Indicator -->
@if (state.dragSimulationActive()) {
  <div
    class="fixed bottom-16 left-1/2 -translate-x-1/2 z-40
           bg-[var(--primary)] text-[var(--primary-foreground)]
           px-4 py-2 rounded-full text-sm font-medium shadow-lg
           flex items-center gap-2"
    role="status"
    aria-live="polite"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
    </svg>
    Card picked up — use h/l to move columns, Space/Enter to drop, Esc to cancel
  </div>
}
```

5. Add `data-column-index` attribute to column elements:

```html
<!-- Replace the @for column loop opening: -->
@for (column of state.columns(); track column.id; let colIdx = $index) {
  <app-kanban-column
    [attr.data-column-index]="colIdx"
    ...
  >
```

6. Import `AuthService` in the component.

---

#### 6. `frontend/src/app/shared/components/shortcut-help/shortcut-help.component.ts`

**Changes — upgrade to multi-column with search and recently-used:**

**Template redesign:**

```html
<!-- Template (ASCII sketch): -->
<!--
┌──────────────────────────────────────────────────────────┐
│  Keyboard Shortcuts                              [X]      │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔍 Search shortcuts...                             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Recently Used              Recently used pill chips     │
│  ┌──────────┬──────────────────────────────────────────┐ │
│  │ [N]      │ Create new task                          │ │
│  │ [F]      │ Focus filter bar                        │ │
│  └──────────┴──────────────────────────────────────────┘ │
│                                                          │
│  ┌───────────────────────┬──────────────────────────┐    │
│  │  Navigation           │  Board                   │    │
│  │  [J] Card down        │  [N] New task            │    │
│  │  [K] Card up          │  [/] Focus search        │    │
│  │  [H] Column left      │  [F] Focus filter        │    │
│  │  [L] Column right     │  [C] Clear filters       │    │
│  │  [Ctrl+1..9] Col jump │  [D] Toggle density      │    │
│  ├───────────────────────┼──────────────────────────┤    │
│  │  Cards                │  Views                   │    │
│  │  [Enter] Open card    │  [1] Kanban view         │    │
│  │  [E] Edit title       │  [2] List view           │    │
│  │  [M] Assign to me     │  [3] Calendar view       │    │
│  │  [Del] Delete card    │  [4] Gantt view          │    │
│  │  [Space] Pick up      │  [5] Reports             │    │
│  │  [Esc] Cancel/Clear   │  [6] Time report         │    │
│  └───────────────────────┴──────────────────────────┘    │
│                                                          │
│  Help: Press ? to toggle this panel                      │
└──────────────────────────────────────────────────────────┘
-->
```

**Component changes:**

```typescript
// Add:
searchQuery = signal('');
filteredCategories = computed(() => { /* filter by searchQuery */ });

// Inject:
private shortcutsService = inject(KeyboardShortcutsService);

// When modal opens: call shortcutsService.pushDisable()
// When modal closes: call shortcutsService.popDisable()
// Important: '?' itself should still close the modal (special-cased in KeyboardShortcutsService)

open(): void {
  this.updateCategories();
  this.visible.set(true);
  this.shortcutsService.pushDisable();
}

close(): void {
  this.visible.set(false);
  this.shortcutsService.popDisable();
}
```

**ARIA attributes for the modal dialog:**
```html
<div
  role="dialog"
  aria-modal="true"
  aria-label="Keyboard Shortcuts"
  [attr.aria-hidden]="!visible()"
>
```

**PrimeNG Dialog usage:** Use `p-dialog` from PrimeNG 19 for the modal (already imported in board-view, accessible, has built-in focus trap and Escape handling). This replaces the current custom overlay `<div>`.

---

#### 7. `frontend/src/app/features/board/kanban-column/kanban-column.component.ts`

**Changes:**

1. Add `[attr.data-column-index]` — this is applied from the parent template (board-view), not in the column itself.
2. Add `dragSimulationActive` input and highlight the column when it's the current drag-simulation target:

```typescript
// New inputs:
readonly dragSimulationActive = input(false);
readonly dragSimulationCurrentColumnId = input<string | null>(null);

// Computed: is this column highlighted during drag sim?
readonly isDragTarget = computed(() =>
  this.dragSimulationActive() &&
  this.dragSimulationCurrentColumnId() === this.column().id
);
```

In template — add visual ring when drag target:
```html
<!-- On the root column div, add: -->
[class.ring-2]="isDragTarget()"
[class.ring-[var(--primary)]]="isDragTarget()"
```

---

#### 8. `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`

**Changes — add shortcut hint tooltips:**

Wrap each toolbar button with PrimeNG `pTooltip` directive showing the keyboard shortcut. PrimeNG Tooltip is already available (primeng 19.1.4):

```html
<!-- Example: Filter toggle button -->
<button
  pTooltip="Focus filter (F)"
  tooltipPosition="bottom"
  (click)="focusSearchInput()"
>

<!-- Example: Density toggle button -->
<button
  pTooltip="Toggle density (D)"
  tooltipPosition="bottom"
  (click)="cycleDensity()"
>

<!-- Example: New Task button -->
<button
  pTooltip="New task (N)"
  tooltipPosition="bottom"
  (click)="onCreateTask()"
>
```

Import `TooltipModule` from `primeng/tooltip` in the component imports array.

---

#### 9. `frontend/src/app/features/board/task-card/task-card.component.ts`

**Changes — expose `data-title-edit` trigger:**

The `e` shortcut triggers inline title editing on the focused card. The card component already handles inline title editing via a click. Add:

```html
<!-- On the title element, add: -->
<span
  data-title-edit
  (click)="startTitleEdit()"
  ...
>
```

This makes it discoverable by the `editFocusedTaskTitle()` method in board-view.

---

### Signal Architecture Additions

| Signal | Location | Type | Purpose |
|--------|----------|------|---------|
| `dragSimulationActive` | `BoardStateService` | `signal(false)` | Drag simulation in progress |
| `dragSimulationSourceColumnId` | `BoardStateService` | `signal<string \| null>(null)` | Source column for drag sim |
| `dragSimulationCurrentColumnId` | `BoardStateService` | `signal<string \| null>(null)` | Current target column for drag sim |
| `disableCount` | `KeyboardShortcutsService` | `number` (private, not signal) | Counter for modal-open disable |
| `recentlyUsedIds` | `KeyboardShortcutsService` | `signal<string[]>([])` | Last 5 used shortcut IDs |
| `searchQuery` | `ShortcutHelpComponent` | `signal('')` | Filter shortcuts by search query |
| `filteredCategories` | `ShortcutHelpComponent` | `computed()` | Categories after applying search |

---

## Phased Implementation

### Phase 1 — Core Navigation + Upgraded Help Modal (no backend, frontend only)

**Scope:**
- h/l cross-column card navigation (B7-1)
- `navigateCardColumn()` in `BoardDragDropHandler`
- `data-column-index` attributes on columns
- Ctrl+1–9 column jump shortcuts (B7-3)
- `scrollToColumn()` in `BoardDragDropHandler`
- `c` (clear filters), `d` (density toggle) shortcuts (B7-2 partial)
- `pushDisable()`/`popDisable()` on `KeyboardShortcutsService`
- `formatShortcut()` fix
- `ShortcutHelpComponent` upgrade: multi-column grid, search input, recently-used section, PrimeNG Dialog, ARIA roles (B7-5)
- Shortcut hint tooltips on toolbar buttons (B7-6) — `TooltipModule` import + `pTooltip`

**Files changed:** 7 files, all frontend
**Test:** `?` opens redesigned modal; h/l moves focus between columns; Ctrl+3 scrolls to column 3; `d` cycles density

---

### Phase 2 — Card Action Shortcuts + Drag Simulation

**Scope:**
- `e` (edit title), `m` (assign to me), `Del` (delete focused) shortcuts (B7-2 complete)
- `AuthService` injection into `BoardViewComponent`
- `data-title-edit` attribute on task card title element (B7-2 edit)
- Drag simulation: `pickUpCard()`, `moveCardToAdjacentColumn()`, `dropCard()`, `cancelDrag()` (B7-4)
- `dragSimulationActive`, `dragSimulationSourceColumnId`, `dragSimulationCurrentColumnId` signals (B7-4)
- Drag simulation indicator banner in board-view template (B7-4)
- Drag simulation column highlight in kanban-column (B7-4)
- `Space` key in `handleKeydown` to pick up card (B7-4)

**Files changed:** 6 files
**Test:** Space picks up focused card; banner appears; h/l moves card column (column highlights); Space/Enter drops; Esc cancels; `e` on a focused card opens title edit; `m` assigns to current user; Del deletes with confirmation

---

### Phase 3 — Discovery + Polish (optional)

**Scope:**
- First-run discovery banner (B7-8): shows "Press ? to see shortcuts" on first board visit, stores seen state in localStorage, auto-fades after 5s
- `recentlyUsedIds` signal in `KeyboardShortcutsService` + `markUsed()` calls
- Recently-used section in `ShortcutHelpComponent`
- Shortcut spec/unit test updates for new shortcuts
- `KeyboardShortcutsService` unit test: test `pushDisable`/`popDisable`

**Files changed:** 3 files
**Test:** On first board load → banner appears → fades after 5s → `?` shows recently-used section populated after using shortcuts

---

## Complete File Change List

| File | Action | One-Line Description |
|------|--------|---------------------|
| `frontend/src/app/core/services/keyboard-shortcuts.service.ts` | Modify | Add pushDisable/popDisable, fix formatShortcut, add recentlyUsedIds signal |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | Modify | Add dragSimulation* signals |
| `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts` | Modify | Add navigateCardColumn, pickUpCard, moveCardToAdjacentColumn, dropCard, cancelDrag, scrollToColumn |
| `frontend/src/app/features/board/board-view/board-shortcuts.service.ts` | Modify | Add c/m/e/Del/d/h/l/Space shortcuts, Ctrl+1–9 column jumps, expand handleKeydown for drag mode |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | Modify | Wire all new callbacks, add drag banner, data-column-index on columns, new private methods, AuthService injection |
| `frontend/src/app/shared/components/shortcut-help/shortcut-help.component.ts` | Modify | Upgrade to PrimeNG Dialog, multi-column grid, search, ARIA roles, pushDisable/popDisable on open/close |
| `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` | Modify | Add dragSimulationActive + dragSimulationCurrentColumnId inputs, isDragTarget computed, ring highlight in template |
| `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | Modify | Add pTooltip with shortcut hints on toolbar buttons, import TooltipModule |
| `frontend/src/app/features/board/task-card/task-card.component.ts` | Modify | Add data-title-edit attribute on title span to expose it to e-shortcut |
| `frontend/src/app/core/services/keyboard-shortcuts.service.spec.ts` | Modify | Add tests for pushDisable/popDisable, formatShortcut fix, recentlyUsedIds |

**Total: 10 files modified, 0 files created, 0 backend changes.**

---

## Success Criteria Checklist

### Phase 1

- [ ] Pressing `h` while a card is focused moves focus to the rightmost card in the column to the left (visually, card in same row index or nearest)
- [ ] Pressing `l` while a card is focused moves focus to the card in the column to the right
- [ ] Pressing `Ctrl+1` scrolls the board horizontally to column 1 without changing view mode
- [ ] Pressing `Ctrl+2` through `Ctrl+9` scroll to their respective columns
- [ ] Pressing `c` clears all active quick filters (the filter chips clear)
- [ ] Pressing `d` cycles card density: compact → normal → expanded → compact
- [ ] The `?` shortcut help modal shows shortcuts in a 2-column grid layout (not single-column list)
- [ ] The shortcut modal has a search input; typing "filter" shows only shortcuts with "filter" in description or category
- [ ] The shortcut modal displays `Ctrl+N` format (not "Ctrl then N")
- [ ] Opening the shortcut modal disables all other keyboard shortcuts (no ghost firing while modal is open)
- [ ] Pressing `Esc` or clicking the backdrop closes the modal and re-enables shortcuts
- [ ] Toolbar buttons show PrimeNG tooltips with shortcut hints (e.g., "Focus filter (F)") on hover
- [ ] All TypeScript type checks pass (`npx tsc --noEmit`)
- [ ] No console.log statements in modified files

### Phase 2

- [ ] Pressing `Space` while a card is focused displays the drag simulation banner ("Card picked up — use h/l to move columns, Space/Enter to drop, Esc to cancel")
- [ ] During drag simulation, pressing `h` moves the target column highlight one column left
- [ ] During drag simulation, pressing `l` moves the target column highlight one column right
- [ ] The target column shows a visual ring/highlight during drag simulation
- [ ] Pressing `Space` or `Enter` during drag simulation drops the card in the highlighted column (API call fires, card appears in new column)
- [ ] Pressing `Esc` during drag simulation cancels the move (card stays in original column, no API call)
- [ ] Pressing `e` while a card is focused triggers inline title editing on that card
- [ ] Pressing `m` while a card is focused assigns the task to the currently logged-in user (optimistic update, API fires)
- [ ] Pressing `Del` or `Backspace` while a card is focused deletes it (with the standard delete flow)
- [ ] All drag simulation shortcuts are blocked from acting as normal navigation shortcuts (e.g., h/l during drag only move the simulated card, not the focus)
- [ ] ARIA live region announces "Card picked up" and "Card dropped in column X" / "Card move cancelled" to screen readers
- [ ] All TypeScript type checks pass

### Phase 3

- [ ] On first board load (fresh localStorage), a banner appears: "Press ? to see all keyboard shortcuts"
- [ ] The banner fades after 5 seconds automatically
- [ ] The banner has an "×" button to dismiss immediately
- [ ] After dismissing, the banner never appears again (localStorage flag persists across sessions)
- [ ] After using any shortcut, the "Recently Used" section in the shortcut modal shows that shortcut
- [ ] The Recently Used section shows a maximum of 5 shortcuts
- [ ] `KeyboardShortcutsService` unit tests pass including pushDisable/popDisable behavior
- [ ] All cargo check / tsc / build checks pass

### Cross-Cutting

- [ ] All existing shortcuts (n, /, f, j, k, Enter, Esc, 1–6 view mode) still work correctly after changes
- [ ] Shortcut handling is suppressed when focus is in any `<input>`, `<textarea>`, or `contenteditable` element (existing behavior preserved)
- [ ] The feature matches or exceeds the comp.md B7 winner pattern (? modal + column jump + card actions)
- [ ] No orphaned code (every new method has a caller, every new signal has a reader)
- [ ] File sizes remain under 800 lines (split `board-view.component.ts` if it grows past threshold)

---

## Key Design Decisions

### Why Ctrl+1–9 for column jump (not plain 1–9)?

Plain 1–6 already switch view modes (kanban/list/calendar/gantt/reports/time-report) — these are registered and used. Reusing 1–9 for column jumps would require removing view-mode shortcuts or creating a conflict. `Ctrl+1` through `Ctrl+9` is a standard cross-platform pattern (browsers use it for tab switching) and is unlikely to conflict with other shortcuts.

### Why drag simulation instead of CDK keyboard drag?

Angular CDK drag-drop has no built-in keyboard accessibility as of December 2025 (GitHub issue #25468, open since 2022, P3 priority). The custom simulation approach gives immediate value, follows the WAI-ARIA drag-drop pattern (Space=pick up, Arrow=move, Space/Enter=drop, Escape=cancel), and can be replaced with official CDK support when it ships.

### Why PrimeNG Dialog for the shortcut modal?

The existing `ShortcutHelpComponent` uses a custom overlay `<div>` without proper focus trapping. PrimeNG 19 Dialog handles focus trapping (`aria-modal`, `pFocusTrap`), Escape key closing, and scroll locking out of the box, consistent with the existing pattern in `board-view.component.ts`.

### Why pushDisable/popDisable counter instead of a boolean?

Multiple modals can open simultaneously (e.g., a WIP limit dialog opens while a shortcut help was already open). A counter ensures shortcuts remain disabled until all overlays close, preventing shortcut firing when focus is inside a dialog.

---

## Sources

- [Jira Keyboard Shortcuts](https://keycombiner.com/collections/jira/) — board shortcuts including n/p for columns, j/k for issues, c for create
- [Trello Keyboard Shortcuts](https://support.atlassian.com/trello/docs/keyboard-shortcuts-in-trello/) — j/k/arrows for cards, left/right arrows for columns
- [Linear Keyboard Shortcuts](https://keycombiner.com/collections/linear/) — c/e/a/s/p/l for issue actions, j/k/h/l for navigation, ?, Ctrl+K
- [Jira Board Shortcuts](https://support.atlassian.com/jira-software-cloud/docs/use-keyboard-shortcuts/) — n/p for column navigation, j/k for issues
- [GitHub Keyboard Shortcuts Modal](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts) — ? key, 2-column table layout, 13 categories
- [WAI-ARIA APG Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) — keyboard patterns for interactive widgets
- [Accessible Drag and Drop Patterns](https://medium.com/salesforce-ux/4-major-patterns-for-accessible-drag-and-drop-1d43f64ebf09) — Space=pick up, Arrow=move, Space/Enter=drop, Esc=cancel
- [Angular CDK Drag Drop Keyboard Issue #25468](https://github.com/angular/components/issues/25468) — CDK has no built-in keyboard support (open since 2022)
- [WAI-ARIA Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — role=dialog, aria-modal, focus trap, Escape to close
- [PrimeNG 19 Accessibility Guide](https://primeng.org/guides/accessibility) — Dialog component has built-in focus trap and aria-modal
- [Kanboard Vim-style shortcuts](https://kanboard.io/) — h/j/k/l navigation on kanban boards
- [Kanban Tool Shortcuts](https://kanbantool.com/support/features/keyboard-shortcuts) — comma/period for column movement
