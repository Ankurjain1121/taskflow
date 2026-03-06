<!-- Generated: 2026-03-05 | Files scanned: 40 migrations | Token estimate: ~900 -->

# Data Codemap (PostgreSQL 16)

## Core Tables

| Table | Key Columns | Foreign Keys |
|-------|-------------|--------------|
| tenants | id, name, slug, plan | — |
| users | id, email, name, password_hash, role, tenant_id | tenants |
| refresh_tokens | id, user_id, token_hash, expires_at | users CASCADE |
| workspaces | id, name, tenant_id, created_by_id | tenants, users |
| workspace_members | workspace_id, user_id, role | workspaces CASCADE, users CASCADE |
| boards | id, name, workspace_id, tenant_id, is_sample | workspaces CASCADE, tenants |
| board_members | board_id, user_id, role | boards CASCADE, users CASCADE |
| board_columns | id, board_id, name, position, color, icon, wip_limit | boards CASCADE |
| tasks | id, board_id, column_id, title, priority, due_date, position, version | boards CASCADE, board_columns |
| task_assignees | task_id, user_id | tasks CASCADE, users CASCADE |
| labels | id, board_id, name, color | boards CASCADE |
| task_labels | task_id, label_id | tasks CASCADE, labels CASCADE |
| comments | id, task_id, author_id, parent_id, content, mentioned_user_ids | tasks CASCADE, users |
| attachments | id, task_id, file_name, storage_key, mime_type | tasks CASCADE |
| activity_log | id, action, entity_type, entity_id, user_id, metadata (JSONB) | users, tenants |
| notifications | id, recipient_id, event_type, title, is_read, archived | users |

## Entity Relationships

```
tenants 1→N users, workspaces
workspaces 1→N boards, workspace_members
boards 1→N board_columns, board_members, labels
board_columns 1→N tasks
tasks N→N users (task_assignees), N→N labels (task_labels)
tasks 1→N comments, attachments, subtasks, task_watchers, task_reminders
comments self-referential (parent_id) for threading
```

## Migration History (40 migrations)

| Phase | Dates | Migrations | Summary |
|-------|-------|------------|---------|
| Initial | 2026-02-05 | 1 | Core schema: tenants, users, workspaces, boards, tasks, comments, attachments |
| Audit | 2026-02-06 | 1 | Extended activity logging |
| Phase 1-4 | 2026-02-09..12 | 4 | Automations, webhooks, templates, recurring tasks, subtasks, kanban |
| Features | 2026-02-13..14 | 3 | Eisenhower matrix, task groups, favorites |
| Performance | 2026-02-18 | 1 | Missing indexes on user_id columns |
| Teams | 2026-02-20..22 | 8 | Settings, teams, member roles, visibility, profiles, positions |
| Task System | 2026-02-24..26 | 7 | Task IDs, subtask enhancements, labels, filters, WIP limits, watchers, reminders |
| Board UX | 2026-03-03..08 | 6 | Column icons, board backgrounds, owner role, recent items, notification archive, task versioning, column_entered_at, is_sample |
| Phase J | 2026-03-09..12 | 4 | Automation templates, metrics views, bulk operations, theme accents |

## Materialized Views

| View | Key | Purpose |
|------|-----|---------|
| metrics_cycle_time_by_week | (board_id, week_start) | Avg days creation → done |
| metrics_task_velocity | (board_id, week_start) | Tasks completed per week |
| metrics_workload_by_person | (workspace_id, user_id) | Active/overdue/completed counts |

Refresh: `refresh_metrics_views()` — concurrent refresh all 3.

## Key Indexes

- `idx_tasks_due_date_active(due_date) WHERE deleted_at IS NULL` — overdue queries
- `idx_workspace_members_user(user_id)` — user workspace lookups
- `idx_board_members_user(user_id)` — user board access
- `idx_task_assignees_user(user_id)` — assigned task queries

## Enums

- `user_role`: admin, manager, member
- `board_member_role`: viewer, editor
- `task_priority`: urgent, high, medium, low
- `activity_action`: created, updated, moved, assigned, commented, deleted, ...
- `subscription_status`: active, trialing, past_due, cancelled, expired
