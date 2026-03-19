# My Work Hub — Design Document

Generated from CEO Plan Review on 2026-03-18 | Mode: SCOPE EXPANSION

## Problem Statement

TaskFlow has two disconnected personal task pages: /my-tasks (flat timeline list, 584-line component) and /eisenhower (separate drag-drop matrix, 737-line component). The new sidebar links to "My Work" as a primary nav item, but the destination feels dated compared to the freshly reimagined dashboard and sidebar. Two separate task card components (467 lines combined) create DRY violations.

## Solution: Unified My Work Hub

Merge both pages into a single /my-work route with three tabbed views sharing one actionable task card component.

### Tabs
1. **Timeline** — Tasks grouped by urgency (overdue, today, this week, etc.) — WHEN to do things
2. **Matrix** — Eisenhower 2x2 drag-drop grid — HOW to prioritize
3. **Board** — Personal kanban (Backlog → Today → In Progress → Done) — WORKFLOW planning

### Key Decisions
- Routes: /my-tasks → redirect → /my-work?tab=timeline, /eisenhower → redirect → /my-work?tab=matrix
- Personal kanban storage: PostgreSQL (syncs across devices)
- Snooze: DB-backed, hidden until next calendar day
- Old components: Delete all 4 (~1,679 lines removed)
- Personal board "Done" column ≠ task completion. Complete button = real project action.

## Accepted Scope (8 expansions)

| # | Feature | Effort | Description |
|---|---------|--------|-------------|
| 1 | Personal Kanban Board Tab | M | 4 columns, drag-drop, DB-backed personal assignments |
| 2 | Momentum Indicator + Smart Summary Bar | S | Time-aware greeting + circular progress ring |
| 3 | Keyboard-First Power Mode | S | J/K navigate, Space complete, S snooze, 1/2/3 tabs |
| 4 | Unified Actionable Task Card | M | One card for all tabs: complete, snooze, priority, assign |
| 5 | Batch Operations | M | Multi-select + floating action bar for bulk actions |
| 6 | Delightful Empty & Completion States | S | Encouraging empty states + celebration on all-done |
| 7 | Filter Persistence + Smart Tab Default | S | localStorage for prefs, smart first-visit tab |
| 8 | Eisenhower Coaching Hints | S | Dynamic hints based on quadrant size and staleness |

## Architecture

### Component Hierarchy
```
my-work-shell.component.ts (<200 lines)
├── smart-summary-bar.component.ts (~120 lines)
│   └── progress-ring.component.ts (~60 lines)
├── Tab: my-work-timeline.component.ts (~350 lines)
├── Tab: my-work-matrix.component.ts (~350 lines)
├── Tab: my-work-board.component.ts (~300 lines)
├── Shared
│   ├── actionable-task-card.component.ts (~250 lines)
│   ├── batch-action-bar.component.ts (~120 lines)
│   └── keyboard-hint-bar.component.ts (~80 lines)
└── Services
    ├── my-tasks.service.ts (extended)
    ├── eisenhower.service.ts (reused)
    └── my-work-state.service.ts (new, localStorage persistence)
```

### Backend Changes
- New: POST /api/my-tasks/batch (bulk update, max 50 tasks)
- New: GET /api/my-work/board (personal kanban state)
- New: PUT /api/my-work/board/{id} (move task to column)
- New: POST /api/my-tasks/{id}/snooze (snooze until tomorrow)
- New: DELETE /api/my-tasks/{id}/snooze (unsnooze)
- Existing: /api/my-tasks, /api/my-tasks/summary, /api/eisenhower (reused)

### New DB Tables
- personal_task_board (user_id, task_id, column, updated_at) — UNIQUE(user_id, task_id)
- task_snoozes (user_id, task_id, snoozed_until, created_at) — UNIQUE(user_id, task_id)

## Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ MY WORK                                                          │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Smart Summary Bar (contextual greeting + progress ring)    │   │
│ │ "Good afternoon! 7 of 12 tasks done today"  [████░░ 58%]  │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ [Timeline] [Matrix] [Board]   │ WS: ▼ │ Board: ▼ │ ⌘?    │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │                                                            │   │
│ │  ACTIVE TAB CONTENT with ActionableTaskCards               │   │
│ │                                                            │   │
│ │  [Batch Action Bar — appears when 2+ selected]             │   │
│ │  ┌─ 3 selected: [✓ Complete] [→ Reassign] [▲ Priority] ─┐ │   │
│ └───────────────────────────────────────────────────────────┘   │
│ ┌─ Keyboard Hint Bar (dismissible) ───────────────────────┐     │
│ │ J↓ K↑ navigate  Space complete  S snooze  1/2/3 tabs     │    │
│ └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Net Impact
- ~1,679 lines deleted (4 old components)
- ~1,800 lines new (10 new components + 2 services)
- Net: ~600 line reduction with significantly more functionality
