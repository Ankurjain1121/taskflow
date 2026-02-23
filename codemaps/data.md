# TaskFlow Data Codemap

> Generated: 2026-02-23 | Commit: f6f3095

## Database: PostgreSQL 16

Multi-tenant via RLS (SET app.tenant_id per transaction).

## Enums

| Enum | Values |
|------|--------|
| user_role | admin, manager, member |
| workspace_member_role | owner, admin, member, viewer |
| workspace_visibility | open, closed |
| board_member_role | viewer, editor |
| task_priority | urgent, high, medium, low |
| activity_action | created, updated, moved, assigned, unassigned, commented, attached, status_changed, priority_changed, deleted |
| dependency_type | blocks, blocked_by, related |
| recurrence_pattern | daily, weekly, biweekly, monthly, yearly, weekdays, custom, custom_weekly |
| custom_field_type | text, number, date, dropdown, checkbox |
| automation_trigger | task_moved, task_created, task_assigned, task_priority_changed, task_due_date_passed, task_completed, subtask_completed, comment_added, custom_field_changed, label_changed, due_date_approaching |
| automation_action_type | move_task, assign_task, set_priority, send_notification, add_label, set_milestone, create_subtask, add_comment, set_due_date, set_custom_field, send_webhook |

## Tables (45+)

### Core Identity
| Table | Key Columns |
|-------|-------------|
| tenants | id, name, slug, plan |
| users | id, email, name, password_hash, avatar_url, phone_number, job_title, department, bio, role, tenant_id, onboarding_completed, last_login_at, deleted_at |
| accounts | id, user_id, provider, provider_account_id |
| refresh_tokens | id, user_id, token_hash, expires_at, revoked_at, ip_address, user_agent, device_name, last_active_at |
| password_reset_tokens | id, user_id, token_hash, expires_at, used_at |
| user_preferences | id, user_id (UNIQUE), timezone, date_format, locale, default_board_view, sidebar_density, quiet_hours_start/end, digest_frequency, light_theme_slug, dark_theme_slug, accent_color, color_mode |

### Workspace & Board
| Table | Key Columns |
|-------|-------------|
| workspaces | id, name, description, logo_url, visibility, tenant_id, created_by_id, deleted_at |
| workspace_members | id, workspace_id, user_id, role (owner/admin/member/viewer), joined_at |
| boards | id, name, description, slack_webhook_url, workspace_id, tenant_id, created_by_id, deleted_at |
| board_members | id, board_id, user_id, role |
| board_columns | id, name, board_id, position, color, status_mapping(JSONB) |

### Teams
| Table | Key Columns |
|-------|-------------|
| teams | id, name, description, color, workspace_id, created_by_id |
| team_members | id, team_id, user_id, added_at |

### Tasks
| Table | Key Columns |
|-------|-------------|
| tasks | id, title, description, priority, due_date, start_date, estimated_hours, board_id, column_id, group_id, milestone_id, position(string), eisenhower_urgency, eisenhower_importance, search_vector, tenant_id, created_by_id, deleted_at |
| task_assignees | id, task_id, user_id, assigned_at |
| task_groups | id, board_id, name, color, position(string), collapsed, tenant_id, deleted_at |
| subtasks | id, title, is_completed, position(string), task_id, created_by_id, completed_at |
| labels | id, name, color, board_id |
| task_labels | id, task_id, label_id |
| task_dependencies | id, source_task_id, target_task_id, dependency_type, created_by_id |
| milestones | id, name, description, due_date, color, board_id, tenant_id |

### Positions (Role-based Assignment)
| Table | Key Columns |
|-------|-------------|
| positions | id, name, description, board_id, fallback_position_id, tenant_id, created_by_id |
| position_holders | id, position_id, user_id, assigned_at |

### Collaboration
| Table | Key Columns |
|-------|-------------|
| comments | id, content, task_id, author_id, parent_id, mentioned_user_ids(JSONB), deleted_at |
| attachments | id, file_name, file_size, mime_type, storage_key, task_id, uploaded_by_id, deleted_at |
| activity_log | id, action, entity_type, entity_id, user_id, metadata(JSONB), ip_address, tenant_id |

### Notifications
| Table | Key Columns |
|-------|-------------|
| notifications | id, recipient_id, event_type, title, body, link_url, is_read |
| notification_preferences | id, user_id, event_type, in_app, email, slack, whatsapp |

### Invitations & Billing
| Table | Key Columns |
|-------|-------------|
| invitations | id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, board_ids(JSONB), message, job_title |
| subscriptions | id, tenant_id, plan_code, status, trial_ends_at |
| processed_webhooks | id, event_id |

### Time Tracking
| Table | Key Columns |
|-------|-------------|
| time_entries | id, task_id, user_id, started_at, ended_at, duration_minutes, is_running, board_id |

### Recurring Tasks
| Table | Key Columns |
|-------|-------------|
| recurring_task_configs | id, task_id, pattern, cron_expression, interval_days, next_run_at, last_run_at, is_active, max_occurrences, occurrences_created, end_date, skip_weekends, days_of_week, day_of_month, creation_mode, position_id, board_id, tenant_id |

### Custom Fields
| Table | Key Columns |
|-------|-------------|
| board_custom_fields | id, board_id, name, field_type, options(JSONB), is_required, position |
| task_custom_field_values | id, task_id, field_id, value_text/number/date/bool |

### Templates
| Table | Key Columns |
|-------|-------------|
| project_templates | id, name, description, category, is_public, tenant_id |
| project_template_columns | id, template_id, name, position, color, status_mapping(JSONB) |
| project_template_tasks | id, template_id, column_index, title, priority, position |
| task_templates | id, (task template fields) |
| task_template_subtasks | id, template_id, title, position |
| task_template_labels | id, template_id, name, color |
| task_template_custom_fields | id, template_id, name, field_type, options |

### Automation
| Table | Key Columns |
|-------|-------------|
| automation_rules | id, name, board_id, trigger, trigger_config(JSONB), is_active, conditions(JSONB), execution_count, last_triggered_at |
| automation_actions | id, rule_id, action_type, action_config(JSONB), position |
| automation_logs | id, rule_id, task_id, triggered_at, status, details(JSONB) |

### Sharing & Webhooks
| Table | Key Columns |
|-------|-------------|
| board_shares | id, board_id, share_token, password_hash, expires_at, is_active, permissions(JSONB) |
| webhooks | id, board_id, url, secret, events(TEXT[]), is_active |
| webhook_deliveries | id, webhook_id, event_type, payload(JSONB), response_status, success |
| favorites | id, user_id, entity_type, entity_id |

### Themes
| Table | Key Columns |
|-------|-------------|
| themes | slug(PK), name, category, description, is_dark, sort_order, is_active, colors(JSONB), personality(JSONB), preview(JSONB), primeng_ramp(JSONB) |

## Key Indexes

| Index | Table | Columns | Type |
|-------|-------|---------|------|
| idx_tasks_search | tasks | search_vector | GIN |
| idx_tasks_eisenhower | tasks | eisenhower_urgency, importance | partial |
| idx_tasks_due_date_active | tasks | due_date | partial |
| idx_time_entries_running | time_entries | user_id, is_running | partial |
| idx_recurring_configs_next_run | recurring_task_configs | next_run_at | partial |
| idx_workspace_members_user | workspace_members | user_id | btree |
| idx_board_members_user | board_members | user_id | btree |
| idx_task_assignees_user | task_assignees | user_id | btree |

## Triggers

| Trigger | On | Action |
|---------|-----|--------|
| update_updated_at | 17+ tables | Auto-set updated_at = NOW() on UPDATE |
| tasks_search_vector_trigger | tasks | Maintain tsvector from title + description |
| create_default_task_group | boards | Auto-create "Ungrouped" group on INSERT |
| teams_updated_at | teams | Auto-set updated_at on UPDATE |

## Migrations (21 files)

| Migration | Date | Scope |
|-----------|------|-------|
| 20260205_initial | Feb 5 | Base schema: all core tables + enums + indexes |
| 20260206_audit_extensions | Feb 6 | Audit indexes, soft-delete on comments/attachments |
| 20260209_phase1 | Feb 9 | Password reset, subtasks, full-text search, invitation extensions |
| 20260210_phase2 | Feb 10 | Dependencies, milestones |
| 20260211_phase3 | Feb 11 | Recurring tasks, custom fields, time entries |
| 20260212_phase4 | Feb 12 | Templates, automations, shares, webhooks |
| 20260213_eisenhower | Feb 13 | Eisenhower matrix columns on tasks |
| 20260213_task_groups | Feb 13 | Task groups + auto-create trigger |
| 20260214_favorites | Feb 14 | Favorites table |
| 20260218_indexes | Feb 18 | Performance indexes (members, assignees, due dates) |
| 20260220_settings_teams | Feb 20 | User preferences, workspace API keys, session metadata |
| 20260221_themes | Feb 21 | Themes table |
| 20260221_themes_seed | Feb 21 | ~30 theme seed data |
| 20260221_user_prefs_theme | Feb 21 | Theme columns on user_preferences |
| 20260222_recurring_templates | Feb 22 | Enhanced recurring, task templates, automation enhancements |
| 20260222_workspace_roles | Feb 22 | Workspace member roles (owner/admin/member/viewer) |
| 20260222_workspace_visibility | Feb 22 | Workspace visibility (open/closed) |
| 20260222_teams | Feb 22 | Teams table |
| 20260222_teams_trigger | Feb 22 | Teams updated_at trigger |
| 20260222_user_profile | Feb 22 | User job_title, department, bio; invitation job_title |
| 20260222_positions | Feb 23 | Positions, position_holders, recurring position_id |

## Entity Relationships

```
Tenant 1--* User
Tenant 1--* Workspace
Workspace 1--* Board
Workspace 1--* Team
Workspace *--* User (via workspace_members, role)
Team *--* User (via team_members)
Board 1--* Column
Board 1--* Task (via column)
Board 1--* TaskGroup
Board 1--* Label
Board 1--* Position
Board *--* User (via board_members, role)
Position *--* User (via position_holders)
Position --? RecurringTaskConfig (for role-based assignment)
Position --? Position (fallback chain via fallback_position_id)
Task *--* User (via task_assignees)
Task *--* Label (via task_labels)
Task 1--* Subtask
Task 1--* Comment (threaded via parent_id)
Task 1--* Attachment
Task 1--* TimeEntry
Task *--* Task (via task_dependencies)
Task *--1 Milestone
Task *--1 TaskGroup
Board 1--* Milestone
Board 1--* CustomField -> TaskCustomFieldValue
Board 1--* AutomationRule -> AutomationAction
Board 1--* BoardShare
Board 1--* Webhook -> WebhookDelivery
User 1--* Notification
User 1--* NotificationPreference
User 1--1 UserPreferences
User 1--* Favorite
User 1--* RefreshToken (sessions)
```

## Type Generation Pipeline

Backend Rust models use `ts-rs` crate with `#[ts(export)]` to auto-generate TypeScript types in `frontend/src/app/shared/types/`.

## Redis Usage

| DB | Purpose |
|----|---------|
| db0 | App: WebSocket pub/sub (board/user/workspace channels), rate limiting |
| db1 | Lago (billing) |
| db2 | Novu (notifications) |

## MinIO (S3)

Bucket: task-attachments
Flow: Backend presigned PUT URL -> Client direct upload -> Backend confirms
Public URL: files.paraslace.in (reverse proxy with CORS)

## Data Patterns

| Pattern | Implementation |
|---------|---------------|
| Task status | Derived from board_column.status_mapping (no status column) |
| Fractional indexing | position(string) on tasks, subtasks, columns, task_groups |
| Soft deletes | deleted_at timestamps on users, workspaces, boards, tasks, comments, attachments, task_groups |
| Full-text search | tasks.search_vector (tsvector) + GIN index, auto-maintained trigger |
| Eisenhower | NULL=auto-compute, true/false=manual override |
| JSONB extensibility | status_mapping, trigger_config, action_config, custom field options, webhook events |
| Role hierarchy | UserRole (global) > WorkspaceMemberRole (per-workspace) > BoardMemberRole (per-board) |
| Position-based assignment | recurring_task_configs.position_id -> position_holders for role-based recurring tasks |
