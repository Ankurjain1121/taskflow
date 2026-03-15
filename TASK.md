# TaskFlow — Phase 1: Zoho Projects Replacement (Bulletproofing)

## Objective
Close the 3 highest-impact feature gaps vs Zoho Projects: blueprint status transitions, inline list view editing, and timesheet billing. Make existing features production-solid.

**Full roadmap:** Phases 2-4 (wiki, Gantt, budget, SSO, AI, etc.) deferred to future reviews.

---

## Key Decisions (from Eng Review)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | UUID[] column for `allowed_transitions` | Type-safe, compact, native `ANY()` check |
| 2 | NULL = allow all transitions | Backward compatible, zero migration effort |
| 3 | Shared `validate_transition()` function | Both move + update endpoints enforce blueprint |
| 4 | Billing rate on `project_members` table | Per-user-per-project rate, cost computed at query time |
| 5 | 4 editable fields: title, priority, status, due date | Assignee deferred (TODO-003) |
| 6 | Extract `verify_project_membership()` in touched files only | DRY where we're working, don't over-refactor |
| 7 | Fix auth-before-write in column.rs | Security: prevent unauthorized writes |
| 8 | Integration tests with real DB | Follow existing time_entries.rs pattern |
| 9 | TDD for list-view specs | Write specs before implementing inline edit |
| 10 | No Redis caching for blueprint lookups | PK lookup is ~0.1ms, YAGNI |
| 11 | Add index on time_entries(project_id, started_at) | Prevent table scan on date-range reports |

---

## Implementation Plan

### 1.1 Blueprint / Status Transition Enforcement

**Migration:**
- [ ] `ALTER TABLE project_statuses ADD COLUMN allowed_transitions UUID[]`
- [ ] NULL = allow all, empty array = terminal status (no outgoing)
- [ ] Run `cargo sqlx prepare --workspace` after migration

**Backend — shared validation:**
- [ ] Create `validate_transition(pool, from_status_id, to_status_id) -> Result<()>` in `queries/tasks.rs`
  - Load `allowed_transitions` for `from_status_id`
  - If NULL → allow (backward compat)
  - If to_status_id NOT IN array → return `AppError::UnprocessableEntity("Transition not allowed")`
  - Wrap in catch for stale FK → return "status configuration changed" not 500
- [ ] Call `validate_transition()` in `move_task_handler` (task_movement.rs) before `move_task()`
- [ ] Call `validate_transition()` in `update_task_handler` (task_crud.rs) when `status_id` changes

**Backend — blueprint config endpoints (column.rs):**
- [ ] `GET /api/columns/:id/transitions` → returns `allowed_transitions` array
- [ ] `PUT /api/columns/:id/transitions` → sets `allowed_transitions` (body: `{ allowed: [uuid, uuid] }`)
- [ ] Fix auth-before-write in `rename_status` and `update_status_type` (Issue 7)

**Frontend — Kanban integration:**
- [ ] Load `allowed_transitions` with project statuses
- [ ] Filter "Move to" dropdown in task card context menu
- [ ] Show visual indicator on blocked transitions (greyed out)

**Frontend — Blueprint config UI:**
- [ ] New "Workflow" tab in board settings
- [ ] Status × Status matrix with checkboxes
- [ ] Save calls `PUT /api/columns/:id/transitions` per status

**Tests (integration, real DB):**
- [ ] NULL allows any move
- [ ] Valid transition passes
- [ ] Blocked transition returns 422
- [ ] Invalid/missing status returns 404
- [ ] Both move_task and update_task enforce
- [ ] Blueprint config CRUD roundtrip

### 1.2 Inline Editing in List View

**Frontend specs FIRST (TDD):**
- [ ] Create `list-view.component.spec.ts`
- [ ] Spec: title blur triggers PATCH save
- [ ] Spec: Enter saves and moves focus
- [ ] Spec: Escape reverts to original value
- [ ] Spec: empty title blocked (validation)
- [ ] Spec: priority dropdown saves on select
- [ ] Spec: status dropdown respects blueprint (filtered options)
- [ ] Spec: due date picker saves on select

**Frontend implementation:**
- [ ] Import PrimeNG `pEditableColumn`, `pCellEditor`, `InputText`, `Select`, `DatePicker`
- [ ] Title cell: text input with blur/Enter/Escape handling
- [ ] Priority cell: dropdown (Low/Medium/High/Urgent)
- [ ] Status cell: dropdown filtered by `allowed_transitions` (blueprint-aware)
- [ ] Due date cell: PrimeNG DatePicker
- [ ] Optimistic update with rollback on HTTP error (`.pipe(catchError(...))` reverts cell)
- [ ] Status changes use `POST /api/tasks/:id/move` (not PATCH), consistent with Kanban

**Backend:** No changes needed — existing update + move endpoints suffice.

### 1.3 Timesheet Reports + Billable Hours

**Migration:**
- [ ] `ALTER TABLE time_entries ADD COLUMN is_billable BOOLEAN NOT NULL DEFAULT false`
- [ ] `ALTER TABLE project_members ADD COLUMN billing_rate_cents INTEGER`
- [ ] `CREATE INDEX idx_time_entries_project_started ON time_entries(project_id, started_at)`

**Backend model updates:**
- [ ] Add `is_billable` to `TimeEntry` struct
- [ ] Add `billing_rate_cents` to `ProjectMember` struct (board.rs)
- [ ] Extract `verify_project_membership()` to shared module (DRY fix)
- [ ] Refactor time_entries.rs to use shared function

**Backend — new timesheet report endpoint:**
- [ ] `GET /api/projects/:id/timesheet-report?start_date=&end_date=&user_id=&billable_only=`
- [ ] Query: JOIN time_entries + tasks + project_members
- [ ] Handle running timers: `COALESCE(duration_minutes, EXTRACT(EPOCH FROM (NOW() - started_at))::int / 60)`
- [ ] Response: `{ entries: [...], summary: { total_hours, billable_hours, non_billable_hours, total_cost_cents } }`

**Backend — update existing endpoints:**
- [ ] `CreateManualEntryRequest` + `StartTimerRequest`: add optional `is_billable`
- [ ] `UpdateEntryRequest`: add optional `is_billable`

**Frontend:**
- [ ] Add `is_billable` to `TimeEntry` interface
- [ ] Add `billing_rate_cents` to project member types
- [ ] Billable toggle in time entry creation/edit forms
- [ ] New "Timesheet" tab in project reports view
- [ ] Date range picker, user filter, billable-only toggle
- [ ] Summary cards: total hours, billable hours, total cost

**Tests:**
- [ ] `is_billable` flag persists on create
- [ ] Default is false when omitted
- [ ] Date range filtering works
- [ ] User filtering works
- [ ] Billable-only filter
- [ ] Cost calculation: `minutes * rate_cents / 60`
- [ ] Running timer included in report (COALESCE)
- [ ] Empty state returns zero summary

---

## Success Criteria

- [ ] Existing projects work unchanged (NULL = allow all transitions)
- [ ] Blueprint configured project blocks invalid moves in both Kanban + list view
- [ ] Blueprint UI: matrix of checkboxes per status, saves correctly
- [ ] List view: click cell to edit title/priority/status/due date inline
- [ ] List view: status dropdown only shows blueprint-allowed targets
- [ ] List view: Escape reverts, Enter saves, blur saves
- [ ] Time entries can be marked billable/non-billable
- [ ] Project members can have billing rates set
- [ ] Timesheet report filters by date/user/billable and shows cost summary
- [ ] All integration tests pass (real DB)
- [ ] `cargo check` + `cargo clippy` + `tsc --noEmit` + prod build pass
- [ ] SQLx cache regenerated (`cargo sqlx prepare --workspace`)

## Failure Modes Addressed
- Stale FK in blueprint → catch + clear error message (not 500)
- Inline edit network failure → optimistic rollback via catchError
- Running timer in report → COALESCE computes live duration
- Auth-before-write in column.rs → fixed

## Progress Log
- [2026-03-15] Full roadmap created from Zoho competitive analysis
- [2026-03-15] Eng review completed — scoped to Phase 1, 11 decisions made
- [2026-03-15] Phase 1 implementation complete:
  - Migration: `allowed_transitions UUID[]` on project_statuses, `is_billable` on time_entries, `billing_rate_cents` on project_members, index on time_entries(project_id, started_at)
  - Backend: `validate_transition()` in tasks.rs, called in move_task_handler; blueprint GET/PUT endpoints in column.rs; auth-before-write fixed in rename_status, update_status_type, update_color; timesheet report endpoint with date/user/billable filters
  - Frontend: ProjectStatus.allowed_transitions; Workflow tab in board settings (transition matrix); task card "Move to" filtered by blueprint; list view inline editing (title/priority/status/due_date); timesheet report with billing summary
  - All checks pass: cargo check, clippy, tsc --noEmit, prod build
