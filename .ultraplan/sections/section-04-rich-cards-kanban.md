# Section 04: Rich Task Cards & Kanban Polish

> Project: TaskFlow World-Class Upgrade
> Batch: 1 | Tasks: 7 | Risk: YELLOW
> PRD Features: P0 - Rich Task Card Previews, Column Pagination, P1 - Quick Filter Buttons

---

## Overview

Transform the kanban board from functional to delightful. Task cards currently show minimal info. This section adds rich previews (priority badge, due date, assignee avatar, subtask progress, labels) to every card. Columns get pagination (show 20, click for more) to keep the board fast. Quick filter buttons at the top let users instantly filter by "My Tasks", "Due This Week", or "High Priority."

This is the most visually impactful section - it's what users see 90% of the time.

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | YELLOW |
| Summary | High visual impact with rendering performance concerns |

### Risk Factors
- Complexity: 2 (card redesign + pagination logic + filter state)
- Novelty: 1 (standard patterns)
- Dependencies: 1 (no external deps)
- Integration: 1 (internal)
- Data sensitivity: 1 (read-only display)
- **Total: 6** but bumped to YELLOW due to **performance sensitivity** (card re-renders on every drag)

### Mitigation
- Keep card component OnPush (already is)
- Use `trackBy` on `@for` loops
- Profile with Angular DevTools after card redesign
- Card data should be computed signals (not re-calculated on every render)

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| None | - | No hard dependencies |
| Blocks | Section 05 | Virtual scrolling builds on pagination pattern |

**Batch:** 1
**Parallel siblings:** Section 01, 02, 03

---

## TDD Test Stubs

1. `TaskCardComponent should render priority badge with correct color and label`
2. `TaskCardComponent should render due date with "overdue" styling when past due`
3. `TaskCardComponent should render assignee avatar from user data`
4. `TaskCardComponent should render subtask progress bar (e.g., "3/5 subtasks")`
5. `TaskCardComponent should render up to 3 label chips with overflow indicator`
6. `KanbanColumnComponent should show only first 20 tasks and a "Show N more" button`
7. `KanbanColumnComponent should load all tasks when "Show more" is clicked`
8. `BoardToolbarComponent should render quick filter buttons (My Tasks, Due This Week, High Priority)`
9. `BoardToolbarComponent should filter board tasks when a quick filter is active`

---

## Files Touched

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/features/board/board-view/task-card.component.ts` | MODIFY | Redesign card with rich preview elements |
| `frontend/src/app/features/board/board-view/kanban-column.component.ts` | MODIFY | Add pagination (show 20, "Show more") |
| `frontend/src/app/features/board/board-view/board-toolbar.component.ts` | MODIFY | Add quick filter buttons |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | MODIFY | Add filter state signals |
| `frontend/src/app/shared/components/priority-badge/priority-badge.component.ts` | MODIFY | Ensure badge works in card context |

---

## Tasks

### Task 1: Redesign Task Card with Rich Previews
**Files:** `task-card.component.ts`
**Steps:**
1. Add priority badge (colored dot or chip: Critical=red, High=orange, Medium=yellow, Low=green)
2. Add due date display (relative: "Today", "Tomorrow", "3 days ago") with overdue styling
3. Add assignee avatar (small circle, 24px, with initials fallback)
4. Add subtask progress (mini progress bar or "3/5" text)
5. Add label chips (show first 3, "+N more" for overflow)
6. Layout: title at top, metadata row below, labels at bottom
7. Keep card compact (don't make it too tall)
**Done when:** Card shows all metadata at a glance without opening the task

### Task 2: Card Performance Optimization
**Files:** `task-card.component.ts`
**Steps:**
1. Use `computed()` signals for derived values (isOverdue, subtaskProgress, visibleLabels)
2. Verify OnPush change detection is active
3. Minimize template expressions (pre-compute in component class)
4. Test with 50+ cards per column - should not lag during scroll
**Done when:** Card renders in under 1ms (measure with Angular DevTools Profiler)

### Task 3: Column Pagination
**Files:** `kanban-column.component.ts`
**Steps:**
1. Add `visibleCount` signal, default to 20
2. Only render first `visibleCount` tasks in the `@for` loop
3. Show "Show N more..." button at bottom of column when truncated
4. Clicking "Show more" increases `visibleCount` by 20 (or shows all)
5. Column header shows task count (e.g., "To Do (47)")
6. Drag-and-drop must work with paginated view (new tasks drop into correct position)
**Done when:** Columns with 50+ tasks show only 20 initially and expand on click

### Task 4: Column Task Count in Header
**Files:** `kanban-column.component.ts`
**Steps:**
1. Display total task count next to column name: "In Progress (12)"
2. Style: muted text, slightly smaller than column name
3. Update count reactively when tasks are added/removed/moved
**Done when:** Every column header shows accurate task count

### Task 5: Quick Filter Buttons
**Files:** `board-toolbar.component.ts`, `board-state.service.ts`
**Steps:**
1. Add filter buttons row below the view switcher: "My Tasks", "Due This Week", "High Priority"
2. Each button toggles a filter signal in BoardStateService
3. Multiple filters can be active simultaneously (AND logic)
4. Active filter shows filled/highlighted state
5. "Clear Filters" button appears when any filter is active
**Done when:** Clicking filters immediately reduces visible tasks to matching subset

### Task 6: Filter Logic Integration
**Files:** `board-state.service.ts`
**Steps:**
1. Add `activeFilters` signal (set of active filter IDs)
2. Add `filteredTasks` computed signal that applies active filters to column tasks
3. "My Tasks" filter: task.assigned_to === currentUser.id
4. "Due This Week" filter: task.due_date within current week
5. "High Priority" filter: task.priority in [Critical, High]
6. Board view reads `filteredTasks` instead of raw tasks when filters are active
**Done when:** Filtered view shows correct subset with smooth transitions

### Task 7: Empty Column State with Filters
**Files:** `kanban-column.component.ts`
**Steps:**
1. When a column has tasks but all are filtered out, show "No matching tasks" message
2. Don't hide the column entirely - keep the column visible with the empty message
3. Include "Clear Filters" link in the empty message
**Done when:** Filtered-out columns show helpful message instead of disappearing

---

## Section Completion Criteria

- [ ] Task cards show priority, due date, assignee, subtask progress, labels
- [ ] Cards are compact (not excessively tall)
- [ ] Columns paginate at 20 tasks with "Show more" button
- [ ] Column headers show task count
- [ ] Quick filter buttons work (My Tasks, Due This Week, High Priority)
- [ ] Multiple filters can be active simultaneously
- [ ] Performance: 50 cards per column renders without lag
- [ ] Drag-and-drop works with paginated columns
- [ ] Filtered-out columns show appropriate message

---

## Notes

### Recommended Paradigm
**Primary:** Reactive - Signals for filter state, computed for derived display values
**Secondary:** Declarative - Template-driven card layout
**Rationale:** Rich cards need reactive computed properties. Filter state is naturally reactive.

### Gotchas
- When column is paginated and user drags a task FROM a truncated position, the drop index calculation must account for the offset
- Quick filters should persist across view switches (kanban → list → kanban should keep filters)
- Priority badge colors must work in both light and dark mode
- Due date "overdue" styling should use a warm red (not aggressive) to match friendly mood
