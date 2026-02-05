# Section 04: Task CRUD & Kanban Board

## Overview
Build the core Kanban board with colorful task cards, drag-and-drop between columns using Angular CDK, task creation/editing, and the Monday.com-style bright color system for priority. Task status is derived from the column's `statusMapping` -- there is no status column on tasks. Real-time sync via Axum WebSocket + Redis pub/sub.

## Risk: [yellow] - Drag-and-drop with real-time sync and optimistic updates is complex

## Dependencies
- Depends on: 01, 02
- Blocks: 05, 06, 07, 08, 10, 11
- Parallel batch: 2

## TDD Test Stubs
- Test: User can create a task with title, description, priority, and due date
- Test: User can assign a task to one or more team members
- Test: Drag-and-drop moves task between columns and persists the new position
- Test: Task cards display correct colors based on priority
- Test: Optimistic update shows card in new position immediately before server confirms
- Test: Multiple users see board updates in real-time via WebSocket
- Test: User must be a board member to see tasks
- Test: Task queries filter out soft-deleted tasks (deleted_at IS NULL)

## Tasks

<task type="auto" id="04-01">
  <name>Create Rust REST endpoints for task CRUD</name>
  <files>backend/crates/api/src/routes/task.rs, backend/crates/db/src/queries/tasks.rs, backend/crates/db/src/models/task.rs</files>
  <action>Create `backend/crates/db/src/models/task.rs` with Rust structs: `Task` (id, title, description, priority, due_date, board_id, column_id, position, tenant_id, created_by_id, deleted_at, created_at, updated_at), `TaskWithDetails` (extends Task with assignees Vec, labels Vec, comments_count, attachments_count), `CreateTaskInput`, `UpdateTaskInput`, `MoveTaskInput { task_id, target_column_id, after_id: Option, before_id: Option }`. Derive `sqlx::FromRow`, `Serialize`, `Deserialize` on all.

Create `backend/crates/db/src/queries/tasks.rs` with SQLx functions:
- `list_tasks_by_board(pool, board_id, user_id)` -- MUST first verify user is board member via board_members (return Forbidden if not). Select tasks WHERE deleted_at IS NULL, join task_assignees+users for assignee info, join task_labels+labels, ORDER BY column_id, position ASC. Return grouped by column_id as HashMap&lt;Uuid, Vec&lt;Task&gt;&gt;.
- `get_task_by_id(pool, id)` -- fetch single task with assignees, labels, comments_count, attachments_count. Verify board membership.
- `create_task(tx, input, tenant_id, created_by_id)` -- calculate position using last position in target column (query MAX position, then generate next key). Insert task with NO status field. If assignee_ids provided, bulk insert task_assignees. Log to activity_log. Return created task.
- `update_task(tx, id, input)` -- update only provided fields, set updated_at. Log changes in activity_log metadata (old/new values).
- `soft_delete_task(tx, id)` -- set deleted_at = now(). Log to activity_log.
- `move_task(tx, task_id, target_column_id, new_position)` -- update column_id and position. Log move with old/new column info.
- `assign_user(tx, task_id, user_id)` -- insert task_assignees row. Log.
- `unassign_user(tx, task_id, user_id)` -- delete task_assignees row. Log.

Create `backend/crates/api/src/routes/task.rs` with Axum handlers:
- `GET /api/boards/:board_id/tasks` -> list_tasks_by_board
- `GET /api/tasks/:id` -> get_task_by_id
- `POST /api/boards/:board_id/tasks` (requires TaskCreate + board membership)
- `PUT /api/tasks/:id` (requires TaskUpdate)
- `DELETE /api/tasks/:id` (soft delete, requires TaskDelete)
- `POST /api/tasks/:id/move` (requires TaskUpdate)
- `POST /api/tasks/:id/assignees` (requires TaskAssign)
- `DELETE /api/tasks/:id/assignees/:user_id` (requires TaskAssign)

All handlers use `with_tenant()` for RLS. All mutations call the WebSocket broadcast service (task 04-02).</action>
  <verify>Creating a task returns it with a fractional position. Moving updates column_id and position. Listing returns tasks grouped by column. Non-board-members get 403. Soft-deleted tasks excluded.</verify>
  <done>Created Rust task REST endpoints with CRUD, move, assign/unassign. No status field. Fractional indexing positions. All mutations broadcast real-time updates.</done>
</task>

<task type="auto" id="04-02">
  <name>Create WebSocket broadcast service with Redis pub/sub</name>
  <files>backend/crates/api/src/ws/mod.rs, backend/crates/api/src/ws/broadcast.rs, backend/crates/api/src/ws/handler.rs, backend/crates/services/src/broadcast.rs</files>
  <action>Create `backend/crates/services/src/broadcast.rs` that exports a `BroadcastService` struct holding a `redis::Client`. Implement methods:
- `broadcast_board_update(board_id: Uuid, event: &str, data: serde_json::Value)` -- publishes to Redis channel `board:{board_id}` with JSON payload `{ "event": event, "data": data }`. Events: "task:created", "task:updated", "task:moved", "task:deleted", "comment:created".
- `broadcast_workspace_update(workspace_id: Uuid, event: &str, data: Value)` -- publishes to `workspace:{workspace_id}`.
- `broadcast_user_update(user_id: Uuid, event: &str, data: Value)` -- publishes to `user:{user_id}`.

Create `backend/crates/api/src/ws/handler.rs` with an Axum WebSocket upgrade handler at `GET /api/ws`. The handler: extracts JWT from query param `?token=<jwt>` (WebSocket can't use Authorization header), validates the token, upgrades to WebSocket. After upgrade, the connection subscribes to Redis channels based on messages from the client. Client sends JSON subscribe messages: `{ "action": "subscribe", "channel": "board:uuid" }`. Server uses `redis::aio::PubSub` to subscribe and forward messages to the WebSocket. On disconnect, clean up subscriptions. Use `tokio::select!` to handle both WebSocket incoming messages and Redis pub/sub messages concurrently.

Add `BroadcastService` to `AppState` so route handlers can call it after mutations.</action>
  <verify>Two WebSocket clients subscribed to the same board channel. When a task is created via REST, both clients receive the event within 1-2 seconds.</verify>
  <done>Created WebSocket broadcast service with Redis pub/sub for board, workspace, and user channels with JWT-authenticated WS connections.</done>
</task>

<task type="auto" id="04-03">
  <name>Build Angular Kanban board with CDK DragDrop</name>
  <files>frontend/src/app/features/board/board-view/board-view.component.ts, frontend/src/app/features/board/kanban-column/kanban-column.component.ts, frontend/src/app/core/services/task.service.ts</files>
  <action>Create `task.service.ts` with methods: `listByBoard(boardId): Observable<Record<string, Task[]>>`, `create(boardId, data)`, `update(id, data)`, `delete(id)`, `move(taskId, targetColumnId, afterId, beforeId)`, `assignUser(taskId, userId)`, `unassignUser(taskId, userId)`.

Create `board-view.component.ts` as standalone component at route `/workspace/:workspaceId/board/:boardId`. Fetch columns and tasks. Render header with board name + "New Task" button. Render columns horizontally in a `cdkDropListGroup`. Each column is a `kanban-column` component.

Create `kanban-column.component.ts` receiving column data and tasks array as inputs. Uses `cdkDropList` with `[cdkDropListData]="tasks"` and `[cdkDropListConnectedTo]` linking to all other columns. Each task card inside uses `cdkDrag`. Handle `cdkDropListDropped` event: if same container, reorder; if different container, cross-column move. Calculate new position using `generateKeyBetween(afterPosition, beforePosition)` from the `fractional-indexing` npm package. Call `taskService.move()`. The column header shows column name with colored dot (from column.color), task count badge, and checkmark if statusMapping.done is true.

Use `@angular/cdk/drag-drop` module: `CdkDropList`, `CdkDrag`, `CdkDragDrop`, `moveItemInArray`, `transferArrayItem`.</action>
  <verify>Board renders columns horizontally with task cards. Dragging between columns works. Position persists after reload. Uses CDK DragDrop with connected drop lists.</verify>
  <done>Built Angular Kanban board with CDK DragDrop, fractional-indexing positions, and cross-column task movement.</done>
</task>

<task type="auto" id="04-04">
  <name>Build task card component with priority colors</name>
  <files>frontend/src/app/features/board/task-card/task-card.component.ts, frontend/src/app/shared/utils/task-colors.ts</files>
  <action>Create `frontend/src/app/shared/utils/task-colors.ts` as the SINGLE SOURCE OF TRUTH for task colors. Export `PRIORITY_COLORS` mapping each priority to Tailwind classes: `urgent: { bg: 'bg-red-500', text: 'text-white', border: 'border-red-600', dot: 'bg-red-400' }`, `high: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-600', dot: 'bg-orange-400' }`, `medium: { bg: 'bg-yellow-400', text: 'text-yellow-900', border: 'border-yellow-500', dot: 'bg-yellow-300' }`, `low: { bg: 'bg-blue-400', text: 'text-white', border: 'border-blue-500', dot: 'bg-blue-300' }`. Export `COLUMN_STATUS_COLORS`, `COLUMN_HEADER_COLORS` (8 bright hex colors). Export `getPriorityColor(priority)` and `getPriorityLabel(priority)` helpers.

Create `task-card.component.ts` as standalone component with `cdkDrag` directive. Input: task object (id, title, priority, dueDate, assignees, labels, commentsCount). NOTE: No status prop -- status derived from column. Renders a card with: 4px left border colored by priority, title (truncated 2 lines with `line-clamp-2`), label pills row, bottom row with priority badge, due date (red if overdue, amber if today, gray otherwise), assignee avatar stack (max 3 + "+N"), comment count icon. On click (not drag), emit `taskClicked` event to open detail panel.</action>
  <verify>Cards show colored borders by priority. Overdue dates in red. Avatars stack. Cards are draggable.</verify>
  <done>Built task card with Monday.com-style priority colors from single source of truth task-colors.ts.</done>
</task>

<task type="auto" id="04-05">
  <name>Implement optimistic updates in Angular</name>
  <files>frontend/src/app/features/board/board-view/board-view.component.ts, frontend/src/app/core/services/task.service.ts</files>
  <action>Update `board-view.component.ts` to use Angular Signals for board state. Create a `boardState = signal<Record<string, Task[]>>({})` that holds the current tasks grouped by column. On CDK drop event: (1) immediately update `boardState` signal by moving the task in the local data (optimistic), (2) call `taskService.move()` which returns an Observable, (3) on error, revert `boardState` to previous snapshot and show Angular Material snackbar "Failed to move task. Reverted.", (4) on success, optionally merge server response.

Pattern: before mutation, `const snapshot = structuredClone(this.boardState())`. Apply optimistic change. Subscribe to API call with `{ error: () => { this.boardState.set(snapshot); this.snackbar.open('Failed...'); } }`.

Apply same pattern to task create (add to column optimistically), task delete (remove optimistically), and assign/unassign. Use `computed()` signals for derived state like filtered tasks.</action>
  <verify>Dragging a task shows it in new position instantly. Network failure reverts with snackbar error.</verify>
  <done>Implemented optimistic updates using Angular Signals with snapshot/rollback pattern.</done>
</task>

<task type="auto" id="04-06">
  <name>Build Angular WebSocket service for real-time board sync</name>
  <files>frontend/src/app/core/services/websocket.service.ts, frontend/src/app/features/board/board-view/board-view.component.ts</files>
  <action>Create `websocket.service.ts` as injectable service. Uses RxJS `webSocket()` from `rxjs/webSocket` to connect to `ws://host/api/ws?token=<jwt>`. Implements auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s) using `retryWhen` + `delay`. Exposes:
- `subscribe(channel: string)` -- sends `{ "action": "subscribe", "channel": channel }` to server
- `unsubscribe(channel: string)` -- sends unsubscribe message
- `messages$(channel: string): Observable<WsMessage>` -- filtered stream for a specific channel
- `connected$: Observable<boolean>` -- connection status

Update `board-view.component.ts`: on init, call `wsService.subscribe('board:' + boardId)`. Listen to `wsService.messages$('board:' + boardId)`. On `task:created`, `task:updated`, `task:moved`, `task:deleted` events from OTHER users (check event.userId !== currentUserId to avoid double-applying own optimistic updates), refresh the affected task data by calling the API or merging the event payload into boardState signal. On component destroy, unsubscribe from the channel.</action>
  <verify>Open board in two tabs. Move a task in tab A. Tab B sees the update within 1-2 seconds. Own mutations don't cause double-renders.</verify>
  <done>Built Angular WebSocket service with RxJS, auto-reconnect, and channel-based real-time board sync.</done>
</task>

<task type="auto" id="04-07">
  <name>Build task detail slide-over panel</name>
  <files>frontend/src/app/features/board/task-detail/task-detail.component.ts, frontend/src/app/features/board/task-assignee-picker/task-assignee-picker.component.ts</files>
  <action>Create `task-detail.component.ts` as standalone component. Opens as a side panel (Angular CDK Overlay or Angular Material sidenav, width 480px, slides from right). Input: taskId. Fetches full task via `GET /api/tasks/:id`. Renders: (1) Title as inline-editable heading (contenteditable or input, on blur calls PUT). (2) Metadata grid: "Column" showing current column name (status derived from statusMapping -- display "Done" badge in green if column has statusMapping.done === true); "Priority" as Material select with colored options from PRIORITY_COLORS; "Due Date" as Material datepicker; "Assignees" rendered by task-assignee-picker. (3) Description textarea. (4) Labels section. (5) Placeholder sections for Comments (S05) and Attachments (S06).

Create `task-assignee-picker.component.ts` that shows current assignees with remove button, plus "Add" button that opens a search dropdown calling `GET /api/workspaces/:id/members/search?q=`. On select, calls `POST /api/tasks/:id/assignees`. On remove, calls `DELETE /api/tasks/:id/assignees/:userId`.</action>
  <verify>Clicking a task card opens slide-over. Editing title, priority, due date, assignees persists. Column-derived status displays correctly.</verify>
  <done>Built task detail slide-over with inline editing, column-derived status, and multi-assignee picker.</done>
</task>

<task type="auto" id="04-08">
  <name>Add task filters and search bar</name>
  <files>frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts, frontend/src/app/features/board/board-view/board-view.component.ts</files>
  <action>Create `board-toolbar.component.ts` as standalone component rendered above the Kanban board. Contains: search input (text filter on task title), priority multi-select (Material chip list), assignee multi-select, due date range picker (Material date range), labels multi-select, clear filters button with active filter count badge. All filter values are persisted in URL query params using Angular Router `queryParams`. Emits a `filtersChanged` output with the current filter state.

Update `board-view.component.ts`: create a `filteredBoardState = computed(() => { ... })` signal that applies filters to `boardState`. Filters are AND-combined. No status filter since status is column-derived (users filter by column visibility instead). The `filterTasks(tasks, filters)` pure function filters by: search (title includes), priorities (array includes), assigneeIds (intersection), dueDateRange (between), labelIds (intersection). Board renders from `filteredBoardState` instead of raw `boardState`.</action>
  <verify>Selecting "urgent" shows only urgent tasks. Combining filters shows intersection. Filters persist in URL on reload.</verify>
  <done>Added URL-persisted task filters with Angular computed signals. No status filter -- status is column-derived.</done>
</task>
