# TASK: Unified Product Overhaul

## Current Phase: Phase 6 — Verify + Deploy

## Phases
- [x] Phase 0: Setup worktree
- [x] Phase 1: Visual Foundation — tokens, Card/Badge/TaskCard components, dark:bg-gray sweep (14 files), anti-slop stat cards, focus rings. Build verified.
- [x] Phase 2: Schema + Backend — 1 migration (7 schema changes), 6 query modules, 5 route handlers, 12 new API endpoints. cargo check + clippy clean.
- [x] Phase 3: Route Refactor — workspace-scoped routes, redirect guard, sidebar restructure, 11 files updated for navigation. tsc + ng build clean.
- [x] Phase 4A: View Features — table view, saved views service, view switcher, all-tasks component.
- [x] Phase 4B: My Work Hub — shell + timeline + matrix + board + batch actions.
- [x] Phase 4.5: Color System Integration — color-by-X (priority/project/assignee/label), dark-mode hex maps, hex validation, label presets, 4px left stripe on cards, display popover Color By section. 154 tests passing.
- [x] Phase 5: Cleanup + Polish — deleted legacy my-tasks/ (12 files), fixed eisenhower route redirect, enhanced empty states.
- [ ] Phase 6: Verify + Deploy

## Progress Log
- 2026-03-18 23:18: Worktree created at ../taskflow-unified on branch feat/unified-overhaul
- 2026-03-18 23:29: Phase 1 DONE (11 min, 101 tool uses, 14 files + 3 new components)
- 2026-03-18 23:32: Phase 2 DONE (14.5 min, 74 tool uses, 11 new files + 4 modified)
- 2026-03-18 23:40: Phase 3 DONE (8.4 min, 120 tool uses, 27 files modified + 2 new)
- 2026-03-18 23:41: Phase 4A + 4B launched in parallel
- 2026-03-19: Phase 4.5 Color System Integration DONE — TDD workflow, 3 review passes (CEO/eng/design)
- 2026-03-19: Phase 5 Cleanup DONE — legacy code removed, routes fixed, empty states enhanced

## Phase 4.5 Summary (Color System)
**Files changed:** 12 | **Tests added:** 50+ | **Lines deleted:** ~12 legacy files

Key deliverables:
- `resolveCardColor()` — SSOT for card color resolution (4 modes)
- `PRIORITY_COLORS_HEX_DARK` — dark-mode priority hex map
- `COLUMN_HEADER_COLORS_DARK` — dark-mode column header colors
- `getColumnHeaderColor(index, isDark?)` — theme-aware column colors
- `validate_hex_color()` — backend hex validation (prevents CSS injection)
- Color By section in Display Popover (priority/project/assignee/label pills)
- Signal chain: ProjectStateService → toolbar → popover → kanban board → columns → task cards
- 4px left stripe on kanban cards + list view rows (200ms transition, prefers-reduced-motion)
- `LABEL_PRESET_COLORS` — unified 12-color palette for label picker
- Workspace labels component uses shared presets

## Deferred Items
- Subtask table/route removal (requires data migration verification — one-way door)
- Persist color_by to saved_views DB (currently localStorage, consistent with density/groupBy)
- styles.css split into 4 files (TODO-012 in TODOS.md)
