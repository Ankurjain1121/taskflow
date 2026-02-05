# Section 11: Audit Log & Admin Panel

## Overview
Build company-wide audit log for admins and admin panel for managing users, roles (global on users table), and 30-day trash bin using deletedAt soft-delete columns. Backend: Rust Axum + SQLx. Frontend: Angular 19.

## Risk: [green]
## Dependencies
- Depends on: 05, 06, 07, 08
- Blocks: 12
- Parallel batch: 5

## TDD Test Stubs
- Test: Every mutation route is recorded in audit log with correct activityAction enum value
- Test: ROUTE_ACTION_MAP correctly maps route paths to enum values
- Test: Admin can search/filter audit log by user, action, entity, date
- Test: Cursor-based pagination works correctly (no duplicates/skips)
- Test: Admin can change user's global role on users table
- Test: Soft-deleted items appear in trash bin (deletedAt IS NOT NULL, < 30 days)
- Test: Restoring sets deletedAt = NULL
- Test: Cleanup cron hard-deletes items > 30 days with cascading
- Test: Cleanup cron rejects requests without valid X-Cron-Secret

## Tasks

<task type="auto" id="11-01">
  <name>Create audit log service with route-to-action mapping</name>
  <files>backend/crates/services/src/audit.rs, backend/crates/db/src/migrations/0007_audit_extensions.sql</files>
  <action>Create migration adding ip_address (varchar(45) nullable) and user_agent (text nullable) to activity_log table.

Create audit.rs with ROUTE_ACTION_MAP: HashMap mapping route identifiers to activityAction enum values. Examples: "tasks.create" -> "created", "tasks.update" -> "updated", "tasks.move" -> "moved", "tasks.assign" -> "assigned", "tasks.unassign" -> "unassigned", "tasks.delete" -> "deleted", "boards.create" -> "created", "boards.delete" -> "deleted", "workspaces.create" -> "created", "comments.create" -> "commented", "attachments.upload" -> "attached", "admin.update_role" -> "updated", "trash.restore" -> "updated", "trash.permanent_delete" -> "deleted".

Export record_audit_event(pool, action, entity_type, entity_id, user_id, tenant_id, metadata, ip_address, user_agent) that inserts into activity_log. Unmapped routes log warning and skip.</action>
  <verify>Mapped routes produce audit entries. Unmapped routes skip with warning.</verify>
  <done>Created audit service with route-to-action mapping and extended activity_log columns.</done>
</task>

<task type="auto" id="11-02">
  <name>Create Axum audit middleware and attach to all mutation routes</name>
  <files>backend/crates/api/src/middleware/audit.rs, backend/crates/api/src/routes/mod.rs</files>
  <action>Create audit.rs Tower middleware. After successful response (2xx status) on mutation routes (POST, PUT, DELETE), extract route identifier from request extensions or path, look up in ROUTE_ACTION_MAP. If found, call record_audit_event with: action from map, entity_type from first path segment, entity_id from response body or path params, user from AuthUser extension, ip from X-Forwarded-For header, user_agent from User-Agent header. Metadata captures old/new values where available.

In routes/mod.rs, apply audit middleware layer to all mutation route groups: tasks, boards, workspaces, comments, attachments, notification-preferences, billing, admin-users, trash-bin. Every mutation across every router produces an audit trail.</action>
  <verify>Creating task produces audit entry. Changing role produces entry. Comment creation produces "commented" entry.</verify>
  <done>Attached audit middleware to all mutation routes for company-wide audit trail.</done>
</task>

<task type="auto" id="11-03">
  <name>Build audit log query endpoint and Angular admin page</name>
  <files>backend/crates/api/src/routes/admin_audit.rs, frontend/src/app/features/admin/audit-log/audit-log.component.ts</files>
  <action>Create GET /api/admin/audit-log?cursor=&page_size=&user_id=&action=&entity_type=&date_from=&date_to=&search= (admin only). Cursor is ISO timestamp of last item's created_at. Query: WHERE tenant_id = tenant AND (cursor IS NULL OR created_at < cursor) AND optional filters. ORDER BY created_at DESC. LIMIT page_size + 1 (extra row = hasMore). Join users for name/email. Returns { items, next_cursor, has_more }.

Create GET /api/admin/audit-log/actions returning distinct action values used.

Create audit-log.component.ts at /admin/audit-log. Full-width Material table: Timestamp (relative + tooltip absolute), User (name + avatar), Action (colored badge), Entity (type + link), IP, Details (expandable JSON). Filter controls: user select, action select, date range picker, search input. "Load More" button using cursor pagination.</action>
  <verify>Audit log page loads events. Filters work. Cursor pagination loads next page without duplicates.</verify>
  <done>Built audit log endpoint with cursor pagination and Angular admin page with filters.</done>
</task>

<task type="auto" id="11-04">
  <name>Build user management admin endpoints and Angular page</name>
  <files>backend/crates/api/src/routes/admin_users.rs, frontend/src/app/features/admin/users/admin-users.component.ts</files>
  <action>Create admin-only routes:
- GET /api/admin/users?search=&role= -- list all tenant users with workspace memberships, joined date, last active
- PUT /api/admin/users/:id/role accepting { role: admin|manager|member } -- updates users.role (global). Prevent demoting last admin (count admins first). Records audit event with old/new role.
- DELETE /api/admin/users/:id -- soft-delete (set deleted_at on users), remove from all workspace_members, invalidate sessions. Prevent self-removal.

Create admin-users.component.ts at /admin/users. Table: Avatar+Name, Email, Role (Material select inline for admin editing), Workspaces (count badge), Joined, Last Active, Actions (kebab: Change Role, Remove). Remove shows confirm dialog. Search bar + role filter. Count header: "24 users (3 admins, 5 managers, 16 members)".</action>
  <verify>Role change updates users.role. Last admin can't be demoted. Removal sets deleted_at.</verify>
  <done>Built user management with global role editing and soft-delete removal.</done>
</task>

<task type="auto" id="11-05">
  <name>Create trash bin service using deletedAt columns</name>
  <files>backend/crates/services/src/trash_bin.rs</files>
  <action>Create trash_bin.rs with functions:
- move_to_trash(pool, entity_type, entity_id, user_id) -- SET deleted_at = now() on tasks/boards/workspaces table. Record audit.
- restore_from_trash(pool, entity_type, entity_id, user_id) -- SET deleted_at = NULL. For tasks, verify parent board not deleted (error if so). Record audit.
- permanently_delete(pool, minio, entity_type, entity_id) -- hard DELETE row. For tasks: delete comments, attachments (+ MinIO objects), task_assignees, task_labels, activity_log refs. For boards: delete all tasks (cascade), columns, board_members. For workspaces: delete all boards (cascade), workspace_members.
- get_trash_items(pool, tenant_id, entity_type_filter, cursor, page_size) -- query all 3 tables WHERE deleted_at IS NOT NULL AND deleted_at > now() - 30 days. Join users for deleted_by name. Return union with entity_type, entity_id, name, deleted_at, deleted_by, days_remaining. Cursor-based pagination on deleted_at DESC.</action>
  <verify>moveToTrash sets deleted_at. Restore clears it. permanentDelete cascades. getTrashItems returns from all 3 tables.</verify>
  <done>Created trash bin service using deletedAt columns with cascading permanent delete.</done>
</task>

<task type="auto" id="11-06">
  <name>Build trash bin REST endpoints and Angular admin page</name>
  <files>backend/crates/api/src/routes/admin_trash.rs, frontend/src/app/features/admin/trash/admin-trash.component.ts</files>
  <action>Create admin-only routes:
- GET /api/admin/trash?entity_type=&cursor=&page_size= -- calls get_trash_items
- POST /api/admin/trash/restore accepting { entity_type, entity_id } -- calls restore
- DELETE /api/admin/trash/:entity_type/:entity_id -- calls permanently_delete
- DELETE /api/admin/trash/empty -- hard-delete ALL trashed items for tenant

Create admin-trash.component.ts at /admin/trash. Table: Type (icon + name), Name, Deleted By, Deleted At (relative), Expires In (countdown from days_remaining), Actions (Restore, Delete Forever). Tab filters: All, Tasks, Boards, Workspaces. "Empty Trash" button with destructive confirm dialog. Empty state: trash icon + "Trash is empty". Cursor-based Load More.</action>
  <verify>Trash page shows soft-deleted items. Restore removes from list. Delete Forever hard-deletes. Empty trash works.</verify>
  <done>Built trash bin REST endpoints and Angular admin page with restore and permanent delete.</done>
</task>

<task type="auto" id="11-07">
  <name>Create scheduled trash cleanup cron endpoint</name>
  <files>backend/crates/services/src/jobs/trash_cleanup.rs, backend/crates/api/src/routes/cron.rs</files>
  <action>Create trash_cleanup.rs with cleanup_expired_trash(pool, minio). Query each table (tasks, boards, workspaces) WHERE deleted_at IS NOT NULL AND deleted_at < now() - 30 days. Process order: workspaces first, then boards, then tasks (avoid cascade conflicts). Call permanently_delete for each. Batch 100 at a time. Continue on individual failures (collect errors). Return { deleted_count, errors }.

Add GET /api/cron/trash-cleanup to cron routes. Validate X-Cron-Secret header. Call cleanup. Return JSON results. Designed for daily external trigger.</action>
  <verify>Item with deleted_at > 30 days ago is hard-deleted with cascading. Items < 30 days untouched. Missing X-Cron-Secret returns 401.</verify>
  <done>Created trash cleanup cron with 30-day threshold, batch processing, and X-Cron-Secret auth.</done>
</task>
