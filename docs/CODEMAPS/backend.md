<!-- Generated: 2026-03-16 | Files scanned: ~120 | Token estimate: ~950 -->
# Backend

## Middleware Chain (outermost first)

CompressionLayer → CORS → RequestId → TraceLayer → SecurityHeaders → CacheHeaders → GlobalRateLimit(60/min/IP) → UserRateLimit(100/min/user) → AuthMiddleware(protected only)

Specialized limits: auth=5/60s, invitations=5/60s, automations=20/60s, bulk=10/60s, export/import=10/60s.

## Extractors

| Extractor | Purpose |
|-----------|---------|
| `AuthUserExtractor` | Required JWT auth, 401 if missing |
| `AdminUser` | Requires admin role, 403 otherwise |
| `ManagerOrAdmin` | Requires manager or admin |
| `TenantContext` | Extracts tenant_id + user_id + role |
| `OptionalAuthUser` | Never fails, returns None if unauth |

## Routes (~150 endpoints)

### Auth
POST /api/auth/sign-in|sign-up|refresh|sign-out|logout|change-password|forgot-password|reset-password
GET|PATCH|DELETE /api/auth/me

### Projects (Boards)
GET|POST /api/workspaces/{wid}/projects
GET|PUT|DELETE /api/projects/{id} | GET /api/projects/{id}/full | POST /api/projects/{id}/duplicate
GET|POST /api/projects/{bid}/columns | DELETE|PUT /api/columns/{id}/*
GET|POST /api/projects/{bid}/groups | GET|PUT|DELETE /api/groups/{id}

### Tasks
GET|POST /api/projects/{bid}/tasks
GET|PATCH|DELETE /api/tasks/{id} | PATCH /api/tasks/{id}/move
POST /api/tasks/{id}/duplicate|complete|uncomplete
POST|DELETE /api/tasks/{id}/assignees | POST|DELETE /api/tasks/{id}/watchers

### Subtasks
GET|POST /api/tasks/{tid}/subtasks | GET|PUT|DELETE /api/subtasks/{id}
PUT /api/subtasks/{id}/reorder | POST /api/subtasks/{id}/promote

### Comments & Attachments
GET|POST /api/tasks/{tid}/comments | PUT|DELETE /api/comments/{id}
POST /api/tasks/{tid}/attachments|attachments/confirm | GET /api/tasks/{tid}/attachments
GET /api/attachments/{id}/download-url | DELETE /api/attachments/{id}

### Dependencies & Milestones
POST|GET /api/tasks/{tid}/dependencies | DELETE /api/dependencies/{id}
GET|POST /api/projects/{bid}/milestones | GET|PUT|DELETE /api/milestones/{id}
POST|DELETE /api/tasks/{tid}/milestone

### Automation
GET|POST /api/projects/{bid}/automations | GET|PUT|DELETE /api/automations/{id}
GET /api/automations/{id}/logs | GET|POST /api/automation-templates

### Custom Fields & Time Tracking
GET|POST /api/projects/{bid}/custom-fields | PUT|DELETE /api/custom-fields/{id}
GET|POST /api/tasks/{tid}/time-entries | POST /api/tasks/{tid}/time-entries/start
POST /api/time-entries/{id}/stop | PUT|DELETE /api/time-entries/{id}
GET /api/time-entries/running | GET /api/projects/{bid}/time-report | GET /api/timesheet

### Workspaces & Teams
GET|POST /api/workspaces | GET /api/workspaces/discover | GET|PUT|DELETE /api/workspaces/{id}
POST /api/workspaces/{id}/join | member CRUD + search + bulk
GET|POST /api/workspaces/{wid}/teams | GET|PUT|DELETE /api/teams/{id} | member CRUD

### Notifications & Preferences
GET /api/notifications | GET /api/notifications/unread-count | PUT|DELETE /api/notifications/{id}
GET|PUT|DELETE /api/notification-preferences
GET|PUT /api/users/me/preferences | GET|DELETE /api/users/me/sessions

### Dashboard & Reports
GET /api/dashboard/stats|recent-activity|tasks-by-status|tasks-by-priority|overdue-tasks|completion-trend|upcoming-deadlines
GET /api/projects/{bid}/reports | GET /api/workspaces/{wid}/portfolio
GET /api/workspaces/{wid}/metrics | GET /api/teams/{tid}/metrics | GET /api/me/metrics

### Other
GET /api/search | GET /api/my-tasks|my-tasks/summary | GET /api/eisenhower
GET|POST /api/favorites | GET /api/archive | POST /api/archive/restore
GET|POST /api/projects/{bid}/webhooks | GET|POST /api/projects/{bid}/shares
CRUD /api/project-templates | CRUD /api/task-templates | CRUD /api/filter-presets
POST /api/projects/{bid}/bulk-* | /api/projects/{bid}/export|import
/api/admin/users|audit-log|trash | /api/onboarding/* | /api/uploads/*
/api/cron/* (X-Cron-Secret) | GET /api/health|health/live|health/ready

## Services (crates/services/)

| Service | Purpose |
|---------|---------|
| `automation_executor` | Rule engine: evaluate triggers, execute actions |
| `deadline_scanner` | Background: scan overdue tasks, send notifications |
| `trash_cleanup` | Background: purge expired soft-deleted records |
| `weekly_digest` | Background: email weekly task summaries |
| `broadcast` | Publishes WebSocket events to Redis pubsub |
| `presence` | Redis-backed user presence + task locking |
| `minio` | S3/MinIO presigned URL generation |
| `audit` | Records audit events with route→action mapping |
| `novu` | Novu notification platform client (inactive) |
| `email` (Postal) | SMTP email via Postal |
| `slack` | Slack webhook notifications |
| `whatsapp` | WAHA WhatsApp API (inactive) |
| `trash_bin` | Soft delete/restore/permanent delete logic |
| `sample_board` | Seeds demo project for new users |
