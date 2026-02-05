# Section 08: Team Overview & My Tasks

## Overview
Build the Team Overview dashboard where managers see each team member's workload at a glance, and the My Tasks page where individual users see all their assigned tasks across all boards. Task status is derived from the column's `statusMapping`. Backend: Rust Axum + SQLx. Frontend: Angular 19.

## Risk: [green]
## Dependencies
- Depends on: 04, 05, 07
- Blocks: 11
- Parallel batch: 4

## TDD Test Stubs
- Test: Team Overview shows correct task count per member
- Test: Team Overview highlights overloaded members (>= 10 active tasks)
- Test: My Tasks shows tasks from all boards user is a member of
- Test: My Tasks can be sorted by due date, priority, or board
- Test: Only Managers/Admins can access Team Overview
- Test: Status derived from column statusMapping, not tasks.status field
- Test: Progress bar does not divide by zero when totalTasks is 0
- Test: completedThisWeek tracked via activity_log, not updatedAt

## Tasks

<task type="auto" id="08-01">
  <name>Create team workload aggregation REST endpoint</name>
  <files>backend/crates/api/src/routes/team_overview.rs, backend/crates/db/src/queries/team_overview.rs</files>
  <action>Create `backend/crates/db/src/queries/team_overview.rs` with `get_workload(pool, workspace_id, tenant_id) -> Vec<MemberWorkload>`. Query joins workspace_members -> users -> tasks (WHERE deleted_at IS NULL) -> board_columns. For each member compute: user_id, user_name, user_avatar, total_tasks, active_tasks (tasks NOT in column where board_columns.status_mapping has {"done": true}), overdue_tasks (due_date < now() AND not in done column), tasks_by_status { active: N, done: N }. Guard division by zero: if total_tasks == 0, progress = 0. is_overloaded = active_tasks >= 10. Sort by active_tasks DESC. NOTE: Do NOT reference tasks.status or "archived". Use board_columns table (NOT columns).

Create `GET /api/workspaces/:workspace_id/team-workload` handler. Requires ManagerOrAdmin extractor. Returns Vec<MemberWorkload> as JSON.</action>
  <verify>Seed 3 members. Manager calls endpoint. Correct counts derived from column statusMapping. Zero-task member has progress 0.</verify>
  <done>Created team workload REST endpoint with column-derived status, overload detection, and zero-division guard.</done>
</task>

<task type="auto" id="08-02">
  <name>Build Angular Team Overview page with workload cards</name>
  <files>frontend/src/app/features/team/team-overview/team-overview.component.ts, frontend/src/app/features/team/member-workload-card/member-workload-card.component.ts</files>
  <action>Create team-overview.component.ts at route /workspace/:workspaceId/team. Calls GET /api/workspaces/:id/team-workload. Renders MemberWorkloadCards in responsive CSS grid (auto-fill, minmax(280px, 1fr)).

Create member-workload-card.component.ts. Each card shows: avatar + name, stat badges ("Active: N" blue, "Overdue: N" red if > 0, "Done: N" green), horizontal progress bar (active vs done, computed as `totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0`). If isOverloaded, pulsing orange border + "Overloaded" warning. Card links to filtered member view. Uses Tailwind for styling.</action>
  <verify>Cards show correct counts. Progress bars use column-derived status. Zero-task members show 0% without errors.</verify>
  <done>Built Team Overview with workload cards, column-derived status, and zero-division guards.</done>
</task>

<task type="auto" id="08-03">
  <name>Add overload banner and workspace WebSocket broadcasting</name>
  <files>frontend/src/app/features/team/overload-banner/overload-banner.component.ts, backend/crates/api/src/routes/task.rs</files>
  <action>Add GET /api/workspaces/:id/overloaded-members?threshold=10 endpoint (manager/admin). Returns lightweight array of overloaded members.

Create overload-banner.component.ts that fetches overloaded members. If count > 0, shows amber banner "Workload alert: N team members are overloaded" with "Review" button that smooth-scrolls to their cards.

Update task mutation handlers in task.rs to also call broadcast_service.broadcast_workspace_update(workspace_id, event, payload) after board updates. This enables Team Overview page to receive real-time updates via workspace:{workspaceId} WebSocket channel.</action>
  <verify>Two overloaded members trigger banner. Task mutations publish to workspace channel.</verify>
  <done>Added overload detection banner and workspace-level WebSocket broadcasting.</done>
</task>

<task type="auto" id="08-04">
  <name>Create My Tasks REST endpoints</name>
  <files>backend/crates/api/src/routes/my_tasks.rs, backend/crates/db/src/queries/my_tasks.rs</files>
  <action>Create queries/my_tasks.rs with:
- `list_my_tasks(pool, user_id, sort_by, sort_order, board_filter, cursor, limit)` -- all tasks where user is assignee across all boards user is member of (join board_members). WHERE deleted_at IS NULL. Join boards for board_name, board_id, workspace_id (needed for links like /workspace/{wid}/board/{bid}?task={tid}). Join board_columns for column_name and status_mapping. Return { items: Vec<MyTask>, next_cursor }.
- `my_tasks_summary(pool, user_id)` -- total_assigned, due_soon (48h), overdue (before now, not in done column), completed_this_week. For completed_this_week: query activity_log WHERE action = 'moved' AND destination column has status_mapping.done AND created_at within 7 days. Do NOT use task updated_at.

Create routes:
- `GET /api/my-tasks?sort_by=&sort_order=&board_id=&cursor=&limit=`
- `GET /api/my-tasks/summary`</action>
  <verify>Assign tasks across 2 boards. List includes workspace_id. Summary completed_this_week uses activity_log.</verify>
  <done>Created My Tasks endpoints with workspace_id in response and activity_log-based completion tracking.</done>
</task>

<task type="auto" id="08-05">
  <name>Build Angular My Tasks page</name>
  <files>frontend/src/app/features/my-tasks/my-tasks/my-tasks.component.ts, frontend/src/app/features/my-tasks/task-list-item/task-list-item.component.ts</files>
  <action>Create my-tasks.component.ts at route /my-tasks. Summary stat cards at top: "Total Assigned", "Due Soon" (amber), "Overdue" (red), "Completed This Week" (green). Board filter dropdown. Sort controls (Due Date, Priority, Board). Infinite scroll task list using cursor pagination.

Create task-list-item.component.ts. Each item links to /workspace/{workspaceId}/board/{boardId}?task={taskId}. Shows column-derived status badge (green "Done" if column statusMapping.done). Priority colored left border from task-colors.ts. Due date with conditional coloring (red overdue, amber today).</action>
  <verify>Stat cards correct. Items link with workspaceId. Status from column statusMapping.</verify>
  <done>Built My Tasks page with workspaceId links and column-derived status.</done>
</task>

<task type="auto" id="08-06">
  <name>Add real-time updates to both pages via WebSocket</name>
  <files>frontend/src/app/features/team/team-overview/team-overview.component.ts, frontend/src/app/features/my-tasks/my-tasks/my-tasks.component.ts</files>
  <action>In team-overview.component.ts: on init, subscribe to WebSocket channel workspace:{workspaceId}. On task events, re-fetch workload data. On destroy, unsubscribe.

In my-tasks.component.ts: on init, subscribe to WebSocket channel user:{userId}. On task events (assigned, moved, deleted), re-fetch task list and summary. On destroy, unsubscribe.

Ensure task mutation handlers in Rust publish to BOTH board, workspace, AND user channels (broadcast_board_update + broadcast_workspace_update + broadcast_user_update for each assignee).</action>
  <verify>Team Overview updates when task assigned in another tab. My Tasks updates when task assigned to you.</verify>
  <done>Created real-time hooks for Team Overview (workspace channel) and My Tasks (user channel).</done>
</task>
