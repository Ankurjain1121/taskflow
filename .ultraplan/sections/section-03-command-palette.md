# Section 03: Command Palette

> Project: TaskFlow World-Class Upgrade
> Batch: 1 | Tasks: 5 | Risk: GREEN
> PRD Features: P0 - Command Palette

---

## Overview

Add a Ctrl+K / Cmd+K command palette using `@ngxpert/cmdk`. This becomes the fastest way to navigate TaskFlow - jump to any board, task, or action in under 100ms. The palette searches across boards, tasks, recent items, and available actions.

TaskFlow already has a global search component (`global-search.component.ts`). This section enhances it into a full command palette that handles both search and actions.

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | GREEN |
| Summary | New library integration with well-documented API |

### Risk Factors
- Complexity: 2 (search indexing + action routing)
- Novelty: 2 (new library @ngxpert/cmdk)
- Dependencies: 1 (no dependencies)
- Integration: 1 (internal only)
- Data sensitivity: 1 (read-only search)
- **Total: 7 → GREEN**

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| None | - | No hard dependencies |
| Soft | Section 02 | Top bar search trigger invokes the palette |

**Batch:** 1
**Parallel siblings:** Section 01, 02, 04

---

## TDD Test Stubs

1. `CommandPaletteComponent should open when Ctrl+K is pressed`
2. `CommandPaletteComponent should close when Escape is pressed`
3. `CommandPaletteComponent should search boards by name and show results`
4. `CommandPaletteComponent should search tasks by title and show results`
5. `CommandPaletteComponent should navigate to selected board on Enter`
6. `CommandPaletteComponent should show action items (New Task, New Board, Settings)`
7. `CommandPaletteComponent should show recent items when opened with empty query`

---

## Files Touched

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/shared/components/command-palette/command-palette.component.ts` | CREATE | Command palette component using @ngxpert/cmdk |
| `frontend/src/app/core/services/command-palette.service.ts` | CREATE | Service that aggregates searchable items |
| `frontend/src/app/shared/components/layout/layout.component.ts` | MODIFY | Register global Ctrl+K listener |
| `frontend/package.json` | MODIFY | Add @ngxpert/cmdk dependency |

---

## Tasks

### Task 1: Install and Configure @ngxpert/cmdk
**Steps:**
1. `npm install @ngxpert/cmdk`
2. Import `CmdkModule` in command palette component
3. Verify Angular CDK peer dependency is met (already installed for DnD)
**Done when:** Library imports without errors

### Task 2: Create Command Palette Component
**Files:** `command-palette.component.ts`
**Steps:**
1. Create standalone component with `<cmdk-command>` as root
2. Add `<cmdk-input>` for search, `<cmdk-list>` for results
3. Group results: Recent, Boards, Tasks, Actions
4. Style with Tailwind (rounded modal, backdrop blur, clean list items)
5. Wrap in PrimeNG Dialog for overlay behavior
**Done when:** Palette renders with grouped placeholder items

### Task 3: Create Command Palette Service
**Files:** `command-palette.service.ts`
**Steps:**
1. Aggregate searchable items: boards (from workspace state), recent tasks, actions
2. Actions list: "New Task", "New Board", "Go to Dashboard", "Go to My Tasks", "Settings"
3. Search function that filters items by query string
4. Return results with icon, title, subtitle, and navigation route
**Done when:** Service returns filtered results for any query string

### Task 4: Wire Global Keyboard Shortcut
**Files:** `layout.component.ts`
**Steps:**
1. Add `@HostListener('document:keydown')` for Ctrl+K / Cmd+K
2. Prevent default browser behavior (Cmd+K = focus address bar)
3. Toggle command palette visibility signal
4. Close on Escape or clicking outside
**Done when:** Ctrl+K opens palette, Escape closes it, from any page

### Task 5: Connect to Search API
**Files:** `command-palette.service.ts`
**Steps:**
1. For board search: use workspace state (already in memory, instant)
2. For task search: debounce 200ms, then call existing `GET /search` endpoint
3. Show loading indicator during API search
4. Cache recent searches for instant recall
5. Show recent items when palette opens with empty query
**Done when:** Typing a query shows real search results from boards + tasks + actions

---

## Section Completion Criteria

- [ ] Ctrl+K / Cmd+K opens command palette from any page
- [ ] Escape or backdrop click closes it
- [ ] Typing shows filtered results in under 100ms (boards) / 300ms (tasks)
- [ ] Selecting a result navigates to the correct page
- [ ] Actions ("New Task", "Settings") execute correctly
- [ ] Recent items show when palette opens with no query
- [ ] Styled consistently with TaskFlow's clean & friendly mood

---

## Notes

### Recommended Paradigm
**Primary:** Reactive - Signal-based search state with debounced API calls
**Secondary:** Declarative - cmdk template composition
**Rationale:** Search is inherently reactive (user types → results update). cmdk handles the DOM, we handle the data.

### Gotchas
- @ngxpert/cmdk is unstyled by default - ALL styling must come from Tailwind
- The existing `global-search.component.ts` can potentially be replaced or refactored to use cmdk under the hood
- Prevent Ctrl+K when user is in a rich text editor (TipTap) to avoid conflicts
