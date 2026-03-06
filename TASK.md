# Upgrade Subtasks to First-Class Child Tasks — COMPLETE

## Objective
Add `parent_task_id` and `depth` to the `tasks` table, making subtasks first-class tasks. Migrate existing subtask data. Max depth: 2 levels (0=root, 1=subtask, 2=sub-subtask).

## Implementation Phases

### Phase 1: Database Migration
- [x] Create migration: `20260313000001_subtasks_to_child_tasks.sql`
- [x] Add `parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE`
- [x] Add `depth SMALLINT NOT NULL DEFAULT 0`
- [x] Create index + check constraint (depth 0-2)
- [x] Migrate existing subtask data → tasks table (3 subtasks migrated)
- [x] Migrate subtask assignees → task_assignees

### Phase 2: Backend Updates
- [x] Task struct: add `parent_task_id`, `depth` fields
- [x] Board queries: update LATERAL join, add parent filter, include `parent_task_id`
- [x] Board types: add `parent_task_id` to `TaskWithBadges`
- [x] Task queries: update all SELECT statements (12+ occurrences)
- [x] Task helpers: accept `parent_task_id` in CreateTaskRequest
- [x] Complete/uncomplete convenience endpoints
- [x] `list_child_tasks()` function added
- [x] Depth validation in `create_task()` (parent.depth + 1, max 2)

### Phase 3: Frontend Updates
- [x] Task interface: add `parent_task_id`, `depth`
- [x] TaskService: add `listChildren`, `createChild`, `completeTask`, `uncompleteTask`
- [x] SubtaskListComponent: overhaul to rich child task cards (priority dot, clickable title, avatars, due date)
- [x] Board view: backend filters root tasks only (parent_task_id IS NULL)
- [x] Task detail: parent breadcrumb ("Part of: <parent title>")
- [x] Task detail sidebar: "Part of" section with parent link

### Phase 4: Verification
- [x] `cargo check` + `cargo clippy` pass clean
- [x] `tsc --noEmit` passes clean
- [x] Production build succeeds

## Success Criteria
- [x] Migration runs: parent_task_id and depth exist on tasks table
- [x] Existing subtask data migrated correctly (3 of 6 — others had deleted parents)
- [x] cargo check + clippy pass
- [x] tsc --noEmit passes
- [x] Child tasks have full task properties (they ARE tasks)
- [x] Board shows only root tasks (WHERE parent_task_id IS NULL)
- [x] Task card subtask progress counts child tasks in done columns
- [x] SubtaskListComponent shows rich mini-cards
- [x] Clicking child task navigates to full task detail
- [x] Child task detail shows parent breadcrumb
- [x] Depth constraint enforced (DB CHECK + create_task validation)
- [x] Delete parent cascades to children (ON DELETE CASCADE)

## Progress Log
- [2026-03-06] Migration created and run — columns verified
- [2026-03-06] Backend complete — all models, queries, routes updated (backend-agent)
- [2026-03-06] Frontend complete — interfaces, services, components updated (frontend-agent)
- [2026-03-06] All checks pass: cargo check, clippy, tsc, prod build
