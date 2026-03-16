<!-- Generated: 2026-03-16 | Migrations: 47 | Token estimate: ~900 -->
# Data

## Enums

`user_role` (admin, manager, member) | `workspace_member_role` (owner, admin, member, viewer) | `board_member_role` (viewer, editor) | `task_priority` (urgent, high, medium, low) | `activity_action` (created, updated, moved, assigned, ...) | `dependency_type` (blocks, blocked_by, related) | `recurrence_pattern` (daily, weekly, biweekly, monthly, yearly, weekdays, custom, custom_weekly) | `custom_field_type` (text, number, date, dropdown, checkbox) | `automation_trigger` (12 types) | `automation_action_type` (11 types) | `subscription_status` (active, trialing, past_due, cancelled, expired)

## Tables (~45)

### Identity & Auth
`tenants` (id, name, slug, plan) → `users` (email, password_hash, role, tenant_id) → `refresh_tokens`, `password_reset_tokens`, `accounts`

### Workspaces
`workspaces` (name, tenant_id, created_by_id) → `workspace_members` (role) → `workspace_api_keys`
`invitations` (email, token, workspace_id, board_ids)

### Teams
`teams` (name, workspace_id) → `team_members` (user_id)

### Projects
`projects` (name, prefix, workspace_id, tenant_id, background_color, is_sample) → `project_members` (role, billing_rate_cents)
`project_statuses` (name, color, type[not_started/active/done/cancelled], position, is_default, allowed_transitions)
`project_shares` (share_token, password_hash, expires_at, permissions)

### Task Lists
`task_lists` (name, color, position, project_id, is_default)

### Tasks
`tasks` (title, description, priority, due_date, start_date, estimated_hours, position, task_number, version, status_id, task_list_id, milestone_id, project_id, tenant_id)
`task_assignees` | `task_labels` | `task_dependencies` (source, target, type) | `task_watchers` | `task_reminders` | `task_custom_field_values` | `subtasks` (title, is_completed, position)
`time_entries` (started_at, ended_at, duration_minutes, is_running, is_billable, task_id, project_id)

### Labels
`labels` (name, color, workspace_id, board_id nullable)

### Comments & Attachments
`comments` (content, mentioned_user_ids JSONB, parent_id self-ref, task_id, author_id)
`attachments` (file_name, file_size, mime_type, storage_key, task_id)

### Custom Fields
`project_custom_fields` (name, field_type, options JSONB, project_id) → `task_custom_field_values`

### Milestones
`milestones` (name, due_date, color, project_id)

### Automation
`automation_rules` (trigger, trigger_config, conditions, board_id) → `automation_actions` (action_type, action_config) + `automation_logs`
`automation_templates` (name, category, trigger_type, workspace_id) | `automation_rate_counters`

### Webhooks
`webhooks` (url, secret, events[], board_id) → `webhook_deliveries` | `processed_webhooks`

### Templates
`project_templates` → `project_template_tasks`, `_labels`, `_custom_fields`, `_groups`
`task_templates` → `task_template_subtasks`, `_labels`, `_custom_fields`

### Recurring
`recurring_task_configs` (pattern, cron_expression, next_run_at, task_id, board_id)

### Notifications & Activity
`notifications` (event_type, title, body, recipient_id, archived_at) | `notification_preferences` (in_app, email, slack, whatsapp)
`activity_log` (action, entity_type, entity_id, metadata JSONB, user_id, tenant_id)
`recent_items` (entity_type, entity_id, user_id)

### Misc
`user_preferences` | `subscriptions` (lago, stripe fields) | `favorites` | `filter_presets` | `bulk_operations` | `positions` → `position_holders`

### Materialized Views
`metrics_cycle_time_by_week` | `metrics_task_velocity` | `metrics_workload_by_person`

## Key Relationships

```
tenant ──1:N──> users, workspaces, projects
workspace ──1:N──> projects, teams, labels, workspace_members
project ──1:N──> task_lists, project_statuses, tasks, milestones, automation_rules, webhooks, custom_fields
task ──N:M──> users (assignees, watchers) | task ──1:N──> comments, attachments, subtasks, time_entries
task ──N:M──> labels | task ──N:N──> tasks (dependencies)
```
