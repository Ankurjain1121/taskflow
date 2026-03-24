# RESEARCH: TaskBolt Kanban Board B1-B8 Improvements
Generated: 2026-03-02
Stack: Angular 19 + TypeScript 5.7 + Tailwind CSS 4 + PrimeNG 19 | Rust/Axum backend

---

## WHAT'S ALREADY BUILT (Do Not Re-implement)

| Feature | Status | Location |
|---------|--------|----------|
| B1: Priority badge, due date coloring, assignee avatars, label chips, subtask progress | EXISTS | `task-card.component.ts` (858 lines) |
| B2: Lazy rendering + "Show more" pagination (IntersectionObserver) | EXISTS | `kanban-column.component.ts` (520 lines) |
| B3: My Tasks, Due This Week, High Priority quick filters | EXISTS | `board-toolbar.component.ts` (638 lines) |
| B4: compact/normal density toggle on card | EXISTS | `task-card.component.ts` — `density` input signal |
| B5: Column color (`VARCHAR(7)`) + WIP limit + collapse | EXISTS | `kanban-column.component.ts`, `board.rs` model |
| B7: Keyboard shortcuts service | EXISTS | `board-shortcuts.service.ts` |
| Fractional indexing for task/column positions | EXISTS | `board-drag-drop.handler.ts` |
| Optimistic update + rollback pattern | EXISTS | `board-state.service.ts:256` |
| `filteredBoardState` computed signal | EXISTS | `board-state.service.ts` |

**Key insight: TaskBolt's kanban is already ~60% done. B1-B8 is polish + gaps, not a rebuild.**

---

## INSTALL

```bash
# Only ONE new package needed for all 8 features:
cd /home/ankur/taskflow/frontend
npm install @ngneat/hotkeys@4.1.0

# Everything else is already installed:
# @angular/cdk ^19.2.19  — cdkDropList, cdkDrag, CdkScrollable
# primeng 19.1.4          — ColorPicker, Tooltip, OverlayPanel
# tailwindcss 4.1.18      — all utility classes
# fractional-indexing 3.2.0 — already used for task reorder
```

---

## DEPENDENCIES

| package | version | purpose |
|---------|---------|---------|
| @angular/cdk | ^19.2.19 (existing) | drag-drop, scrolling, overlay |
| primeng | 19.1.4 (existing) | ColorPicker, OverlayPanel, Tooltip |
| fractional-indexing | 3.2.0 (existing) | swimlane group ordering |
| @ngneat/hotkeys | 4.1.0 (NEW) | declarative keyboard shortcuts |

## DEV DEPENDENCIES

No new dev dependencies needed.

---

## COMPETITOR ANALYSIS

### B1: Rich Task Cards

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Linear | Priority dot, ID, title, assignee avatar (right), due date chip (red if overdue), label dots | Minimal — only what's needed |
| Notion | Minimal cards, properties shown as chips only when configured | Property-conditional rendering |
| ClickUp | Dense: priority flag (colored), status, assignee stack, due date, tags, subtask count, time estimate | Most data-rich in industry |
| Jira | Epic color strip (left), issue type icon, summary, assignee, priority, story points | Left color strip as visual anchor |
| Trello | Cover image, title, labels (colored chips), member avatars, due date badge, checklist progress bar | Cover image dominant |
| Asana | Task name, assignee avatar, due date, custom field values | Clean, minimal |
| Height | Priority icon, title, assignee, due date, label stack | Similar to Linear |
| Shortcut | Story type icon, ID, title, estimate chip, owner, label dots | Compact by default |
| Monday | Column values as colored cells, avatar, status bubble | Column-value matrix style |
| Plane | Priority icon, title, state icon, assignee, due date | Open-source Linear clone |

**Winner pattern:** Priority + title (full width) + assignee avatar (right) + due date chip (color-coded) + label chips (truncated) + subtask progress bar (bottom). TaskBolt task-card already matches this. Gap: no "expanded" mode showing description preview.

### B2: Column Pagination

| Product | Approach |
|---------|----------|
| Linear | Virtual scroll within columns (read-only, no DnD across scroll boundary) |
| Trello | "Show all N cards" button at bottom; count in header |
| ClickUp | "Load more" + count in header ("Todo (23)") |
| Jira | Load more button; column count shown |
| Asana | "Show N more tasks" link |
| Height | Infinite scroll + count chip |
| Shortcut | Count badge in column header; load more at bottom |
| Monday | Paginated groups |
| Plane | Load more button |
| Notion | "Load N more" link |

**Winner pattern:** Show 20 → "Show N more" button → count in header badge. TaskBolt kanban-column already has this. Gap: count badge in column header missing, server-side pagination for very large boards not implemented.

### B3: Quick Filter Bar

| Product | Approach |
|---------|----------|
| Linear | Filter row: "Group by", "Filter", "Display" dropdowns; chip-based active filters with X to remove |
| Trello | Filter card overlay (member, label, due date); active filters show as blue chips |
| ClickUp | "Filter" button → dropdown with 20+ filter types; active filters as removable chips above board |
| Jira | "Epic Link", "Label", "Assignee" quick-filter buttons above board; turn teal when active |
| Asana | Quick filters: "Assignee is me", "Due this week", "Priority" — horizontal pill buttons |
| Height | Filter bar with multi-select operators (is, is not, contains) |
| Shortcut | Search + filter bar; saved filters |
| Monday | Filter row with column-based filters |
| Plane | Module/cycle/label/assignee filters as chips |
| Notion | Filter by property |

**Winner pattern:** Horizontal pill buttons for 4-6 preset quick filters. Active = filled/teal color. Multi-select = AND logic. X to clear individual filter. "Clear all" link when any active. Asana/Jira pattern. Gap in TaskBolt: Overdue filter missing, "Clear all" missing, active chip style missing.

### B4: Card Density Toggle

| Product | Approach |
|---------|----------|
| Linear | Display menu → "Compact / Comfortable" — 2 options |
| ClickUp | "Card size" toggle: Compact / Normal / Large — 3 options in board settings |
| Jira | None built-in |
| Trello | None |
| Asana | None for kanban specifically |
| Height | "Density" option: Compact / Default |
| Notion | Property visibility controls (not density) |
| Shortcut | None |
| Monday | Row height toggle (table view, not kanban) |
| Plane | None |

**Winner pattern:** 3-option toggle (compact/comfortable/expanded) in board toolbar. Persist in localStorage. Linear/ClickUp pattern. TaskBolt already has compact/normal in task-card — needs expanded mode + persistence + toolbar toggle UI.

### B5: Column Customization

| Product | Approach |
|---------|----------|
| Linear | Status icon (circle/in-progress/done icons with color) on column header; click to edit |
| Trello | None (no column colors) |
| ClickUp | Column header color via right-click → "Column color"; WIP limit badge "3/5" |
| Jira | No column color; WIP limit in settings |
| Asana | Section color; no WIP |
| Height | Color per status |
| Shortcut | Workflow state colors |
| Monday | Group color (left border strip) |
| Plane | State color + icon |
| Notion | None |

**Winner pattern:** Color swatch picker on column header (click/hover to reveal). WIP limit shown as badge "n/limit" in header, turns red when exceeded. TaskBolt already has `color` field in DB and WIP tracking — gap: icon field missing from DB + column icon picker UI missing.

### B6: Swimlanes

| Product | Approach |
|---------|----------|
| Linear | Group by: Assignee / Priority / Label / Project / Cycle / Estimate — horizontal rows between columns |
| ClickUp | Swimlanes: group by any custom field, assignee, priority — major feature |
| Jira | Epic swimlanes; "None" swimlane for unassigned |
| Asana | Section rows (not true swimlanes) |
| Height | Group by: Assignee / Priority / Label / Status |
| Shortcut | Group by: Epic / Iteration / Label |
| Monday | Groups (rows) + columns = swimlane-like structure |
| Plane | Module/cycle grouping |
| Trello | No swimlanes |
| Notion | Group by property = swimlane |

**Winner pattern:** "Group by" dropdown → generates horizontal row bands with label on left. Each band = one CDK drop list group. Drag within row = normal. Drag across rows = reassign the group property. "None" row catches unassigned items. Start with read-only swimlanes (no cross-row DnD), add cross-group DnD later.

### B7: Board-level Keyboard Shortcuts

| Product | Shortcuts |
|---------|-----------|
| Linear | N=new issue, F=filter, G+B=go to board, Cmd+K=command palette, ?=shortcut list |
| Trello | N=card, F=filter, S=subscribe, L=label, A=assign, D=due date — card-focused |
| ClickUp | S=search, B=board, ? = shortcuts modal |
| Asana | Tab+N=new, Tab+Q=quick add — limited |
| Jira | C=create, /=search, GG=go home |
| Height | Full keyboard nav — most comprehensive |
| Shortcut | C=create story, S=search, ?=shortcuts panel |
| Monday | Limited |
| Plane | Limited |
| Notion | /=commands, Cmd+K=search |

**Winner pattern:** `?` opens shortcuts modal, `Ctrl+K` = command palette, `N` = new task, `F` = focus filter, `C` = clear filters, `1-9` = scroll to column, `Esc` = close. Shortcut modal with categorized list. Already built: `board-shortcuts.service.ts`. Gap: column jump shortcuts (1-9), shortcut modal component.

### B8: Card Quick-Edit

| Product | Approach |
|---------|----------|
| Linear | Click title → inline edit; right-click context menu for priority/assignee/label |
| Trello | Click card title → edit in overlay; no field-level inline edit on card |
| ClickUp | Hover card → pencil icon → overlay editor for all fields |
| Jira | No inline edit on card (must open detail) |
| Asana | Click task name → inline title edit; assignee/due from popover |
| Height | Hover → quick-edit popover for all fields |
| Shortcut | Right-click → context menu with field edits |
| Monday | Click cell → inline edit (table-focused) |
| Plane | Hover → edit popover |
| Notion | Click to edit |

**Winner pattern:** (1) Title: single-click → inline text edit. (2) Other fields (assignee, due date, priority): hover → small popover with field picker. No new libraries — use Angular CDK Overlay for popovers. TaskBolt already has context menu + title inline edit — gap: date picker popover, assignee picker popover, priority picker on hover.

---

## PHASED IMPLEMENTATION PLAN

### Phase 1: Frontend-Only (No Backend Changes)

| Feature | Gaps to Fill | Files |
|---------|-------------|-------|
| B1 Polish | Add "expanded" card view showing description preview | `task-card.component.ts` |
| B3 Complete | Add "Overdue" filter chip; "Clear all" link; active filter chip styling | `board-toolbar.component.ts`, `board-state.service.ts` |
| B4 Persistence | Add "expanded" density mode; persist in localStorage via `effect()` | `task-card.component.ts`, `board-toolbar.component.ts` |
| B7 Complete | Add column jump shortcuts (1-9); add shortcut reference modal | `board-shortcuts.service.ts`, new `shortcuts-modal.component.ts` |
| B8 Quick-Edit | Date picker popover, assignee picker popover, priority picker on hover | `task-card.component.ts` |

### Phase 2: Trivial Backend Changes

| Feature | Backend Change | Migration |
|---------|---------------|-----------|
| B4 Server Persistence | Add `card_density` to `user_preferences` table | `20260303000001_card_density.sql` |
| B5 Column Icon | Add `icon VARCHAR(50)` to `board_columns` table | `20260303000002_column_icon.sql` |
| B5 UI | Column icon picker (emoji or preset icon set) in column header | `kanban-column.component.ts` |
| B2 Count Badge | Show task count badge in column header | `kanban-column.component.ts` (frontend only) |

### Phase 3: Feature Enhancement

| Feature | What to Build | Complexity |
|---------|--------------|------------|
| B2 Server Pagination | Add `?page=1&limit=20` to column tasks API with LIMIT/OFFSET | MEDIUM |
| B6 Swimlanes | "Group by" signal; swimlane rows with CDK cdkDropListGroup | HIGH |

---

## SQL MIGRATIONS (Phase 2)

```sql
-- 20260303000001_card_density.sql
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS card_density VARCHAR(20) DEFAULT 'comfortable';
```

```sql
-- 20260303000002_column_icon.sql
ALTER TABLE board_columns
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT NULL;
```

---

## PROJECT STRUCTURE

No new directories needed. Changes within existing structure:

```
frontend/src/app/features/board/
  board-view/
    board-view.component.ts         ← B6 swimlane template
    board-state.service.ts          ← B3 overdue filter, B4 density signal, B6 groupBy signal
    board-shortcuts.service.ts      ← B7 complete (1-9 column jump)
  board-toolbar/
    board-toolbar.component.ts      ← B3 Overdue chip + Clear all, B4 density toggle
  kanban-column/
    kanban-column.component.ts      ← B5 icon picker, B2 count badge
  task-card/
    task-card.component.ts          ← B1 expanded mode, B8 popovers
  board-settings/                   ← B5 icon/color management
  shortcuts-modal/                  ← NEW (B7 reference modal)
    shortcuts-modal.component.ts

backend/crates/db/src/migrations/
  20260303000001_card_density.sql   ← Phase 2
  20260303000002_column_icon.sql    ← Phase 2
```

---

## KEY PATTERNS

### Signal-based filter state (B3/B6)
```typescript
// board-state.service.ts
readonly activeFilters = signal<FilterSet>({
  myTasks: false,
  dueThisWeek: false,
  highPriority: false,
  overdue: false
});
readonly groupBy = signal<'none' | 'assignee' | 'priority' | 'label' | 'dueDate'>('none');

readonly filteredBoardState = computed(() => {
  const state = this.boardState();
  const filters = this.activeFilters();
  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  // ... filter logic
});
```

### localStorage persistence via effect() (B4)
```typescript
// board-state.service.ts
readonly cardDensity = signal<'compact' | 'comfortable' | 'expanded'>(
  (localStorage.getItem('tf_card_density') as any) ?? 'comfortable'
);

constructor() {
  effect(() => {
    localStorage.setItem('tf_card_density', this.cardDensity());
  });
}
```

### Swimlane group structure (B6)
```typescript
// CDK cross-group drag-drop
// board-view template:
// <div cdkDropListGroup>
//   @for (group of swimlaneGroups()) {
//     <div class="swimlane-row">
//       <div class="swimlane-label">{{ group.label }}</div>
//       @for (column of columns()) {
//         <div cdkDropList [cdkDropListData]="getGroupTasks(group.id, column.id)">
//           ...
```

### @ngneat/hotkeys for B7
```typescript
import { HotkeysService } from '@ngneat/hotkeys';

// board-shortcuts.service.ts
constructor(private hotkeys: HotkeysService) {
  this.hotkeys.addShortcut({ keys: 'n', description: 'New task', group: 'Board' })
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.openNewTask());

  for (let i = 1; i <= 9; i++) {
    this.hotkeys.addShortcut({ keys: String(i), description: `Jump to column ${i}`, group: 'Board' })
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.scrollToColumn(i - 1));
  }
}
```

### CDK Overlay for quick-edit popovers (B8)
```typescript
// No new library — Angular CDK Overlay already a dependency
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
```

### OnPush + computed signals (performance)
```typescript
// All board components: ChangeDetectionStrategy.OnPush
// All data from computed signals (never subscribe to observables in template)
// Pass signals into child components via input signals
```

---

## B1-B8 DONE-WHEN CRITERIA

| Feature | Done When |
|---------|-----------|
| B1 | All 3 density modes show correct card content; expanded mode shows first 80 chars of description; no layout overflow |
| B2 | Column header shows task count badge "(N)"; count updates when filters applied; "Show N more" still works |
| B3 | 4 quick filter pills visible (My Tasks, Due This Week, High Priority, Overdue); "Clear all" appears when any active; pills turn filled/teal when active |
| B4 | 3-way toggle in toolbar; selection persists on page reload; all 3 modes render without overflow |
| B5 | Color picker opens on column header click; icon picker (emoji) opens and saves; changes persist via API |
| B6 | "Group by" dropdown in toolbar with 4 options; swimlane rows render correctly; "None" catchall row shows for unassigned |
| B7 | All shortcuts from spec fire correctly; `?` opens modal listing all shortcuts; 1-9 scrolls to correct column |
| B8 | Title click = inline edit with save-on-blur; hover shows edit icons for assignee/date/priority; each popover opens and saves via API |

---

## SOURCES

### Competitor Analysis (UI inspection 2026-03-02)
- Linear: https://linear.app — kanban board, display settings, keyboard shortcuts
- ClickUp: https://help.clickup.com/hc/en-us/articles/6308751441687 — Board view docs
- Jira: https://support.atlassian.com/jira-software-cloud/docs/use-your-kanban-backlog/
- Trello: https://trello.com — board UI analysis
- Asana: https://asana.com/guide/help/views/board — Board view docs
- Height: https://height.app — board view analysis
- Shortcut: https://shortcut.com — board view analysis
- Plane: https://plane.so — open source, GitHub source analysis
- Monday.com: https://monday.com — board view analysis
- Notion: https://notion.so — board database view analysis

### Angular/CDK Libraries
- CDK Drag Drop: https://material.angular.io/cdk/drag-drop/overview
- CDK Overlay: https://material.angular.io/cdk/overlay/overview
- CDK DropListGroup: https://material.angular.io/cdk/drag-drop/api#CdkDropListGroup
- @ngneat/hotkeys v4.1.0: https://github.com/ngneat/hotkeys
- Angular Signals: https://angular.dev/guide/signals
- PrimeNG ColorPicker: https://primeng.org/colorpicker

### TaskBolt Codebase (key files analyzed)
- `frontend/src/app/features/board/task-card/task-card.component.ts` (858 lines)
- `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` (520 lines)
- `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` (638 lines)
- `frontend/src/app/features/board/board-view/board-state.service.ts`
- `frontend/src/app/features/board/board-view/board-shortcuts.service.ts`
- `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts`
- `backend/crates/db/src/models/board.rs`
- `backend/crates/db/src/models/subtask.rs`
- `backend/crates/api/src/routes/task_helpers.rs`
