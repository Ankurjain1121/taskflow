# Phase J: Technical Implementation Plan
*Generated as part of UltraPlan Phase 3: PLAN*

---

## Overview

Phase J ships three major features (Tier 1 + Tier 2):
1. **Automation Templates** — Pre-built, one-click rules
2. **Team Dashboards & Metrics** — Multi-level performance visibility
3. **Bulk Operations with Undo** — Safe mass updates + reversibility

This document breaks work into executable tasks with dependencies, risk ratings, and estimated complexity.

---

## Architecture Decisions

### 1. Automation Templates
- **Approach**: Template-based (pre-built rules), not visual builder
- **Storage**: New `automation_templates` table (enabled/disabled per workspace)
- **Execution**: Reuse existing automation engine (triggers, actions, executor job)
- **Safety**: Add rate limiting + circular dependency detection to executor
- **Lifecycle**: Template enables → runs via scheduler job (async, not real-time)

### 2. Team Dashboards & Metrics
- **Architecture**: Materialized views (PostgreSQL) + WebSocket updates + polling
- **Data**: Pre-computed metrics (cycle time, velocity, workload, on-time %)
- **Refresh**: Materialized views updated every 1 hour + manual refresh button
- **Real-Time**: WebSocket pushes task updates to dashboard (soft real-time, 1-5 sec delay)
- **Visualization**: PrimeNG Charts (Angular 19 compatible, already in deps)
- **Storage**: Separate schema `public.metrics_*` views (don't mix with task data)

### 3. Bulk Operations with Undo
- **Pattern**: Command Pattern (execute + undo) + JSONB audit log
- **Storage**: `bulk_operations` table (logs every bulk action) + Redis for undo queue (1 hour TTL)
- **Confirmation**: Multi-step UI (Select → Preview → Confirm)
- **Limits**: Max 500 tasks per bulk action (prevent accidents)
- **Audit**: Every bulk op logged with user, timestamp, affected tasks, action type

---

## Database Schema Changes

### New Tables

#### `automation_templates`
```sql
CREATE TABLE automation_templates (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL,           -- e.g., "task_status_change"
  trigger_config JSONB NOT NULL,                -- {"status": "completed"}
  action_type VARCHAR(50) NOT NULL,             -- e.g., "mark_task_done"
  action_config JSONB NOT NULL,                 -- {"mark_status": "done"}
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
```

#### `bulk_operations`
```sql
CREATE TABLE bulk_operations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action_type VARCHAR(50) NOT NULL,            -- "move_to_column", "reassign", etc.
  action_config JSONB NOT NULL,                -- {"destination_column": "..."}
  affected_task_ids UUID[] NOT NULL,
  changes_summary JSONB NOT NULL,              -- { before: {...}, after: {...} }
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,               -- created_at + 1 hour
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX ON created_at DESC,
  INDEX ON expires_at
);
```

### Materialized Views

#### `metrics_cycle_time_by_week`
```sql
CREATE MATERIALIZED VIEW metrics_cycle_time_by_week AS
SELECT
  workspace_id,
  DATE_TRUNC('week', t.completed_at)::DATE AS week_start,
  AVG(EXTRACT(DAY FROM t.completed_at - t.created_at)) AS avg_days,
  COUNT(*) AS task_count
FROM tasks t
WHERE t.completed_at IS NOT NULL
GROUP BY workspace_id, DATE_TRUNC('week', t.completed_at);

CREATE INDEX idx_metrics_cycle_time_workspace ON metrics_cycle_time_by_week(workspace_id);
```

#### `metrics_workload_by_person`
```sql
CREATE MATERIALIZED VIEW metrics_workload_by_person AS
SELECT
  workspace_id,
  assigned_to,
  COUNT(*) AS open_task_count,
  AVG(priority_score) AS avg_priority
FROM tasks
WHERE status NOT IN ('done', 'archived')
GROUP BY workspace_id, assigned_to;
```

#### `metrics_task_velocity`
```sql
CREATE MATERIALIZED VIEW metrics_task_velocity AS
SELECT
  workspace_id,
  DATE_TRUNC('week', completed_at)::DATE AS week_start,
  COUNT(*) AS tasks_completed
FROM tasks
WHERE completed_at IS NOT NULL
GROUP BY workspace_id, DATE_TRUNC('week', completed_at);
```

### Indexes to Add
```sql
-- For dashboard queries
CREATE INDEX idx_tasks_workspace_status_created ON tasks(workspace_id, status, created_at);
CREATE INDEX idx_tasks_workspace_assigned_status ON tasks(workspace_id, assigned_to, status);
```

---

## Backend Implementation (Rust/Axum)

### Work Item 1: Automation Templates CRUD + Safety
**Complexity**: HIGH | **Risk**: MEDIUM | **Dependencies**: Existing automation engine

**Tasks**:
1. Implement `AutomationTemplate` model (`backend/crates/db/src/models/automation_template.rs`)
2. Implement CRUD queries (`backend/crates/db/src/queries/automation_templates.rs`)
3. Create routes: GET /workspaces/{id}/automation-templates, POST (create), PATCH (enable/disable)
4. Add circular dependency detection to automation executor
5. Add rate limiting: Max 1000 automations/workspace/day (Redis-backed counter)
6. Add timeout: Kill rules running >30 seconds
7. Test: Unit tests for circular detection, rate limiting

**Deliverable**:
- 3 API endpoints (list, create, toggle)
- Safety layer prevents runaway automations
- Audit logging for every template execution

---

### Work Item 2: Dashboard Metrics Calculation
**Complexity**: MEDIUM | **Risk**: MEDIUM | **Dependencies**: Materialized views, PostgreSQL

**Tasks**:
1. Create migration: Add materialized views + indexes
2. Implement metric calculation functions (Rust, called by scheduler job)
   - `calculate_cycle_time()` - from created_at to first "done" status
   - `calculate_velocity()` - count tasks completed per week
   - `calculate_workload()` - open task count per person
3. Add scheduler job to refresh materialized views every 1 hour
4. Implement dashboard API endpoints:
   - GET /workspaces/{id}/dashboards/workspace (cycle time, velocity, etc.)
   - GET /teams/{id}/dashboards/team (team-specific metrics)
   - GET /dashboards/personal (current user's metrics)
5. Test: Verify metrics on 10K task dataset, compare manual vs calculated

**Deliverable**:
- 3 API endpoints returning dashboard data
- Materialized views auto-refresh every hour
- <2 second response time verified

---

### Work Item 3: Bulk Operations Engine
**Complexity**: HIGH | **Risk**: HIGH | **Dependencies**: Command pattern, transaction support

**Tasks**:
1. Implement `BulkOperation` model + storage (`backend/crates/db/src/models/bulk_operation.rs`)
2. Implement Command Pattern executors:
   - `MoveToColumnCommand` - Move tasks between columns
   - `ReassignCommand` - Change task assignee
   - `UpdateFieldCommand` - Update custom fields
3. Implement multi-step API:
   - POST /bulk-operations/preview (validate, return what will change)
   - POST /bulk-operations/execute (run command, store in undo queue)
   - POST /bulk-operations/{id}/undo (reverse command within 1 hour)
4. Add Redis-backed undo queue (1-hour TTL, per-user session)
5. Add transaction support (rollback on error)
6. Test: Move 100 tasks, verify preview, test undo, verify audit log

**Deliverable**:
- 3 API endpoints (preview, execute, undo)
- All bulk operations reversible within 1 hour
- Audit trail for compliance

---

## Frontend Implementation (Angular 19)

### Work Item 4: Automation Templates UI
**Complexity**: MEDIUM | **Risk**: LOW | **Dependencies**: PrimeNG, existing task services

**Tasks**:
1. Create component: `AutomationTemplatesComponent` (`frontend/src/app/features/board/automation-templates/`)
   - Gallery view: 15-20 template cards with descriptions
   - Enable/disable toggle per template
   - Read-only for Phase J (no custom rule builder)
2. Create service: `AutomationService` (`frontend/src/app/core/services/automation.service.ts`)
   - Fetch templates: `getTemplates(workspaceId)`
   - Enable/disable: `toggleTemplate(templateId, enabled)`
   - View audit log: `getTemplateAuditLog(templateId)`
3. Add UI to board settings: "Automations" tab in board settings panel
4. Show automation status: Small badge on board showing "3 automations active"
5. Test: E2E test - enable template, verify audit log update

**Deliverable**:
- Automation templates gallery UI (read-only, one-click enable)
- Audit log view showing what each template did

---

### Work Item 5: Team Dashboards UI
**Complexity**: MEDIUM | **Risk**: MEDIUM | **Dependencies**: PrimeNG Charts, existing board service

**Tasks**:
1. Create component: `TeamDashboardComponent` (`frontend/src/app/features/dashboard/team-dashboard/`)
   - Multi-level tabs: Workspace / Team / Personal
   - 4 key metrics: Cycle time, On-time %, Velocity, Workload balance
   - Charts: Line chart (cycle time trend), Bar chart (workload), Gauge (on-time %)
   - Date range picker: Filter by last 1/2/4 weeks
   - Manual refresh button + auto-refresh every 1 minute
2. Create service: `DashboardService` (`frontend/src/app/core/services/dashboard.service.ts`)
   - Fetch workspace metrics: `getWorkspaceDashboard(workspaceId, dateRange)`
   - Fetch team metrics: `getTeamDashboard(teamId, dateRange)`
   - Fetch personal metrics: `getPersonalDashboard(dateRange)`
3. Add CSV export: "Export as CSV" button
4. Add WebSocket listener: Update dashboard when tasks change (soft real-time)
5. Test: E2E test - open dashboard, verify metrics, export CSV

**Deliverable**:
- Multi-level dashboard UI with 4 key metrics
- <2 second load time verified
- CSV export working

---

### Work Item 6: Bulk Operations UI
**Complexity**: HIGH | **Risk**: HIGH | **Dependencies**: Task selection, Angular animations, board state

**Tasks**:
1. Add selection mode to board: Toggle "select mode" via checkbox in toolbar
   - Checkboxes appear on all task cards
   - Counter shows "N tasks selected"
   - Clear selection button
2. Create component: `BulkOperationsToolbarComponent` (appears when ≥1 task selected)
   - Action buttons: "Move to column", "Reassign", "Update field", "Delete", "Export"
3. Implement preview dialog: `BulkOperationsPreviewComponent`
   - Show exact list of tasks that will change
   - Show before/after state for each task
   - Confirmation required before execute
4. Implement undo: Show "Undo bulk operation (58 min left)" in top right
   - Click to reverse
   - Automatically disappear after 1 hour
5. Integrate with board state service: Track selection across columns
6. Test: E2E test - select 50 tasks, preview, execute, verify undo

**Deliverable**:
- Full bulk operations UI with preview + confirmation
- Undo working within 1-hour window
- <500ms preview response time

---

## Testing Strategy

### Unit Tests (Backend)
- Automation template circular dependency detection
- Rate limiting logic
- Materialized view calculations (sample data)
- Bulk operation command execution
- Undo queue TTL logic

**Coverage target**: 80%+ for new code

### Integration Tests (Backend)
- Enable template → run on sample data → verify audit log
- Bulk operation → execute → verify database state → undo → verify reversal
- Dashboard metrics → query 10K tasks → verify response <2 seconds

### E2E Tests (Frontend)
- Enable automation template → verify audit log updates
- Open dashboard → verify 4 metrics load → change date range → verify update
- Select 50 tasks → click preview → verify preview shows exact tasks → confirm → verify undo button appears
- Click undo → verify tasks reverted to previous state

**Target**: 50+ E2E tests covering critical user flows

---

## Deployment Plan

### Phase J Release (Phased Rollout)

**Week 1: Internal Testing**
- Deploy to staging
- Run full test suite (unit, integration, E2E)
- Load test: 1000 concurrent users on dashboard
- Manual QA: Run through all critical flows

**Week 2: Early Access**
- Deploy to production with feature flag (default: disabled)
- Enable for 10% of workspaces
- Monitor: Dashboard load times, automation error rates, bulk operation undo success
- Collect feedback via in-app survey

**Week 3: Wide Release**
- Enable for 100% of workspaces
- Continue monitoring (next 2 weeks)
- Watch for: Adoption rate, support tickets, performance anomalies

---

## Success Criteria (For This Plan)

- ✅ All database migrations run without errors
- ✅ All backend endpoints tested (unit + integration)
- ✅ All frontend components load without errors
- ✅ Dashboard <2 second load time on 10K tasks
- ✅ Bulk operation undo works within 1 hour window
- ✅ 50+ E2E tests pass
- ✅ 0 critical security issues (security review completed)
- ✅ 80%+ test coverage on new code

---

## Next Steps

1. **Review Phase**: Internal review of technical plan (architecture, DB schema, API design)
2. **Approval**: User approves technical plan
3. **Implementation**: Start backend work (automation templates, then metrics, then bulk ops)
4. **Iteration**: Parallel frontend development, continuous testing

---

*Last updated: Session 2026-03-03*
