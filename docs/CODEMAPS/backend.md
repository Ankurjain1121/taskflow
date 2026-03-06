<!-- Generated: 2026-03-05 | Files scanned: 66 route files, 32 models | Token estimate: ~900 -->

# Backend Codemap (Rust/Axum)

## Crate Structure

| Crate | Path | Responsibility |
|-------|------|----------------|
| api | `backend/crates/api/` | Routes (60 modules), middleware, extractors, WS |
| auth | `backend/crates/auth/` | JWT verify, Argon2 password, RBAC |
| db | `backend/crates/db/` | SQLx models (32), migrations (40), queries |
| services | `backend/crates/services/` | Broadcast, presence, jobs, notifications, MinIO |

## API Routes

### Auth (rate-limited: 5 req/min)
```
POST /auth/sign-in       → auth::sign_in_handler
POST /auth/sign-up       → auth::sign_up_handler
POST /auth/sign-out      → auth::sign_out_handler [AUTH]
POST /auth/refresh       → auth::refresh_handler
POST /auth/forgot-password → auth_password::forgot_password_handler
POST /auth/reset-password  → auth_password::reset_password_handler
POST /auth/change-password → auth_password::change_password_handler [AUTH]
PATCH /auth/me            → auth_profile::update_profile_handler [AUTH]
DELETE /auth/me           → auth_password::delete_account_handler [AUTH]
```

### Tasks [AUTH]
```
GET    /boards/{bid}/tasks         → task_crud::list_tasks
GET    /boards/{bid}/tasks/list    → task_views::list_tasks_flat_handler
GET    /boards/{bid}/tasks/calendar → task_views::list_calendar_tasks_handler
GET    /boards/{bid}/tasks/gantt   → task_views::list_gantt_tasks_handler
POST   /boards/{bid}/tasks         → task_crud::create_task_handler
POST   /boards/{bid}/tasks/bulk-update → task_bulk::bulk_update_handler
POST   /boards/{bid}/tasks/bulk-delete → task_bulk::bulk_delete_handler
GET    /tasks/{id}                 → task_crud::get_task
PATCH  /tasks/{id}                 → task_crud::update_task_handler
DELETE /tasks/{id}                 → task_crud::delete_task_handler
PATCH  /tasks/{id}/move            → task_movement::move_task_handler
POST   /tasks/{id}/duplicate       → task_crud::duplicate_task_handler
POST   /tasks/{id}/assignees       → task_assignment::assign_user_handler
DELETE /tasks/{id}/assignees/{uid} → task_assignment::unassign_user_handler
POST   /tasks/{id}/watchers        → task_watcher::add_watcher_handler
POST   /tasks/{id}/reminders       → task_reminder::set_reminder_handler
```

### Boards [AUTH]
```
GET    /boards          → board::list_boards_handler
POST   /boards          → board::create_board_handler
GET    /boards/{id}     → board::get_board_handler (ETag support)
PATCH  /boards/{id}     → board::update_board_handler
DELETE /boards/{id}     → board::delete_board_handler
POST   /boards/{id}/members → board::add_board_member_handler
GET    /boards/{id}/share → board_share::get_board_share_handler
```

### Workspaces, Teams, Columns [AUTH]
```
GET/POST   /workspaces                    → workspace::*
PATCH      /workspaces/{id}               → workspace::update
GET        /workspaces/{id}/labels        → workspace_labels::*
GET/POST   /teams                         → teams::*
GET/PATCH/DELETE /columns/{id}            → column::*
```

### Automation & Bulk Ops [AUTH, user rate-limited]
```
POST /automations         → automation::create [20 req/min]
POST /bulk-operations     → bulk_ops::execute  [10 req/min]
GET  /bulk-operations/{id}/undo → bulk_ops::undo
GET  /automation-templates → automation_templates::list
```

### Health (public)
```
GET /health          → health_handler
GET /health/live     → liveness_handler
GET /health/ready    → readiness_handler
GET /health/detailed → detailed_health_handler [AUTH]
```

### WebSocket
```
GET /ws → ws_handler (cookie/token/first-message auth)
Messages: subscribe, unsubscribe, presence_join/leave, lock/unlock_task, ping/pong
Limits: 500 max connections, 50 channels/conn, 60s GC interval
```

## Model → Route Mapping

| Model | Route Files |
|-------|-------------|
| Task | task_crud, task_movement, task_bulk, task_views, task_assignment, task_watcher, task_reminder |
| Board | board, board_share |
| Column | column |
| Comment | comments |
| Workspace | workspace, workspace_labels, workspace_export, workspace_trash |
| Team | teams, team_overview |
| User | auth, auth_password, auth_profile, sessions |
| Automation | automation, automation_templates |
| BulkOperation | bulk_ops |
| Notification | notification, notification_preferences |
| Activity | activity_log |
