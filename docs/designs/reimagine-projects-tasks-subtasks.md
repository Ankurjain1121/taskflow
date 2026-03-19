# Reimagine Projects, Tasks, and Subtasks

**Status:** ACTIVE
**Generated:** 2026-03-18 | **Mode:** SCOPE EXPANSION
**Branch:** master | **Review:** CEO Plan Review

## Problem Statement

TaskFlow's core entities are under-realized:
- **Projects** are named folders (name + description) with no lifecycle, dates, or health metrics
- **Tasks** are feature-rich individually but flat in all views — hierarchy is invisible
- **Subtasks** are in migration limbo (dual API) and rendered as checkbox lists, not full tasks

## Vision

Transform TaskFlow from "basic tracker" to "serious PM tool":
- Projects become **living entities** with status lifecycle, milestones, and overview pages
- Tasks form **visible trees** in all views with dependency tracking
- Child tasks are **first-class citizens** — same card/row treatment as root tasks

## Key Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Implementation approach | Full Reimagine (projects + hierarchy + cleanup) | Completeness costs minutes with CC |
| 2 | Task nesting depth | 5 levels (up from 2) | Covers complex breakdowns; two-way door |
| 3 | Project status lifecycle | 5 states: Planning → Active → On Hold → Completed → Archived | Full lifecycle with pause support |
| 4 | Cross-project dependencies | Allowed (within workspace) | Portfolio-level dependency tracking |
| 5 | Parent completion behavior | Warn modal with choices (complete all / cancel remaining / go back) | User control without rigidity |
| 6 | Child count strategy | Materialized on-write (DB triggers) | Optimize for reads (100x more frequent) |
| 7 | Subtask rendering | Full task cards (not checkbox lists) | User requirement — subtasks ARE tasks |
| 8 | Template format | JSONB blob in project_templates table | Read-heavy, write-rare; simpler than normalized |

## Eng Review Findings (2026-03-18)

**Major scope recalibration:** ~50% of originally proposed features already exist in the codebase:
- Milestones: backend model + API + frontend service + UI component
- Task Dependencies: backend model + API routes + frontend service (Blocks/BlockedBy/Related)
- Project Templates: backend model + API (create, instantiate, save-as) + frontend service + UI
- Bulk Operations: frontend components (bulk-actions-bar, bulk-preview-dialog, undo-toast)
- Breadcrumbs: shared component exists, needs wiring for task hierarchy
- Task Numbers: field exists on task-card, needs extension to all views

## Accepted Scope

### Already Exists (no work needed)
- Milestones (backend + frontend + UI) — `milestone.rs`, `milestone.service.ts`, `milestone-list/`
- Task Dependencies (backend + frontend) — `dependency.rs`, `dependency.service.ts`
- Project Templates (backend + frontend + UI) — `project_template.rs`, `project-template.service.ts`
- Bulk Operations (frontend) — `bulk-actions-bar/`, `bulk-preview-dialog/`, `undo-toast`
- Breadcrumbs component — `shared/components/breadcrumbs/`

### Needs Building

**Backend (Schema + Logic):**
1. Migration: ALTER projects ADD status, start_date, target_date
2. Migration: ALTER tasks ADD child_count, completed_child_count + DB trigger
3. Migration: ALTER tasks CHECK depth <= 5 (up from 2)
4. Conflict detection logic (date mismatches, cycle detection enhancement)
5. GET /projects/:id/overview endpoint (aggregate project data)
6. Legacy subtask table DROP (after verification)
7. Remove legacy subtask API routes

**Frontend (UI Enhancements):**
8. Project overview page (NEW component)
9. Subtask-list rewrite: checkbox list → full task cards (REWRITE)
10. List view: tree indentation + expand/collapse (ENHANCE)
11. Kanban cards: progress donut + inline "+" (ENHANCE task-card)
12. Task detail: wire breadcrumbs for task hierarchy (ENHANCE)
13. Keyboard shortcuts: Tab/Shift+Tab in list view (NEW)
14. Task number display: PROJ-123 everywhere (ENHANCE)
15. Conflict warning badges (NEW)
16. Parent completion modal with choices (NEW)

## Schema Changes

### Altered Tables
- `projects`: +status (TEXT, CHECK IN planning/active/on_hold/completed/archived), +start_date, +target_date
- `tasks`: depth CHECK updated to <= 5; +child_count (INT DEFAULT 0), +completed_child_count (INT DEFAULT 0)
- `tasks`: new trigger `update_child_counts()` on INSERT/DELETE/UPDATE of child tasks

### Dropped Tables
- `subtasks` (after verifying 100% data migration — irreversible)

### No New Tables Needed
- milestones, task_dependencies, project_templates already exist

## Architecture

### New API Endpoints
- GET /projects/:id/overview (aggregated project health data)
- Conflict detection runs as part of task save validation

### Enhanced Endpoints
- PATCH /projects/:id (now accepts status, start_date, target_date)
- GET /projects/:id/tasks (tree query via recursive CTE)
- PATCH /tasks/:id (reparent via parent_task_id update — Tab/Shift+Tab)

### Frontend Components
- Project overview page (NEW)
- Subtask-list: full task cards with task-card component (REWRITE)
- List view: tree indentation + keyboard handlers (ENHANCE)
- Task card: progress donut + inline "+" button (ENHANCE)
- Task detail: breadcrumb wiring for hierarchy (ENHANCE)
- Conflict warning badge component (NEW)
- Parent completion modal (NEW)

## Implementation Phases

### Phase 1: Schema + Backend (~30 min CC)
- Migration: project lifecycle columns
- Migration: child count columns + trigger
- Migration: depth constraint increase
- Project overview endpoint
- Conflict detection logic
- Backfill child_count from existing data

### Phase 2: Frontend — Project + Hierarchy (~45 min CC)
- Project overview page with status, milestones, health
- Subtask-list rewrite (full task cards)
- List view tree indentation + expand/collapse
- Kanban card progress donut + inline "+"
- Task detail breadcrumbs for hierarchy
- Task number display (PROJ-123) everywhere

### Phase 3: Frontend — Interactions (~30 min CC)
- Tab/Shift+Tab keyboard shortcuts in list view
- Conflict warning badges
- Parent completion modal
- Enhance bulk operations for hierarchy awareness

### Phase 4: Cleanup + Deploy (~15 min CC)
- Verify subtask migration completeness
- Drop legacy subtask table
- Remove legacy subtask API routes + frontend service
- Deploy: backend first, then frontend

## Deployment Strategy
- All schema changes are additive (safe, zero-downtime) except subtask table drop
- Subtask table drop requires: verify 0 unmigrated rows, audit log, explicit step
- Deploy order: backend first, then frontend
- Rollback: DROP new tables/columns (except subtask drop = irreversible)

## Not In Scope
- Gantt chart dependency arrows (Phase 2 — needs Gantt refactor)
- Portfolio dashboard across workspaces (Phase 2)
- AI task decomposition suggestions (Phase 3)
- Dependency-triggered automations (Phase 3)
- Infinite nesting beyond depth=5

## Critical Risks
1. Recursive CTE with circular parent_task_id — add CYCLE clause to prevent infinite loops
2. Subtask migration data loss — migration must verify 0 unmigrated rows before DROP
3. Cycle detection DoS — circuit breaker at 1000 nodes

## Success Criteria
- [ ] Projects show status lifecycle with 5 states
- [ ] Project overview page shows milestones, health, team
- [ ] Task tree visible in list view with indentation
- [ ] Kanban cards show progress donut for parent tasks
- [ ] Tab/Shift+Tab indents/outdents tasks in list view
- [ ] Dependencies (blocks/blocked-by) create-able and visible
- [ ] Cross-project dependencies work within workspace
- [ ] Conflict warnings appear for date mismatches
- [ ] Batch operations work with hierarchy awareness
- [ ] PROJ-123 task numbers displayed everywhere
- [ ] Child tasks render as full task cards (not checkboxes)
- [ ] Legacy subtasks table removed
- [ ] Project templates with subtask blueprints functional
- [ ] Milestones trackable per project
- [ ] No performance regression on board/list views
