# Plan: B3 — Quick Filter Bar
Generated: 2026-03-02
Feature: B3 — Quick Filter Bar (Kanban Board)
Stack: Angular 19 · TypeScript 5.7 · Tailwind CSS 4 · PrimeNG 19 · Rust/Axum · PostgreSQL 16

---

## Requirements

### What B3 Means

B3 is a horizontal row of pill-shaped quick filter buttons that sit in the board toolbar, letting users instantly narrow board cards to common subsets without opening dropdowns. The implementation follows the Asana/Jira pattern: 4–5 preset pills, each toggling independently; active = filled primary color; all apply AND logic against the existing advanced filter state; "Clear all" link appears when any are active.

### Sub-features IN SCOPE

1. **"Overdue" quick-filter pill** — tasks where `due_date < today` (filter not yet implemented in toolbar)
2. **Active chip visual style** — filled `bg-[var(--primary)] text-[var(--primary-foreground)]` vs outlined when inactive; smooth transition
3. **"Clear all" link** — appears below quick filter pills when ≥1 quick filter is active; clears only quick filters (not advanced filters)
4. **"My Tasks" pill** — already exists but misses the teal/filled style when active; convert to pill style matching Overdue
5. **"Due This Week" pill** — already exists; same style normalization
6. **"High Priority" pill** — already exists; same style normalization
7. **`isOverdue` quick filter added to `TaskFilters` interface + `filterTasks()` logic in `BoardStateService`** — overdue computed in the filter pass, no URL param needed (volatile real-time data)
8. **URL persistence for overdue quick filter** — parity with other quick filters (round-trip through query params)
9. **Active filter count badge update** — `activeFilterCount()` must count `overdue` flag
10. **Keyboard shortcut `F`** — focuses the filter bar / cycles to next quick filter pill (existing shortcut is `/` for search; `F` is per the B7 plan and Linear/Jira pattern; add here as it touches the same toolbar)

### Sub-features EXPLICITLY OUT OF SCOPE

| Sub-feature | Reason |
|---|---|
| Advanced filter panel (Priority dropdown, Assignee multi-select, Label multi-select, Date range pickers) | Already fully implemented in `board-toolbar.component.ts`. B3 is quick-filter pills only. |
| Filter preset save/load | Already implemented via `FilterPresetsService`. |
| Server-side filter API changes | All filtering is pure client-side computed signal logic. No backend changes needed. |
| Swimlanes "Group by" dropdown | That is B6 scope. |
| Card density toggle | That is B4 scope. |
| `@ngneat/hotkeys` install | Keyboard shortcuts are handled via existing `KeyboardShortcutsService`; no new package needed. |

---

## Competitor Benchmark

### Winner Pattern (Asana + Jira)

```
[My Tasks ×] [Due This Week ×] [High Priority ×] [Overdue ×]  Clear all
```

- Pills are `<button>` elements with `rounded-full` shape
- **Inactive:** `border border-[var(--border)] bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--secondary)]`
- **Active:** `bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent` — no outline, filled
- Active pill may optionally show `×` icon to clear just that one filter
- "Clear all" is a text-link (not a button) at the end of the pill row, appears only when ≥1 quick filter is active
- Multi-select = **AND** logic: active Quick Filters are ANDed together, AND ANDed with advanced filters
- Keyboard: `F` focuses / toggles filter bar

### Most Important Gap vs Best-in-Class

**The "Overdue" pill is missing entirely.** Overdue is the most frequently used quick filter across Linear, Jira, Asana, and ClickUp — it's the one filter users reach for most when triaging a board. The three existing pills (My Tasks, Due This Week, High Priority) cover prospective planning; Overdue covers reactive fire-fighting. Without it, power users can't do a one-click "show me what's burning" scan.

The **visual style gap** is secondary: the three existing pills use `p-button` with `[outlined]` binding but don't match the pill chip aesthetic (they render as rectangular PrimeNG buttons, not rounded chips). Converting them to native `<button>` elements with Tailwind classes gives full visual control.

---

## What Already Exists

| Item | File | Status |
|---|---|---|
| "My Tasks" quick filter toggle | `board-toolbar.component.ts:196–213` | EXISTS — logic correct, visual style wrong (PrimeNG button, not pill) |
| "Due This Week" quick filter toggle | `board-toolbar.component.ts:196–213` | EXISTS — same issue |
| "High Priority" quick filter toggle | `board-toolbar.component.ts:196–213` | EXISTS — same issue |
| `isMyTasksActive`, `isDueThisWeekActive`, `isHighPriorityActive` computed signals | `board-toolbar.component.ts:396–417` | EXISTS |
| "Clear filters (N)" button | `board-toolbar.component.ts:291–300` | EXISTS — but is a full PrimeNG button at bottom of toolbar row, not a minimal "Clear all" text-link beside the pills |
| `activeFilterCount()` | `board-toolbar.component.ts:474–483` | EXISTS — does not count `overdue` quick filter |
| `filterTasks()` | `board-state.service.ts:645–696` | EXISTS — no overdue logic branch |
| `TaskFilters` interface | `board-toolbar.component.ts:44–51` | EXISTS — missing `overdue?: boolean` field |
| `isOverdue(dueDate)` utility | `shared/utils/task-colors.ts:175–181` | EXISTS — ready to import |
| Board shortcuts service (handles `F` key as "focus search") | `board-shortcuts.service.ts` | EXISTS — currently `F` is not registered; `/` is search focus |
| `DEFAULT_FILTERS` constant | `board-toolbar.component.ts:53–60` | EXISTS — needs `overdue: false` added |

**What needs to be built from scratch:**
- "Overdue" pill button + `isOverdueActive` computed signal
- `overdue` field in `TaskFilters` interface + filter logic in `filterTasks()`
- Pill chip styling (replace PrimeNG buttons with native `<button>` + Tailwind)
- "Clear all" text-link (replace existing "Clear filters (N)" button with minimal link beside pills)
- `F` keyboard shortcut registered in `BoardShortcutsService`

---

## Backend Changes

**No backend changes required.**

All filtering is pure client-side. The "Overdue" filter compares `task.due_date` (already returned in the board full-response) against `new Date()` using the existing `isOverdue()` utility. No new API endpoints, migrations, or DB model changes are needed for B3.

---

## Frontend Changes

### 1. `TaskFilters` interface — add `overdue` field

**File:** `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`

```typescript
// BEFORE
export interface TaskFilters {
  search: string;
  priorities: TaskPriority[];
  assigneeIds: string[];
  dueDateStart: string | null;
  dueDateEnd: string | null;
  labelIds: string[];
}

// AFTER
export interface TaskFilters {
  search: string;
  priorities: TaskPriority[];
  assigneeIds: string[];
  dueDateStart: string | null;
  dueDateEnd: string | null;
  labelIds: string[];
  overdue: boolean;            // NEW
}

const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  priorities: [],
  assigneeIds: [],
  dueDateStart: null,
  dueDateEnd: null,
  labelIds: [],
  overdue: false,              // NEW
};
```

### 2. `board-toolbar.component.ts` — pill chip UI + Overdue pill + "Clear all" link

**File:** `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`

**Changes:**
- Remove PrimeNG `ButtonModule` from the quick-filter section (keep it for Density Toggle buttons and Preset buttons)
- Replace the 3-pill `<div class="flex items-center gap-1.5">` block with a redesigned block
- Add `isOverdueActive` computed signal
- Add `toggleOverdue()` method
- Add `clearQuickFilters()` method (clears only quick filter fields, leaving advanced filters intact)
- Update `activeFilterCount()` to count `overdue`
- Add `overdue` to `persistFilters()` URL params (as `'overdue': filters.overdue ? 'true' : null`)
- Read `overdue` back from URL params in `ngOnInit`

**New quick-filter template block (pseudo-HTML):**

```html
<!-- Quick Filter Pills -->
<div class="flex items-center gap-1.5 flex-wrap">

  <!-- My Tasks pill -->
  <button
    type="button"
    (click)="toggleMyTasks()"
    [class]="isMyTasksActive()
      ? 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] border border-transparent transition-colors cursor-pointer'
      : 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors cursor-pointer'"
  >
    <i class="pi pi-user text-[10px]"></i>
    My Tasks
    @if (isMyTasksActive()) {
      <i class="pi pi-times text-[10px] ml-0.5 opacity-70"></i>
    }
  </button>

  <!-- Due This Week pill -->
  <button
    type="button"
    (click)="toggleDueThisWeek()"
    [class]="isDueThisWeekActive()
      ? 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] border border-transparent transition-colors cursor-pointer'
      : 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors cursor-pointer'"
  >
    <i class="pi pi-calendar text-[10px]"></i>
    Due This Week
    @if (isDueThisWeekActive()) {
      <i class="pi pi-times text-[10px] ml-0.5 opacity-70"></i>
    }
  </button>

  <!-- High Priority pill -->
  <button
    type="button"
    (click)="toggleHighPriority()"
    [class]="isHighPriorityActive()
      ? 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-[var(--primary)] text-[var(--primary-foreground)] border border-transparent transition-colors cursor-pointer'
      : 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-[var(--muted-foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors cursor-pointer'"
  >
    <i class="pi pi-flag text-[10px]"></i>
    High Priority
    @if (isHighPriorityActive()) {
      <i class="pi pi-times text-[10px] ml-0.5 opacity-70"></i>
    }
  </button>

  <!-- Overdue pill (NEW) -->
  <button
    type="button"
    (click)="toggleOverdue()"
    [class]="isOverdueActive()
      ? 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white border border-transparent transition-colors cursor-pointer'
      : 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 transition-colors cursor-pointer'"
  >
    <i class="pi pi-exclamation-circle text-[10px]"></i>
    Overdue
    @if (isOverdueActive()) {
      <i class="pi pi-times text-[10px] ml-0.5 opacity-70"></i>
    }
  </button>

  <!-- "Clear all" link (appears only when ≥1 quick filter active) -->
  @if (anyQuickFilterActive()) {
    <button
      type="button"
      (click)="clearQuickFilters()"
      class="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline-offset-2 hover:underline transition-colors cursor-pointer ml-1"
    >
      Clear all
    </button>
  }
</div>
```

**New computed signals to add:**

```typescript
// In BoardToolbarComponent class:

readonly isOverdueActive = computed(() => this.filters().overdue === true);

readonly anyQuickFilterActive = computed(() =>
  this.isMyTasksActive() ||
  this.isDueThisWeekActive() ||
  this.isHighPriorityActive() ||
  this.isOverdueActive()
);
```

**New methods to add:**

```typescript
toggleOverdue(): void {
  this.updateFilter('overdue', !this.filters().overdue);
}

clearQuickFilters(): void {
  const userId = this.authService.currentUser()?.id;
  // Reset only the quick filter fields:
  const updated: TaskFilters = {
    ...this.filters(),
    overdue: false,
    priorities: this.isHighPriorityActive() ? [] : this.filters().priorities,
    assigneeIds: (userId && this.isMyTasksActive()) ? [] : this.filters().assigneeIds,
    dueDateStart: this.isDueThisWeekActive() ? null : this.filters().dueDateStart,
    dueDateEnd: this.isDueThisWeekActive() ? null : this.filters().dueDateEnd,
  };
  this.selectedPriorities = updated.priorities;
  this.selectedAssignees = updated.assigneeIds;
  this.dueDateStartValue = updated.dueDateStart ? new Date(updated.dueDateStart) : null;
  this.dueDateEndValue = updated.dueDateEnd ? new Date(updated.dueDateEnd) : null;
  this.filters.set(updated);
  this.persistFilters(updated);
  this.filtersChanged.emit(updated);
}
```

**`activeFilterCount()` update:**

```typescript
activeFilterCount(): number {
  const f = this.filters();
  let count = 0;
  if (f.search) count++;
  if (f.priorities.length) count++;
  if (f.assigneeIds.length) count++;
  if (f.dueDateStart || f.dueDateEnd) count++;
  if (f.labelIds.length) count++;
  if (f.overdue) count++;         // NEW
  return count;
}
```

**`persistFilters()` update (add overdue to URL params):**

```typescript
private persistFilters(filters: TaskFilters): void {
  const queryParams: Record<string, string | null> = {
    search: filters.search || null,
    priorities: filters.priorities.length ? filters.priorities.join(',') : null,
    assignees: filters.assigneeIds.length ? filters.assigneeIds.join(',') : null,
    dueDateStart: filters.dueDateStart,
    dueDateEnd: filters.dueDateEnd,
    labels: filters.labelIds.length ? filters.labelIds.join(',') : null,
    overdue: filters.overdue ? 'true' : null,    // NEW
  };
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams,
    queryParamsHandling: 'merge',
  });
}
```

**`ngOnInit` URL param parsing update:**

```typescript
// In the route.queryParams.pipe(...).subscribe block, add:
overdue: params['overdue'] === 'true',
```

### 3. `board-state.service.ts` — add overdue to `filterTasks()`

**File:** `frontend/src/app/features/board/board-view/board-state.service.ts`

**Changes:**
- Import `isOverdue` from `shared/utils/task-colors`
- Add overdue branch to `filterTasks()`

```typescript
// At top of file, add import:
import { isOverdue } from '../../../shared/utils/task-colors';

// In filterTasks(), add after the labelIds block:
if (filters.overdue) {
  if (!isOverdue(task.due_date)) {
    return false;
  }
}
```

**Note:** The `filters` signal in `BoardStateService` is initialized from a separate import of `TaskFilters` (line 53–60). After adding `overdue: boolean` to the interface, the initial value in `board-state.service.ts` must also add `overdue: false`.

### 4. `board-shortcuts.service.ts` — register `F` shortcut

**File:** `frontend/src/app/features/board/board-view/board-shortcuts.service.ts`

**Changes:**
- Add `focusFilter` callback to the `registerShortcuts` callbacks object
- Register `F` shortcut that calls `focusFilter()`
- Update `board-view.component.ts` to pass the `focusFilter` callback

```typescript
// Add to registerShortcuts callbacks param type:
focusFilter: () => void;

// Inside registerShortcuts():
this.shortcutsService.register('board-focus-filter', {
  key: 'f',
  description: 'Focus filter / toggle filter bar',
  category: 'Board',
  action: () => callbacks.focusFilter(),
});
```

**In `board-view.component.ts`**, pass `focusFilter` as:

```typescript
focusFilter: () => {
  // Focus the first quick filter pill or the search input
  const searchInput = document.querySelector<HTMLInputElement>(
    'input[placeholder*="Search"]',
  );
  searchInput?.focus();
},
```

---

## Signal Architecture

| Signal / Computed | Location | Type | Purpose |
|---|---|---|---|
| `filters` (existing) | `BoardToolbarComponent` | `signal<TaskFilters>` | Full filter state including `overdue` |
| `isMyTasksActive` (existing) | `BoardToolbarComponent` | `computed<boolean>` | Derived from `filters().assigneeIds` |
| `isDueThisWeekActive` (existing) | `BoardToolbarComponent` | `computed<boolean>` | Derived from `filters().dueDateStart/End` |
| `isHighPriorityActive` (existing) | `BoardToolbarComponent` | `computed<boolean>` | Derived from `filters().priorities` |
| `isOverdueActive` (NEW) | `BoardToolbarComponent` | `computed<boolean>` | Derived from `filters().overdue` |
| `anyQuickFilterActive` (NEW) | `BoardToolbarComponent` | `computed<boolean>` | OR of all 4 quick filter computed signals |
| `filters` (existing) | `BoardStateService` | `signal<TaskFilters>` | Board-level filter state, read by `filteredBoardState` |
| `filteredBoardState` (existing) | `BoardStateService` | `computed<Record<string, Task[]>>` | Calls `filterTasks()` which gains overdue branch |

**Data flow (unchanged architecture):**

```
BoardToolbarComponent.filters signal
  → emits filtersChanged output
    → BoardViewComponent.onFiltersChanged()
      → BoardStateService.filters.set()
        → BoardStateService.filteredBoardState (computed, auto-recomputes)
          → KanbanColumnComponent receives filtered task list
```

No new services. No new RxJS subjects. No changes to the data flow architecture.

---

## Phased Implementation

### Phase 1 — Frontend-only, no backend (implement this phase only)

All B3 changes are pure frontend, pure signal logic, zero backend.

| Step | What to do | File |
|---|---|---|
| 1.1 | Add `overdue: boolean` to `TaskFilters` interface and `DEFAULT_FILTERS` | `board-toolbar.component.ts` |
| 1.2 | Add `isOverdueActive` and `anyQuickFilterActive` computed signals | `board-toolbar.component.ts` |
| 1.3 | Add `toggleOverdue()` and `clearQuickFilters()` methods | `board-toolbar.component.ts` |
| 1.4 | Replace 3 PrimeNG `p-button` pills with native `<button>` pill-chip HTML | `board-toolbar.component.ts` |
| 1.5 | Add Overdue pill button to template | `board-toolbar.component.ts` |
| 1.6 | Add "Clear all" text-link (conditional on `anyQuickFilterActive()`) | `board-toolbar.component.ts` |
| 1.7 | Update `activeFilterCount()` to count `overdue` | `board-toolbar.component.ts` |
| 1.8 | Update `persistFilters()` and URL param parsing in `ngOnInit` | `board-toolbar.component.ts` |
| 1.9 | Add `overdue: false` to initial `filters` signal in `BoardStateService` | `board-state.service.ts` |
| 1.10 | Import `isOverdue` and add overdue branch in `filterTasks()` | `board-state.service.ts` |
| 1.11 | Add `F` shortcut registration + `focusFilter` callback | `board-shortcuts.service.ts`, `board-view.component.ts` |
| 1.12 | Update spec files for new behavior | `board-toolbar.component.spec.ts`, `board-view.component.spec.ts` |

### Phase 2 — Trivial backend additions

**None required for B3.** Filtering is entirely client-side.

### Phase 3 — Complex features (optional)

**None required for B3.** The full feature is achievable in Phase 1.

---

## File Change List

| File | Action | Description |
|---|---|---|
| `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | MODIFY | Add `overdue` to `TaskFilters` + `DEFAULT_FILTERS`; add `isOverdueActive`, `anyQuickFilterActive` computed; add `toggleOverdue()`, `clearQuickFilters()`; replace PrimeNG pill buttons with native `<button>` chip HTML; add Overdue pill; add "Clear all" link; update `activeFilterCount()`, `persistFilters()`, `ngOnInit` URL parse |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | MODIFY | Add `overdue: false` to initial `filters` signal; import `isOverdue`; add overdue branch in `filterTasks()` |
| `frontend/src/app/features/board/board-view/board-shortcuts.service.ts` | MODIFY | Add `focusFilter` to callbacks type; register `F` key shortcut |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | MODIFY | Pass `focusFilter` callback to `BoardShortcutsService.registerShortcuts()` |
| `frontend/src/app/features/board/board-toolbar/board-toolbar.component.spec.ts` | MODIFY | Add tests: `isOverdueActive()` true/false, `anyQuickFilterActive()`, `toggleOverdue()`, `clearQuickFilters()`, `activeFilterCount()` including overdue, URL param persistence for `overdue` |
| `frontend/src/app/features/board/board-view/board-view.component.spec.ts` | MODIFY | Add test: `F` key shortcut calls `focusFilter` |

**Total files changed: 5 (modify only, no new files)**

---

## Implementation Notes

### Why native `<button>` instead of `p-button`

PrimeNG's `p-button` renders as a rectangular button. To get true `rounded-full` pill chips with full Tailwind control (active state, icon + text + dismiss ×), native `<button>` elements with Tailwind classes are the correct choice. `p-button` remains in use for the Density Toggle buttons (which have different visual requirements) and the preset save/load buttons.

### Why "Clear all" is a text-link, not a button

The Asana/Jira UX pattern places "Clear all" as a minimal text-link immediately after the pills, not as a PrimeNG button. A button would be visually heavy and compete with the pill row. The text-link has `hover:underline` for discoverability.

### "Clear all" semantics

`clearQuickFilters()` only clears fields that a quick filter pill controls:
- `overdue: false`
- `priorities: []` — only if "High Priority" is the reason priorities are set; if user also set priorities via the advanced Priority dropdown, the quick filter for High Priority overrides it, so `clearQuickFilters()` clears priorities entirely

For simplicity and to match user expectation: `clearQuickFilters()` resets `overdue`, and un-does the specific fields that each active quick filter changed. If the advanced filters (Priority dropdown, Assignee dropdown, Date range) were also set independently, they remain. The logic checks `isHighPriorityActive()`, `isMyTasksActive()`, `isDueThisWeekActive()` to know which fields to reset.

### Overdue pill color

The Overdue pill uses red (`bg-red-500 text-white`) when active and red-tinted border (`border-red-200 text-red-500`) when inactive — instead of the primary blue. This matches industry convention (Asana uses amber/red for overdue; Linear uses red for overdue status) and gives Overdue a distinct visual urgency signal vs. the neutral quick filters.

### `F` shortcut scope

In `handleKeydown()` (the low-level handler), `F`/`f` is already absent from the switch block — it won't conflict. The registered shortcut in `KeyboardShortcutsService` fires only when focus is not in an input/textarea/contenteditable element (the guard is in `KeyboardShortcutsService`). Since the filter search input is an `<input>`, pressing `F` while typing will not trigger the shortcut.

### `clearFilters()` vs `clearQuickFilters()`

The existing `clearFilters()` method clears **all** filters (advanced + quick). The new `clearQuickFilters()` clears only quick filters. Both are kept. The existing "Clear filters (N)" PrimeNG button in the bottom-right of the toolbar calls `clearFilters()` and remains unchanged (it shows when any filter, advanced or quick, is active).

---

## Success Criteria Checklist

### Visual / Interaction

- [ ] Four pill buttons visible in board toolbar: "My Tasks", "Due This Week", "High Priority", "Overdue"
- [ ] Each pill has `rounded-full` shape and icon prefix
- [ ] Inactive pill: bordered outline style (`border border-[var(--border)] text-[var(--muted-foreground)]`)
- [ ] Active pill: filled primary color (`bg-[var(--primary)] text-[var(--primary-foreground)]`), no border
- [ ] Active "Overdue" pill: filled red (`bg-red-500 text-white`), distinct from primary
- [ ] Active pill shows `×` icon at its right end
- [ ] Clicking an active pill toggles it off (deactivates)
- [ ] Clicking an inactive pill toggles it on (activates)
- [ ] "Clear all" text-link appears to the right of the pills when ≥1 quick filter is active
- [ ] "Clear all" disappears when no quick filters are active
- [ ] Clicking "Clear all" deactivates all 4 quick filter pills without affecting advanced filters

### Filter Logic

- [ ] "Overdue" filter: cards with `due_date` before today are shown; cards with no due date or future due date are hidden
- [ ] Multi-select works: activating "My Tasks" + "Overdue" shows only tasks assigned to me that are also overdue (AND logic)
- [ ] Quick filters AND with advanced filters (Priority dropdown, Assignee, etc.)
- [ ] Filter count badge in the "Clear filters" button counts overdue as +1 when active

### Persistence

- [ ] Activating "Overdue" pill adds `?overdue=true` to URL
- [ ] Refreshing the page with `?overdue=true` in URL restores the Overdue pill as active
- [ ] All other existing filter URL params round-trip correctly after B3 changes

### Shortcuts

- [ ] Pressing `F` key (when not typing in an input) focuses the search input in the toolbar
- [ ] `?` key still opens shortcut help modal (unchanged from B7 plan)

### Code Quality

- [ ] `cargo check` / `cargo clippy` pass (no backend changes, so trivially true)
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] `npm run build -- --configuration=production` passes
- [ ] No `console.log` statements in modified files
- [ ] No mutation of filter state objects (all updates via spread / `updateFilter()`)
- [ ] All modified files stay under 800 lines (board-toolbar is currently 672 lines; estimated additions ~80 lines → ~752 lines, within limit)
- [ ] `board-toolbar.component.spec.ts` has tests for: `isOverdueActive`, `anyQuickFilterActive`, `toggleOverdue`, `clearQuickFilters`, `activeFilterCount` with overdue, URL param round-trip for `overdue`

### No Orphaned Code

- [ ] `overdue` field in `TaskFilters` is consumed by both `filterTasks()` in `BoardStateService` and `persistFilters()` in `BoardToolbarComponent`
- [ ] `clearQuickFilters()` is called by the "Clear all" link in the template (no dead method)
- [ ] `focusFilter` callback is actually passed from `board-view.component.ts` to `registerShortcuts()`

---

## Sources

- [Angular Signals Overview](https://angular.dev/guide/signals) — Signal and computed signal patterns
- [Angular Signals Deep Dive](https://angular.love/signals-in-angular-deep-dive-for-busy-developers/) — Computed dependency tracking behavior
- [Search and filter with Angular signals](https://medium.com/@bananicabananica/search-and-filter-with-angular-signals-b63e2b587001) — Filter pattern with computed signals
- [Jira Quick Filter docs](https://support.atlassian.com/jira-software-cloud/docs/configure-quick-filters/) — Jira's pill button pattern and AND logic
- [Asana Quick Filters forum](https://forum.asana.com/t/quick-filters-in-project/334512) — Asana user feedback on quick filter UX
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) — Tailwind 4 utility class patterns
- [Angular 19 Standalone Components](https://dev.to/mohamedlaminef/whats-new-in-angular-19-standalone-components-signals-and-more-44hf) — Standalone component patterns
- [Asana "Clear all" button positioning feedback](https://forum.asana.com/t/move-the-position-of-the-clear-all-button-in-quick-filters/513736) — "Clear all" UX discussion
- [Jira Clear all filters (iOS)](https://support.atlassian.com/jira-cloud-ios/docs/clear-all-board-filters/) — Jira clear-all behavior reference
- TaskBolt codebase: `board-toolbar.component.ts`, `board-state.service.ts`, `board-shortcuts.service.ts`, `shared/utils/task-colors.ts`
