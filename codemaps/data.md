# TaskFlow Data Codemap

> Generated: 2026-02-18 | Commit: dfb29e9

## Database: PostgreSQL 16

Multi-tenant via RLS (SET app.tenant_id per transaction).

## Enums

| Enum | Values |
|------|--------|
| user_role | admin, manager, member |
| board_member_role | viewer, editor |
| task_priority | urgent, high, medium, low |
| activity_action | created, updated, moved, assigned, unassigned, commented, attached, status_changed, priority_changed, deleted |
| subscription_status | active, trialing, past_due, cancelled, expired |
| dependency_type | blocks, blocked_by, related |
| recurrence_pattern | daily, weekly, biweekly, monthly, custom |
| custom_field_type | text, number, date, dropdown, checkbox |
| automation_trigger | task_moved, task_created, task_assigned, task_priority_changed, task_due_date_passed, task_completed |
| automation_action_type | move_task, assign_task, set_priority, send_notification, add_label, set_milestone |

## Tables (40)

### Core Identity
| Table | Key Columns |
|-------|-------------|
| tenants | id, name, slug, plan |
| users | id, email, name, password_hash, role, tenant_id, deleted_at |
| accounts | id, user_id, provider, provider_account_id |
| refresh_tokens | id, user_id, token_hash, expires_at, revoked_at |
| password_reset_tokens | id, user_id, token_hash, expires_at, used_at |

### Workspace & Board
| Table | Key Columns |
|-------|-------------|
| workspaces | id, name, description, tenant_id, created_by_id, deleted_at |
| workspace_members | id, workspace_id, user_id |
| boards | id, name, description, workspace_id, tenant_id, deleted_at |
| board_members | id, board_id, user_id, role |
| board_columns | id, name, board_id, position, color, status_mapping(JSONB) |

### Tasks
| Table | Key Columns |
|-------|-------------|
| tasks | id, title, description, priority, due_date, board_id, column_id, group_id, milestone_id, position, start_date, estimated_hours, eisenhower_urgency, eisenhower_importance, search_vector, tenant_id, deleted_at |
| task_assignees | id, task_id, user_id |
| task_groups | id, board_id, name, color, position, collapsed, tenant_id, deleted_at |
| subtasks | id, title, is_completed, position, task_id, completed_at |
| labels | id, name, color, board_id |
| task_labels | id, task_id, label_id |
| task_dependencies | id, source_task_id, target_task_id, dependency_type |
| milestones | id, name, description, due_date, color, board_id, tenant_id |

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
| invitations | id, email, workspace_id, role, token, invited_by_id, expires_at, accepted_at, board_ids(JSONB) |
| subscriptions | id, tenant_id, plan_code, status, trial_ends_at |
| processed_webhooks | id, event_id |

### Advanced Features
| Table | Key Columns |
|-------|-------------|
| recurring_task_configs | id, task_id, pattern, cron_expression, next_run_at, is_active, board_id |
| board_custom_fields | id, board_id, name, field_type, options(JSONB), is_required, position |
| task_custom_field_values | id, task_id, field_id, value_text/number/date/bool |
| time_entries | id, task_id, user_id, started_at, ended_at, duration_minutes, is_running, board_id |

### Templates & Automation
| Table | Key Columns |
|-------|-------------|
| project_templates | id, name, description, category, is_public, tenant_id |
| project_template_columns | id, template_id, name, position, color, status_mapping(JSONB) |
| project_template_tasks | id, template_id, column_index, title, priority, position |
| automation_rules | id, name, board_id, trigger, trigger_config(JSONB), is_active |
| automation_actions | id, rule_id, action_type, action_config(JSONB), position |
| automation_logs | id, rule_id, task_id, triggered_at, status, details(JSONB) |

### Sharing & Webhooks
| Table | Key Columns |
|-------|-------------|
| board_shares | id, board_id, share_token, password_hash, expires_at, is_active, permissions(JSONB) |
| webhooks | id, board_id, url, secret, events(TEXT[]), is_active |
| webhook_deliveries | id, webhook_id, event_type, payload(JSONB), response_status, success |
| favorites | id, user_id, entity_type, entity_id |

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
| update_updated_at | 17 tables | Auto-set updated_at = NOW() on UPDATE |
| tasks_search_vector_trigger | tasks | Maintain tsvector from title + description |
| create_default_task_group | boards | Auto-create "Ungrouped" group on INSERT |

## Migrations (10 files)

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

## Entity Relationships

```
Tenant 1--* User
Tenant 1--* Workspace
Workspace 1--* Board
Workspace *--* User (via workspace_members)
Board 1--* Column
Board 1--* Task (via column)
Board 1--* TaskGroup
Board 1--* Label
Board *--* User (via board_members, role)
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
User 1--* Favorite
```

## Redis Usage

| DB | Purpose |
|----|---------|
| db0 | App: WebSocket pub/sub (board/user/workspace channels), rate limiting |
| db1 | Lago (billing) |
| db2 | Novu (notifications) |

## MinIO (S3)

Bucket: task-attachments
Flow: Backend presigned PUT URL -> Client direct upload -> Backend confirms
Public URL: files.paraslace.in (Caddy reverse proxy with CORS)
