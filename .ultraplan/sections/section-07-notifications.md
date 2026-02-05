# Section 07: Notification System (Novu)

## Overview
Build a multi-channel notification system using self-hosted Novu as the orchestration layer. Route notifications to in-app bell, email (via Postal), Slack, and WhatsApp (via WAHA) based on user preferences and event type. Rust backend handles all notification logic; Angular frontend renders the notification bell and preferences UI.

## Risk: [yellow] - Multiple external services (Novu, Postal, Slack API, WAHA) with different failure modes

## Dependencies
- Depends on: 04
- Blocks: 08, 11, 12
- Parallel batch: 3

## TDD Test Stubs
- Test: Task assignment triggers in-app notification for assignee
- Test: Approaching deadline triggers email reminder (24h before due date)
- Test: In-app notification bell shows unread count
- Test: Marking notification as read updates the count
- Test: User can configure which channels they receive notifications on
- Test: Deadline scanner cron detects approaching and overdue tasks
- Test: Weekly digest email aggregates task activity

## Tasks

<task type="auto" id="07-01">
  <name>Create Novu HTTP client and notification event types in Rust</name>
  <files>backend/crates/services/src/novu.rs, backend/crates/services/src/notifications/events.rs</files>
  <action>Create `backend/crates/services/src/novu.rs` that exports a `NovuClient` struct wrapping `reqwest::Client`. Constructor takes `novu_api_url` and `novu_api_key`. Implement `trigger_event(&self, event_name: &str, subscriber_id: &str, payload: Value) -> Result<()>` as fire-and-forget (log error but don't propagate). Implement `identify_subscriber(&self, subscriber_id: &str, email: &str, name: &str)`.

Create `backend/crates/services/src/notifications/events.rs` with enum:
```rust
pub enum NotificationEvent {
    TaskAssigned, TaskDueSoon, TaskOverdue, TaskCommented, TaskCompleted, MentionInComment
}
```
For each event, define a payload struct. Implement `NotificationEvent::name(&self) -> &str` returning "task-assigned", "task-due-soon", etc. Add NovuClient to AppState.</action>
  <verify>Calling trigger_event with invalid event logs error but doesn't panic.</verify>
  <done>Created Novu HTTP client and typed notification event enum with payloads.</done>
</task>

<task type="auto" id="07-02">
  <name>Create notification preferences schema and REST endpoints</name>
  <files>backend/crates/db/src/migrations/0004_notification_preferences.sql, backend/crates/api/src/routes/notification_preferences.rs, backend/crates/db/src/queries/notification_preferences.rs</files>
  <action>Create migration with `notification_preferences` table: id (uuid PK), user_id (references users), event_type (varchar), in_app (boolean default true), email (boolean default true), slack (boolean default false), whatsapp (boolean default false), created_at, updated_at. Unique index on (user_id, event_type).

Create query functions: `list_by_user(pool, user_id)`, `upsert(pool, user_id, event_type, channels)`, `reset_all(pool, user_id)` deletes all for user (defaults applied at query time).

Create routes:
- `GET /api/notification-preferences` -- list for current user
- `PUT /api/notification-preferences` -- upsert: `{ eventType, inApp, email, slack, whatsapp }`
- `DELETE /api/notification-preferences` -- reset to defaults</action>
  <verify>Toggle email off, confirm persistence. Reset, confirm all defaults restored.</verify>
  <done>Created notification preferences schema and REST endpoints.</done>
</task>

<task type="auto" id="07-03">
  <name>Create in-app notifications service and REST endpoints</name>
  <files>backend/crates/db/src/migrations/0005_notifications.sql, backend/crates/services/src/notifications/service.rs, backend/crates/api/src/routes/notification.rs</files>
  <action>Create migration with `notifications` table: id (uuid PK), recipient_id (uuid references users), event_type (varchar), title (varchar), body (text), link_url (varchar nullable), is_read (boolean default false), created_at (timestamptz default now()). Index on (recipient_id, is_read, created_at DESC).

Create `backend/crates/services/src/notifications/service.rs` with SERVER-SIDE function `create_notification(pool, broadcast, recipient_id, event_type, title, body, link_url)`. This inserts the notification row AND publishes via WebSocket to channel `user:{recipient_id}` with event "notification:new". IMPORTANT: This is a server-side function, NOT a REST endpoint -- it's called from task mutations, comment creation, etc. to prevent privilege escalation.

Create `backend/crates/api/src/routes/notification.rs` with CLIENT-FACING routes only:
- `GET /api/notifications?cursor=&limit=` -- cursor-based pagination, returns { items, nextCursor, unreadCount }
- `GET /api/notifications/unread-count` -- returns { count }
- `PUT /api/notifications/:id/read` -- mark single as read
- `PUT /api/notifications/read-all` -- mark all as read
Do NOT expose a create endpoint to clients.</action>
  <verify>Server-side create_notification inserts row and broadcasts via WS. Client can list, count unread, mark read. No client-facing create.</verify>
  <done>Created notification service (server-side only) and client-facing REST endpoints for reading notifications.</done>
</task>

<task type="auto" id="07-04">
  <name>Build Angular notification bell component</name>
  <files>frontend/src/app/shared/components/notification-bell/notification-bell.component.ts, frontend/src/app/shared/components/notification-bell/notification-item.component.ts, frontend/src/app/core/services/notification.service.ts</files>
  <action>Create `notification.service.ts` with: `listNotifications(cursor?)`, `getUnreadCount()`, `markRead(id)`, `markAllRead()`. Uses polling every 30 seconds as fallback + WebSocket for real-time.

Create `notification-bell.component.ts` as standalone component. Shows bell icon in header. Subscribes to WebSocket channel `user:{userId}` for "notification:new" events via `websocketService`. Maintains `unreadCount = signal<number>(0)`. Red badge shows count (capped at "99+"). On click, opens Angular Material Menu/Overlay popover showing notification list (infinite scroll). "Mark all read" button at top.

Create `notification-item.component.ts` rendering single notification: icon by event type, title, body, relative timestamp. Unread items have left blue border. On click, call markRead() and navigate to link_url.</action>
  <verify>Assign task, bell badge increments. Open popover, see notification. Click to navigate and mark read.</verify>
  <done>Built notification bell with real-time WebSocket updates, polling fallback, and popover list.</done>
</task>

<task type="auto" id="07-05">
  <name>Create Postal email and Slack/WAHA integrations in Rust</name>
  <files>backend/crates/services/src/notifications/email.rs, backend/crates/services/src/notifications/slack.rs, backend/crates/services/src/notifications/whatsapp.rs</files>
  <action>Create `email.rs` with `PostalClient` struct (reqwest-based). Implement `send_email(to, subject, html_body)`. Export `handle_email_notification(pool, event_type, recipient_email, user_id, payload)` that looks up user notification preferences, maps event to email template (subject + HTML body), sends via Postal if email is enabled.

Create `slack.rs` with `send_slack_notification(webhook_url, event_type, payload)`. The `webhook_url` comes from `boards.slack_webhook_url` (S01 schema). Validates URL starts with "https://hooks.slack.com/". Sends Slack Block Kit formatted JSON. Feature-gated via SLACK_ENABLED env var.

Create `whatsapp.rs` with `send_whatsapp_notification(phone_number, event_type, payload)`. The `phone_number` comes from `users.phone_number` (S01 schema). Validates E.164 format. Sends plain-text via WAHA REST API. Feature-gated via WAHA_ENABLED.</action>
  <verify>Email sends with preference check. Slack uses board's webhook URL. WhatsApp uses user's phone number.</verify>
  <done>Created email (Postal), Slack, and WhatsApp (WAHA) notification providers with preference checks.</done>
</task>

<task type="auto" id="07-06">
  <name>Build Angular notification preferences and profile settings pages</name>
  <files>frontend/src/app/features/settings/notification-preferences/notification-preferences.component.ts, frontend/src/app/features/settings/profile/profile.component.ts</files>
  <action>Create `notification-preferences.component.ts` at route `/settings/notifications`. Render table: Event Type column, then In-App/Email/Slack/WhatsApp columns each with Material slide toggle. In-App always on (disabled toggle). On toggle change, call PUT endpoint. Hide Slack/WhatsApp columns if env vars disabled. "Reset to defaults" button.

Create `profile.component.ts` at route `/settings/profile`. REST endpoints needed: `GET /api/users/me/profile`, `PUT /api/users/me/profile` accepting `{ name?, phoneNumber?, avatarUrl? }` with E.164 phone validation. Form fields: Display Name (required), Email (read-only), Phone Number (with E.164 hint, for WhatsApp), Avatar URL. Save calls PUT, success snackbar. Link to notification preferences page. Create the Rust route handlers in `backend/crates/api/src/routes/user_profile.rs`.</action>
  <verify>Toggle email off for one event, persists. Profile phone number saves in E.164 format.</verify>
  <done>Built notification preferences and profile settings pages with per-event per-channel toggles.</done>
</task>

<task type="auto" id="07-07">
  <name>Create deadline scanner cron endpoint</name>
  <files>backend/crates/api/src/routes/cron.rs, backend/crates/services/src/jobs/deadline_scanner.rs</files>
  <action>Create `backend/crates/services/src/jobs/deadline_scanner.rs` with `pub async fn scan_deadlines(pool, notification_service, novu)`. Queries: (1) TASK_DUE_SOON: tasks where due_date within 24h AND deleted_at IS NULL AND not already notified (check activity_log dedup). For each, create_notification + trigger Novu. (2) TASK_OVERDUE: tasks where due_date < now() AND deleted_at IS NULL AND NOT in "done" column (join board_columns, check status_mapping NOT {"done": true}). Create notification for each assignee. Process in batches of 100.

Create `GET /api/cron/deadline-scan` in `backend/crates/api/src/routes/cron.rs`. Validate `X-Cron-Secret` header against CRON_SECRET env var. Return 401 if missing/invalid. Call scan_deadlines(). Return JSON results. Designed for hourly external trigger.</action>
  <verify>Task due in 12h triggers due-soon notification. Overdue task not in done column triggers overdue notification.</verify>
  <done>Created deadline scanner with 24h due-soon and overdue detection, column statusMapping check.</done>
</task>

<task type="auto" id="07-08">
  <name>Create weekly digest email cron endpoint</name>
  <files>backend/crates/services/src/jobs/weekly_digest.rs, backend/crates/api/src/routes/cron.rs</files>
  <action>Create `weekly_digest.rs` with `pub async fn send_weekly_digests(pool, postal)`. For each user with email enabled: query tasks created/completed/updated in last 7 days (completions via activity_log where action='moved' AND destination column has statusMapping.done). Calculate stats: completed, created, overdue, due this week. Build HTML email. Send via Postal. Batch 50 users at a time.

Add `GET /api/cron/weekly-digest` to cron routes with same X-Cron-Secret validation. Weekly trigger (Monday 9am).</action>
  <verify>User with activity gets digest email. User with email disabled gets nothing.</verify>
  <done>Created weekly digest aggregating task activity via activity_log, sent via Postal.</done>
</task>
