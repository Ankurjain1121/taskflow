# Section 03: Workspace & Board Management

## Overview
Build the workspace and board management features. Users create workspaces (one per department), add boards within workspaces, and manage board columns. The Angular sidebar shows all workspaces and boards. Board access is controlled by the `board_members` table -- workspace members do not automatically see all boards.

## Risk: [green] - Standard CRUD with well-known UI patterns

## Dependencies
- Depends on: 01, 02
- Blocks: 04, 05, 08, 10, 11
- Parallel batch: 2

## TDD Test Stubs
- Test: User can create a new workspace with a name
- Test: User can create a board within a workspace
- Test: Board has default columns (To Do, In Progress, Done) on creation
- Test: Board creator is auto-added as editor in board_members
- Test: User can add, rename, reorder, and delete columns
- Test: Sidebar displays only boards the user is a member of
- Test: User with Member role cannot delete a workspace
- Test: Board queries filter by board_members membership

## Tasks

<task type="auto" id="03-01">
  <name>Create Rust REST endpoints for workspace CRUD</name>
  <files>backend/crates/api/src/routes/workspace.rs, backend/crates/db/src/queries/workspaces.rs</files>
  <action>Create `backend/crates/db/src/queries/workspaces.rs` with SQLx query functions: `list_workspaces_for_user(pool, user_id, tenant_id)` joins workspaces with workspace_members WHERE deleted_at IS NULL, `get_workspace_by_id(pool, id, tenant_id)` with members list, `create_workspace(pool, name, description, tenant_id, created_by_id)` that also inserts creator as workspace_member, `update_workspace(pool, id, name, description)`, `soft_delete_workspace(pool, id)` sets deleted_at = now(), `search_workspace_members(pool, workspace_id, query)` ILIKE search on name/email (for @mention autocomplete, limit 10), `update_member_role(pool, workspace_id, user_id, new_role)` updates users.role (global role), `remove_workspace_member(pool, workspace_id, user_id)` deletes from workspace_members and all board_members in that workspace. Create `backend/crates/api/src/routes/workspace.rs` with Axum handlers: `GET /api/workspaces` (list for current user), `GET /api/workspaces/:id` (get with members), `POST /api/workspaces` (requires WorkspaceCreate permission - admin only), `PUT /api/workspaces/:id`, `DELETE /api/workspaces/:id` (soft delete, requires WorkspaceDelete - admin only), `GET /api/workspaces/:id/members/search?q=<query>`, `PUT /api/workspaces/:id/members/:user_id/role`, `DELETE /api/workspaces/:id/members/:user_id`. All handlers use `with_tenant()` for RLS scoping.</action>
  <verify>Creating a workspace returns it with an ID. Listing returns only workspaces the user is a member of. Member search returns matching members. Role update changes users.role.</verify>
  <done>Created Rust workspace REST endpoints with list, CRUD, member search, role management, and soft delete.</done>
</task>

<task type="auto" id="03-02">
  <name>Create Rust REST endpoints for board CRUD with board membership</name>
  <files>backend/crates/api/src/routes/board.rs, backend/crates/db/src/queries/boards.rs</files>
  <action>Create `backend/crates/db/src/queries/boards.rs` with SQLx query functions: `list_boards_by_workspace(pool, workspace_id, user_id)` joins boards with board_members WHERE user is a member AND deleted_at IS NULL, `get_board_by_id(pool, id, user_id)` verifies board membership (returns error if not member), includes columns ordered by position, `create_board(tx, name, description, workspace_id, tenant_id, created_by_id)` in a transaction: inserts board, inserts 3 default columns using fractional indexing positions ("To Do" position "a0" color "#6366f1" statusMapping null, "In Progress" position "a1" color "#3b82f6" statusMapping null, "Done" position "a2" color "#22c55e" statusMapping `{"done": true}`), inserts creator as board_member with role "editor", `update_board`, `soft_delete_board`, `add_board_member(pool, board_id, user_id, role)`, `remove_board_member`, `list_board_members`. Create routes: `GET /api/workspaces/:workspace_id/boards`, `GET /api/boards/:id`, `POST /api/workspaces/:workspace_id/boards` (requires BoardCreate), `PUT /api/boards/:id`, `DELETE /api/boards/:id` (soft delete), `POST /api/boards/:id/members`, `DELETE /api/boards/:id/members/:user_id`, `GET /api/boards/:id/members`.</action>
  <verify>Creating a board returns it with 3 default columns and auto-adds creator. Listing by workspace only returns boards the user is a member of. Non-members get 403.</verify>
  <done>Created Rust board REST endpoints with workspace-scoped listing, board membership enforcement, and default column creation.</done>
</task>

<task type="auto" id="03-03">
  <name>Create Rust REST endpoints for column management</name>
  <files>backend/crates/api/src/routes/column.rs, backend/crates/db/src/queries/columns.rs</files>
  <action>Create `backend/crates/db/src/queries/columns.rs` with: `list_columns_by_board(pool, board_id)` ordered by position ASC, `add_column(pool, board_id, name, color, status_mapping, position)`, `rename_column(pool, id, name)`, `reorder_column(pool, id, new_position)`, `update_status_mapping(pool, id, status_mapping)`, `delete_column(pool, id)` checks if tasks exist first. Create routes: `GET /api/boards/:board_id/columns`, `POST /api/boards/:board_id/columns` (requires BoardUpdate, calculates position via fractional indexing - position after the last column), `PUT /api/columns/:id/rename`, `PUT /api/columns/:id/reorder` (input: afterId, beforeId - server calculates new position string), `PUT /api/columns/:id/status-mapping`, `DELETE /api/columns/:id` (returns 409 CONFLICT if tasks exist with message "Cannot delete column with tasks"). All verify board membership.</action>
  <verify>Adding a column assigns it the next fractional position. Reordering updates position. Deleting a column with tasks returns 409. Status mapping updates persist.</verify>
  <done>Created Rust column REST endpoints with fractional indexing, status mapping, and safe-delete check.</done>
</task>

<task type="auto" id="03-04">
  <name>Build Angular sidebar with workspace/board hierarchy</name>
  <files>frontend/src/app/shared/components/sidebar/sidebar.component.ts, frontend/src/app/shared/components/sidebar/workspace-item.component.ts, frontend/src/app/core/services/workspace.service.ts, frontend/src/app/core/services/board.service.ts</files>
  <action>Create `workspace.service.ts` with methods: `listWorkspaces(): Observable<Workspace[]>`, `getById(id): Observable<Workspace>`, `create(data): Observable<Workspace>`, `update(id, data)`, `delete(id)`, `searchMembers(workspaceId, query): Observable<User[]>`. Create `board.service.ts` with: `listByWorkspace(workspaceId): Observable<Board[]>`, `getById(id): Observable<Board>`, `create(workspaceId, data)`, etc. Create `sidebar.component.ts` as a standalone component. Uses `workspace.service.listWorkspaces()` to fetch workspaces. Renders a fixed-width sidebar (256px, collapsible to 64px) with: app logo "TaskFlow" at top, "Create Workspace" button (visible only to admins via `authService.currentUser().role === 'admin'`), scrollable list of workspace items, user profile + sign-out at bottom. Style: `h-screen bg-gray-900 text-gray-100 flex flex-col`. Create `workspace-item.component.ts` that receives workspace as input, fetches boards via `board.service.listByWorkspace()` (only boards user is a member of per D8). Renders collapsible section with chevron icon. Each board is a routerLink to `/workspace/:workspaceId/board/:boardId`. Active board highlighted via `routerLinkActive`. "+" button for new board (manager/admin only). Uses Angular CDK `CdkAccordion` or custom expand/collapse.</action>
  <verify>Sidebar renders workspaces with only member-boards nested underneath. Clicking a board navigates. Active board is highlighted.</verify>
  <done>Built collapsible Angular sidebar with workspace/board hierarchy, role-based controls, and active state highlighting.</done>
</task>

<task type="auto" id="03-05">
  <name>Build Angular workspace settings page</name>
  <files>frontend/src/app/features/workspace/workspace-settings/workspace-settings.component.ts, frontend/src/app/features/workspace/members-list/members-list.component.ts</files>
  <action>Create `workspace-settings.component.ts` as standalone component at route `/workspace/:workspaceId/settings`. Reads workspaceId from ActivatedRoute params. Fetches workspace via service. Two sections: (1) General: reactive form for name and description, save button calls PUT endpoint. (2) Members: renders `members-list.component.ts`. Danger zone at bottom: "Delete Workspace" button (admin only) with Angular Material confirm dialog, calls DELETE and navigates to `/dashboard`. Create `members-list.component.ts` receiving members array and workspaceId as inputs. Renders a table with: avatar, name, email, role (Angular Material select dropdown with Admin/Manager/Member - this is the global users.role), actions (remove button). Role change calls `PUT /api/workspaces/:id/members/:userId/role`. Remove calls DELETE. Admin-only controls. Uses Angular Material Table, Select, Button, Dialog.</action>
  <verify>Settings page shows editable name/description. Members table shows global roles. Role changes and removals work.</verify>
  <done>Built Angular workspace settings with editable fields, member management, and admin-only soft delete.</done>
</task>

<task type="auto" id="03-06">
  <name>Build Angular board settings page with column manager</name>
  <files>frontend/src/app/features/board/board-settings/board-settings.component.ts, frontend/src/app/features/board/column-manager/column-manager.component.ts</files>
  <action>Create `board-settings.component.ts` at route `/workspace/:workspaceId/board/:boardId/settings`. Three sections: General (name, description edit form), Columns (renders column-manager), Members (board members with add/remove and viewer/editor role). Delete board button for admin/manager. Create `column-manager.component.ts` receiving boardId input. Fetches columns via `GET /api/boards/:boardId/columns`. Renders vertical list with Angular CDK `cdkDropList` for drag-and-drop reordering. Each column shows: cdkDrag handle, inline-editable name, color swatch (color picker), statusMapping badge ("Done" if statusMapping.done is true), delete button. On `cdkDragDrop` event, compute new position from fractional-indexing and call `PUT /api/columns/:id/reorder`. "Add Column" form at bottom with name, color picker, statusMapping toggle. Invalidate/refresh data after mutations.</action>
  <verify>Column manager displays columns in order. Dragging reorders with fractional indexing. Board members section manages per-board membership.</verify>
  <done>Built Angular board settings with inline column manager using CDK DnD and board member management.</done>
</task>
