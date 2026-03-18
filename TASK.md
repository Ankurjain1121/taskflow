# TASK: Hierarchical Permission System (Enterprise RBAC)

## Objective
Build a ClickUp-style hierarchical permission system with cascading visibility, custom roles, guest access, and audit trail. Replace fixed role enums with a flexible role table.

## Key Decisions
- **Role storage**: Replace PG enums with `workspace_roles` table (FK-based)
- **Query strategy**: SQL-level filtering (no application-level or Redis cache)
- **Inheritance**: Workspace → Project → Task List, with override at each level
- **Phasing**: Build all, ship all (no incremental releases)

## Architecture

### Permission Resolution Flow
```
resolve_visibility(user, task):
  1. Get user's role in project (via role_id → workspace_roles)
  2. If role has can_view_all_tasks → VISIBLE
  3. Get effective_visibility for task's container:
     - task_list.visibility_override ?? project.visibility ?? workspace.default
  4. If effective = 'public' → VISIBLE
  5. If effective = 'assignee_only' → check task_assignees
  6. Else → NOT VISIBLE
```

### New DB Schema

#### Migration 1: Workspace Roles Table
```sql
CREATE TABLE workspace_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  capabilities JSONB NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);
CREATE INDEX idx_workspace_roles_workspace ON workspace_roles(workspace_id);
```

System capabilities (JSONB keys):
- `can_view_all_tasks` — see all tasks regardless of assignment
- `can_create_tasks` — create new tasks
- `can_edit_own_tasks` — edit tasks assigned to self
- `can_edit_all_tasks` — edit any task
- `can_delete_tasks` — delete tasks
- `can_manage_members` — add/remove project members
- `can_manage_project_settings` — change project visibility, statuses
- `can_manage_automations` — create/edit automation rules
- `can_export` — export data (CSV, PDF)
- `can_manage_billing` — billing and subscription
- `can_invite_members` — invite new workspace members
- `can_manage_roles` — create/edit custom roles

Default system roles per workspace:
| Role | view_all | create | edit_own | edit_all | delete | members | settings |
|------|----------|--------|----------|----------|--------|---------|----------|
| Owner | true | true | true | true | true | true | true |
| Admin | true | true | true | true | true | true | true |
| Manager | true | true | true | true | false | true | false |
| Member | false | true | true | false | false | false | false |
| Viewer | false | false | false | false | false | false | false |
| Guest | false | false | false | false | false | false | false |

#### Migration 2: Visibility columns + role_id FK
```sql
ALTER TABLE workspace_members ADD COLUMN role_id UUID REFERENCES workspace_roles(id);
ALTER TABLE project_members ADD COLUMN role_id UUID REFERENCES workspace_roles(id);
ALTER TABLE workspaces ADD COLUMN default_project_visibility VARCHAR(20) NOT NULL DEFAULT 'public';
ALTER TABLE projects ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'public';
ALTER TABLE projects ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE task_lists ADD COLUMN visibility_override VARCHAR(20) DEFAULT NULL;
```

#### Migration 3: Data migration (enum → role_id)
Map existing enum values to system role IDs per workspace.

#### Migration 4: Guest access
```sql
CREATE TABLE guest_project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  can_comment BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);
```

### SQL Query Pattern for Visibility
```sql
WHERE t.project_id = $1 AND t.deleted_at IS NULL AND t.parent_task_id IS NULL
  AND (
    wr.capabilities->>'can_view_all_tasks' = 'true'
    OR COALESCE(tl.visibility_override, p.visibility, w.default_project_visibility) = 'public'
    OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2)
  )
```

## Implementation Steps

### Step 1: DB migrations (workspace_roles + system seed)
### Step 2: Migrate role enums to role_id FK
### Step 3: Add visibility columns
### Step 4: SQL-level task filtering (boards.rs, tasks.rs, dashboard)
### Step 5: Backend API for roles CRUD
### Step 6: Guest access (table + invitation + scoped API)
### Step 7: Permission audit trail (activity_log extension)
### Step 8: Frontend — project settings visibility UI
### Step 9: Frontend — role management UI (workspace settings)
### Step 10: Frontend — sidebar/dashboard filtering for private projects
### Step 11: Frontend — guest access UI
### Step 12: Testing + verification

## Success Criteria
- [ ] Private projects hidden from non-members in sidebar/search/dashboard
- [ ] Assignee-only mode: members see only their tasks, owners/managers see all
- [ ] Inheritance: workspace default → project override → task list override
- [ ] Custom roles: create/edit/delete with capability matrix
- [ ] Guest access: invite externals to specific projects
- [ ] Audit trail: permission changes logged
- [ ] Existing data unbroken (500 tasks, 4 projects, all roles migrated)
- [ ] API security: permissions enforced server-side
- [ ] Dashboard/search/WebSocket respect visibility

## Also: Sidebar UX Fix
- Move workspace settings to a clickable dropdown (not cluttering sidebar)
- Check existing workspace settings location and consolidate

## Progress Log
- 2026-03-18: Plan created via /plan-ceo-review
- 2026-03-18: Step 1 complete — workspace_roles table migration + model + queries
- 2026-03-18: Step 4 complete — SQL-level visibility filtering added to boards.rs (list_project_tasks_with_badges) and tasks.rs (list_tasks_by_board)
