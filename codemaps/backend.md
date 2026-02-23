# TaskFlow Backend Codemap

> Generated: 2026-02-23 | Commit: f6f3095

## Entry Point

`crates/api/src/main.rs` -> `Config::from_env()` -> `AppState::new()` -> `axum::serve()`

## AppState

```
AppState {
  db:             PgPool,
  config:         Arc<Config>,
  jwt_keys:       Arc<JwtKeys>,       // RS256 or HS256
  redis:          ConnectionManager,
  board_channels: Arc<DashMap<Uuid, broadcast::Sender<String>>>,
  s3_client:      aws_sdk_s3::Client,
}
```

## Middleware (5)

| Module | File | Purpose |
|--------|------|---------|
| auth | middleware/auth.rs | JWT from cookie/Bearer -> AuthUser{user_id, tenant_id, role}; optional_auth variant |
| rate_limit | middleware/rate_limit.rs | IP sliding-window via DashMap |
| audit | middleware/audit.rs | POST/PUT/PATCH/DELETE audit logging (fire-and-forget) |
| tenant | middleware/tenant.rs | SET app.tenant_id per-tx for RLS; with_tenant/with_tenant_tx wrappers |
| request_id | middleware/request_id.rs | Unique request ID for tracing |

Route tiers: Protected (JWT), Rate-limited (5/60s), Public, Cron (X-Cron-Secret)

## Extractors

| Extractor | Purpose |
|-----------|---------|
| AuthUserExtractor | Requires JWT auth |
| AdminUser | Admin-only |
| ManagerOrAdmin | Manager+ role |
| TenantContext | Tenant info |
| OptionalAuthUser | Optional auth |

## API Endpoints (150+, 58 route files)

### Auth (/api/auth)
POST /sign-in, /sign-up, /forgot-password [rate-limited]
POST /refresh, /logout, /reset-password [public]
POST /sign-out, GET /me [protected]

### Sessions (/api/users/me/sessions)
GET /, POST /, DELETE /{id}

### Workspaces (/api/workspaces)
GET /, GET /discover, POST /, GET /{id}, PUT /{id}, DELETE /{id}, POST /{id}/join, GET /{id}/members/search, POST /{id}/members, POST /{id}/members/bulk, DELETE /{id}/members/{uid}

### Workspace API Keys (/api/workspaces/{wid}/api-keys)
GET /, POST /, GET /{id}, DELETE /{id}

### Tenant (/api/tenant)
GET /members, GET /members/{uid}/workspaces

### Teams (/api/teams)
GET /, POST /, GET /{id}, PUT /{id}, DELETE /{id}, POST /{id}/members, DELETE /{id}/members/{uid}, GET /workspaces/{wid}/teams

### Team Overview (/api/teams/{id})
GET /overview, /members, /member-workload, /overloaded-members, POST /reassign-tasks

### Positions (/api/positions)
GET /, POST /, GET /{id}, PUT /{id}, DELETE /{id}, POST /{id}/holders, DELETE /{id}/holders/{uid}, GET /{id}/recurring-tasks

### Boards (/api/workspaces/{wid}/boards, /api/boards)
GET /workspaces/{wid}/boards, POST /workspaces/{wid}/boards, GET /boards/{id}, PUT /boards/{id}, DELETE /boards/{id}, GET /boards/{id}/full, GET/POST/DELETE /boards/{id}/members, GET /board-templates

### Columns (/api/boards/{bid}/columns, /api/columns)
GET, POST (by board), DELETE, PUT /name, PUT /position, PUT /status-mapping, PUT /color (by column)

### Tasks (/api/boards/{bid}/tasks, /api/tasks)
GET (grouped), GET /list (flat), GET /calendar, GET /gantt, POST, POST /bulk-update, POST /bulk-delete, GET /{id}, PUT /{id}, DELETE /{id}, POST /{id}/move, POST/DELETE /{id}/assignees

### Task Sub-resources (/api/tasks/{tid})
- /subtasks: GET, POST, PUT, PATCH /toggle, PUT /reorder, DELETE
- /comments: GET, POST, PUT, DELETE
- /attachments: POST (upload), POST /confirm, GET, GET /{id}/download-url, DELETE
- /activity: GET
- /time-entries: GET, POST (manual), PUT, DELETE, GET /running, PUT /{id}/stop
- /dependencies: GET, POST, GET /blockers, PUT/DELETE /{id}
- /recurring: GET, POST, PUT, DELETE
- /custom-fields: GET, PUT
- /milestone: POST, DELETE

### Task Templates
GET/POST /task-templates, GET/PUT/DELETE /task-templates/{id}, POST /tasks/{tid}/save-as-template

### Board-Level Features
| Feature | Base Path |
|---------|-----------|
| Task Groups | /boards/{bid}/groups (CRUD + stats + collapse) |
| Reports | /boards/{bid}/reports |
| Custom Fields | /boards/{bid}/custom-fields |
| Milestones | /boards/{bid}/milestones |
| Automations | /boards/{bid}/automations + /automations/{id}/logs |
| Import/Export | /boards/{bid}/export, /import, /import/csv |
| Board Shares | /boards/{bid}/shares + /shares/{id}, /shared/{token} (public) |
| Webhooks | /boards/{bid}/webhooks + /webhooks/{id}/deliveries |

### Global Endpoints
| Feature | Path |
|---------|------|
| Search | /search |
| Eisenhower | /eisenhower (GET, PUT /tasks/{id}, POST /reset) |
| My Tasks | /my-tasks, /my-tasks/summary |
| Dashboard | /dashboard/stats,recent-activity,tasks-by-status,tasks-by-priority,overdue-tasks,completion-trend,upcoming-deadlines |
| Notifications | /notifications (list, unread-count, mark-read, mark-all-read) |
| Preferences | /notification-preferences (list, update, reset) |
| User Prefs | /users/me/preferences (GET, PUT) |
| Themes | /themes (list), /themes/{slug} (GET, POST) |
| Uploads | /uploads/avatar, /uploads/avatar/confirm, /uploads/workspace-logo, /uploads/workspace-logo/confirm |
| Onboarding | /onboarding (create-workspace, invite-members, complete, invitation-context) |
| Templates | /project-templates (CRUD + apply + save-board) |
| Favorites | /favorites (list, add, remove) |
| Archive | /archive (list, restore, delete) |
| Admin | /admin/audit-log, /admin/audit-log/actions, /admin/users, /admin/users/{id}/role, /admin/trash |
| Invitations | /invitations (CRUD, bulk, validate, accept, resend) |
| Cron | /cron/health, /deadline-scan, /weekly-digest, /trash-cleanup, /recurring-tasks |
| Health | /health, /health/live, /health/ready |
| WebSocket | /ws |

## Auth Crate

- JWT: RS256 (PEM keys) or HS256 (shared secret) fallback
- Password: Argon2 hashing
- RBAC: Admin > Manager > Member hierarchy + workspace/board-level roles
- Functions: issue_tokens, verify_access/refresh_token, hash/verify_password, permissions_for_role, has_permission, can_manage_workspace

## Services Crate

| Module | Purpose |
|--------|---------|
| broadcast | Redis pub/sub (board/user/workspace channels) |
| notifications | Email (Postal), Slack, WhatsApp, weekly digest |
| novu | Push notification integration |
| minio | S3 file storage (presigned URLs) |
| audit | Route-to-action mapping + event recording |
| trash_bin | Soft delete with 30-day retention |
| board_templates | Predefined board templates |
| sample_board | Onboarding sample board generation |

### Background Jobs (services/jobs/)
| Job | Purpose |
|-----|---------|
| automation_executor | Evaluate automation trigger rules |
| deadline_scanner | Scan for overdue/upcoming tasks |
| trash_cleanup | Permanently delete expired trash |
| weekly_digest | Send weekly task summaries |

## Query Modules (38+)

activity_log, archive, attachments, auth, automations, board_shares, boards, columns, comments, custom_fields, dashboard, dependencies, eisenhower, favorites, invitations, milestones, my_tasks, notification_preferences, notifications, positions, project_templates, recurring, reports, search, subtasks, task_assignments, task_bulk, task_groups, task_templates, task_views, tasks, team_overview, teams, themes, time_entries, user_preferences, webhooks, workspace_api_keys, workspaces

## WebSocket

Auth: cookie -> query param -> first-message (10s timeout)
Channels: board:{uuid}, user:{uuid}, workspace:{uuid} (membership-validated)
Transport: Redis pub/sub -> mpsc -> WebSocket per client
Messages: ClientMessage enum (Auth, Subscribe, Unsubscribe), ServerMessage enum

## Key Dependencies

| Category | Crates |
|----------|--------|
| Web | axum 0.8, tower 0.5, tower-http 0.6 |
| Async | tokio 1 |
| Serialization | serde 1, serde_json 1, ts-rs 10 |
| Database | sqlx 0.8 (postgres), uuid 1, chrono 0.4 |
| Auth | jsonwebtoken 10, argon2 0.5, sha2 0.10 |
| Infra | redis 0.27, aws-sdk-s3 1, dashmap 6 |
| Observability | tracing 0.1, tracing-subscriber 0.3 |
| HTTP client | reqwest 0.12 |
| Error | thiserror 2 |
| Test | mockall 0.13, axum-test 16 |
