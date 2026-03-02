# Section 09: Visual Polish & Animations

> Project: TaskFlow World-Class Upgrade
> Batch: 3 | Tasks: 5 | Risk: GREEN
> PRD Features: P2 - Animations, Board Backgrounds, Column WIP Limits, Keyboard Shortcuts

---

## Overview

The final polish pass that elevates TaskFlow from "good" to "world-class." Subtle animations make every interaction feel alive. Board backgrounds let users personalize their workspace. Column WIP limits add visual work-in-progress management. Essential keyboard shortcuts speed up power users.

This section is deliberately last because polish should happen AFTER all layout and feature changes are stable.

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | GREEN |
| Summary | Cosmetic improvements with no structural risk |

### Risk Factors
- Complexity: 1 (CSS transitions, simple logic)
- Novelty: 1 (standard patterns)
- Dependencies: 2 (needs stable layout from Sections 01, 02, 04)
- Integration: 1 (internal only)
- Data sensitivity: 1 (visual only)
- **Total: 6 → GREEN**

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| Depends on | Section 01 | Board settings tabs must be stable |
| Depends on | Section 02 | Top nav bar layout must be finalized |
| Depends on | Section 04 | Card design must be finalized |

**Batch:** 3

---

## TDD Test Stubs

1. `Route transitions should use Angular View Transitions API when supported`
2. `BoardBackgroundComponent should apply selected background to board view`
3. `ColumnComponent should show WIP warning when task count exceeds limit`
4. `KeyboardShortcutService should register N key for new task creation`
5. `KeyboardShortcutService should NOT trigger shortcuts when user is typing in an input`

---

## Tasks

### Task 1: Route Transition Animations
**Steps:**
1. Add `withViewTransitions()` to router config (graceful degradation for non-Chrome)
2. Add CSS transition styles for page elements: fade-in for content, slide for panels
3. Card hover: subtle lift effect (translateY + shadow increase)
4. Task completion: brief celebration animation (checkmark + subtle confetti)
5. Drag-and-drop: smooth card movement with 150ms ease-out
**Done when:** Navigation and interactions feel smooth and alive

### Task 2: Board Backgrounds
**Files:** board-view component, board-settings general tab, board.service.ts
**Steps:**
1. Add `background_image` and `background_color` fields to board model (migration if needed)
2. Add background picker in board settings General tab
3. Provide 8-10 preset backgrounds (gradients, patterns, photos)
4. Allow solid color selection
5. Apply background to board view container (behind columns, with overlay for readability)
**Done when:** Users can set custom backgrounds per board

### Task 3: Column WIP Limits
**Files:** kanban-column.component, column management in board-settings
**Steps:**
1. Add `wip_limit` field to column model (nullable integer, migration if needed)
2. Add WIP limit input in column settings (board settings Columns tab)
3. Column header shows "In Progress (3/5)" when WIP limit is set
4. Visual warning: column header turns amber/orange when at limit, red when over
5. Do NOT block adding tasks over limit (just visual warning)
**Done when:** Columns show WIP status with color-coded warnings

### Task 4: Essential Keyboard Shortcuts
**Files:** `keyboard-shortcuts.service.ts` (already exists)
**Steps:**
1. Register shortcuts: N (new task), Ctrl+K (command palette), ? (shortcut help)
2. Register shortcuts: arrow keys (navigate between cards), Enter (open selected card)
3. Register shortcuts: Escape (close modal/panel), B (switch to board view)
4. Guard: disable all shortcuts when focus is in input/textarea/contenteditable
5. Show shortcut hints in the shortcut help modal (already exists)
**Done when:** 8-10 keyboard shortcuts work globally with proper input guarding

### Task 5: PrimeNG Theme Polish
**Files:** theme.service.ts, global styles
**Steps:**
1. Adjust PrimeNG `definePreset()` for warmer, friendlier look:
   - Increase `borderRadius` to 10-12px (from default ~6px)
   - Soften shadows (use warm-toned shadows, not pure gray)
   - Increase dialog padding for breathing room
2. Ensure task card corners match the friendly mood (rounded-xl)
3. Review all PrimeNG Dialog/Drawer/Menu instances for consistent styling
4. Verify dark mode colors are warm (not cold blue-gray)
**Done when:** Every PrimeNG component feels warm, friendly, and consistent

---

## Section Completion Criteria

- [ ] Page transitions are smooth (fade-in, no jarring jumps)
- [ ] Card hover and completion have satisfying animations
- [ ] Board backgrounds can be set per board
- [ ] Column WIP limits show visual warnings
- [ ] 8-10 keyboard shortcuts work correctly
- [ ] Shortcuts don't fire when typing in inputs
- [ ] PrimeNG theme is warm and friendly across light and dark mode
