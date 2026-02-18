# TaskFlow Backend Codemap

> Generated: 2026-02-18 | Commit: dfb29e9

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

## Middleware

| Module | File | Purpose |
|--------|------|---------|
| auth | middleware/auth.rs | JWT from cookie/Bearer -> AuthUser{user_id, tenant_id, role} |
| rate_limit | middleware/rate_limit.rs | IP sliding-window via DashMap |
| audit | middleware/audit.rs | POST/PUT/PATCH/DELETE audit logging (fire-and-forget) |
| tenant | middleware/tenant.rs | SET app.tenant_id per-tx for RLS |

Route tiers: Protected (JWT), Rate-limited (5/60s), Public, Cron (X-Cron-Secret)

## API Endpoints (100+)

### Auth (/api/auth)
| Method | Path | Tier |
|--------|------|------|
| POST | /sign-in | rate-limited |
| POST | /sign-up | rate-limited |
| POST | /forgot-password | rate-limited |
| POST | /refresh | public |
| POST | /logout | public |
| POST | /reset-password | public |
| POST | /sign-out | protected |
| GET | /me | protected |

### Workspaces (/api/workspaces)
GET /, POST /, GET /{id}, PUT /{id}, DELETE /{id}, GET /{id}/members/search, POST /{id}/members, DELETE /{id}/members/{uid}

### Boards (/api/workspaces/{wid}/boards, /api/boards)
GET /workspaces/{wid}/boards, POST /workspaces/{wid}/boards, GET /boards/{id}, PUT /boards/{id}, DELETE /boards/{id}, GET /boards/{id}/full, GET/POST/DELETE /boards/{id}/members, GET /board-templates

### Columns (/api/boards/{bid}/columns, /api/columns)
GET, POST (by board), DELETE, PUT /name, PUT /position, PUT /status-mapping, PUT /color (by column)

### Tasks (/api/boards/{bid}/tasks, /api/tasks)
GET (grouped), GET /list (flat), GET /calendar, GET /gantt, POST, POST /bulk-update, POST /bulk-delete, GET /{id}, PUT /{id}, DELETE /{id}, POST /{id}/move, POST/DELETE /{id}/assignees

### Nested under /api/tasks/{tid}
- /subtasks: GET, POST, PUT, PATCH /toggle, PUT /reorder, DELETE
- /comments: GET, POST, PUT, DELETE
- /attachments: POST (upload), GET, DELETE
- /activity: GET
- /time-entries: GET, POST /start, POST (manual), POST /{id}/stop, PUT, DELETE
- /dependencies: GET, POST, GET /blockers
- /recurring: GET, POST, PUT, DELETE
- /custom-fields: GET, PUT
- /milestone: POST, DELETE

### Board-Level Features
| Feature | Base Path |
|---------|-----------|
| Task Groups | /boards/{bid}/groups (CRUD + stats + collapse) |
| Reports | /boards/{bid}/reports |
| Custom Fields | /boards/{bid}/custom-fields |
| Milestones | /boards/{bid}/milestones |
| Automations | /boards/{bid}/automations |
| Import/Export | /boards/{bid}/export, /import, /import/csv |
| Board Shares | /boards/{bid}/shares |
| Webhooks | /boards/{bid}/webhooks |
| Time Report | /boards/{bid}/time-report |
| Dependencies | /boards/{bid}/dependencies |

### Global Endpoints
| Feature | Path |
|---------|------|
| Search | /search |
| Eisenhower | /eisenhower (GET, PUT /tasks/{id}, PUT /reset) |
| My Tasks | /my-tasks, /my-tasks/summary |
| Dashboard | /dashboard/stats,recent-activity,tasks-by-status,tasks-by-priority,overdue-tasks,completion-trend,upcoming-deadlines |
| Team | /workspaces/{wid}/team-workload, /overloaded-members |
| Notifications | /notifications (list, unread-count, mark-read, mark-all-read) |
| Preferences | /notification-preferences (list, update, reset) |
| Onboarding | /onboarding (create-workspace, invite-members, generate-sample-board, complete, invitation-context) |
| Templates | /project-templates (CRUD + apply + save-board) |
| Favorites | /favorites (list, add, remove, check) |
| Archive | /archive (list, restore, delete) |
| Admin | /admin/audit-log, /users, /trash |
| Cron | /cron/health, /deadline-scan, /weekly-digest, /trash-cleanup, /recurring-tasks |
| Health | /health, /health/live, /health/ready |
| WebSocket | /ws |

## Auth Crate

- JWT: RS256 (PEM keys) or HS256 (shared secret) fallback
- Password: Argon2 hashing
- RBAC: Admin > Manager > Member hierarchy

## Services Crate

| Module | Purpose |
|--------|---------|
| broadcast | Redis pub/sub (board/user/workspace channels) |
| notifications | Email (Postal), Slack, WhatsApp, weekly digest |
| novu | Push notification integration |
| minio | S3 file storage |
| audit | Route-to-action mapping + event recording |
| trash_bin | Soft delete with 30-day retention |
| jobs | Deadline scan, weekly digest, trash cleanup |
| board_templates | Predefined board templates |
| sample_board | Onboarding sample board generation |

## Query Modules (35+)

auth, workspaces, boards, columns, tasks, comments, attachments, subtasks, task_groups, dependencies, milestones, recurring, custom_fields, time_entries, notifications, notification_preferences, invitations, my_tasks, eisenhower, team_overview, dashboard, reports, search, project_templates, automations, board_shares, webhooks, favorites, archive, labels, activity_log, activity, users, projects

## WebSocket

Auth: cookie -> query param -> first-message (10s timeout)
Channels: board:{uuid}, user:{uuid}, workspace:{uuid} (membership-validated)
Transport: Redis pub/sub -> mpsc -> WebSocket per client
