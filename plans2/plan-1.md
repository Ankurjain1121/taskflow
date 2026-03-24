# Full Roadmap: Subtasks & Checklists Enhancement

## Context

TaskBolt has a basic checklist system (single-level, title + checkbox + position + progress). This roadmap closes gaps against 20+ competitors and targets the Indian market. Research covered Trello, Asana, Jira, Monday, Linear, ClickUp, Notion, Todoist, Height, MS Planner, GitHub Issues, Wrike, Smartsheet, Basecamp, Shortcut, Plane.so, Taskade, Slack Lists, Zoho Projects, Kissflow, ProofHub, Orangescrum, nTask, MeisterTask, Freedcamp.

**Key discovery**: Feature 4 (subtask progress on kanban cards) is **already implemented** — both backend (`list_board_tasks_with_badges`) and frontend (`task-card.component.ts`) already show subtask progress. The `KeyboardShortcutsService`, WhatsApp notification stubs, Gantt view, and task templates also already exist.

---

## Phase 1: Close Critical Gaps

### Feature 1+2: Assignees & Due Dates on Subtask Items (Combined — M)

**Migration** (new file: `backend/crates/db/src/migrations/20260224000001_subtask_enhancements.sql`):
```sql
ALTER TABLE subtasks ADD COLUMN assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE subtasks ADD COLUMN due_date DATE;
CREATE INDEX idx_subtasks_assigned_to ON subtasks(assigned_to_id) WHERE assigned_to_id IS NOT NULL;
CREATE INDEX idx_subtasks_due_date ON subtasks(due_date) WHERE due_date IS NOT NULL;
```

**Backend files to modify:**
| File | Changes |
|------|---------|
| `backend/crates/db/src/models/subtask.rs` | Add `assigned_to_id: Option<Uuid>`, `due_date: Option<NaiveDate>` |
| `backend/crates/db/src/queries/subtasks.rs` | Update all SELECT queries to include new columns; update `create_subtask` and `update_subtask` signatures; LEFT JOIN users for assignee name/avatar |
| `backend/crates/api/src/routes/subtask.rs` | Update `CreateSubtaskRequest` and `UpdateSubtaskRequest` DTOs; add `assignee_name` and `assignee_avatar_url` to response |

**Frontend files to modify:**
| File | Changes |
|------|---------|
| `frontend/src/app/core/services/subtask.service.ts` | Update `Subtask` interface with `assigned_to_id`, `assignee_name`, `assignee_avatar_url`, `due_date`; update create/update methods |
| `frontend/src/app/features/board/subtask-list/subtask-list.component.ts` | Add assignee avatar (clickable dropdown), due date display with overdue/today highlighting, member search for assignment |

**API contract changes:**
- POST `/api/tasks/{task_id}/subtasks` — body adds `assigned_to_id?`, `due_date?`
- PUT `/api/subtasks/{id}` — body adds `assigned_to_id?`, `due_date?`, `clear_assigned_to?`, `clear_due_date?`
- GET `/api/tasks/{task_id}/subtasks` — response adds `assignee_name`, `assignee_avatar_url`, `due_date` per subtask

**Due date visual states:**
| State | Style |
|-------|-------|
| No date | Hidden; calendar-plus icon on hover |
| Future | Muted text, "Mar 15" |
| Today | Amber text, "Today" |
| Overdue | Red text, "Overdue" |
| Completed + overdue | Muted/strikethrough, no urgency |

---

### Feature 3: Drag-to-Reorder UI (S)

**No backend changes** — reorder endpoint and fractional positioning already work.

**Frontend file:** `frontend/src/app/features/board/subtask-list/subtask-list.component.ts`
- Import `CdkDropList`, `CdkDrag`, `CdkDragDrop` from `@angular/cdk/drag-drop` (already installed)
- Wrap subtask list in `cdkDropList`
- Add drag handle (gripper icon, visible on hover)
- Add placeholder template (dashed border)
- `onReorder()`: optimistic `moveItemInArray` + `generateKeyBetween` (already installed) + API call + rollback on error

**Edge cases:** Disable drag while editing; handle rapid successive reorders.

---

### Feature 4: Progress on Kanban Cards (Already Done)

Already implemented:
- Backend: `list_board_tasks_with_badges` includes `subtask_total` and `subtask_completed`
- Frontend: `task-card.component.ts` renders checkmark icon + "3/5" fraction

**Optional polish:** Add tiny progress bar under the fraction in `task-card.component.ts`.

---

## Phase 2: Differentiate

### Feature 5: Parent-Child Task Hierarchy (L)

**Migration** (new file):
```sql
ALTER TABLE tasks ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN depth INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
```

**Backend files:**
| File | Changes |
|------|---------|
| `backend/crates/db/src/models/task.rs` | Add `parent_task_id: Option<Uuid>`, `depth: i32` |
| `backend/crates/db/src/queries/tasks.rs` | Extend `CreateTaskInput` with `parent_task_id`; add `list_child_tasks()`, `reparent_task()`, `compute_task_depth()` (validate max depth 3, detect cycles) |
| `backend/crates/api/src/routes/task_crud.rs` | Validate parent_task_id and depth in create handler |

**New API endpoints:**
- GET `/api/tasks/{task_id}/children` — list child tasks
- PATCH `/api/tasks/{task_id}/reparent` — move task under different parent

**Frontend files:**
| File | Changes |
|------|---------|
| `frontend/src/app/core/services/task.service.ts` | Add `parent_task_id` to `CreateTaskRequest`; add `listChildren()`, `reparentTask()` |
| `frontend/src/app/features/task-detail/task-detail-page.component.ts` | Add "Child Tasks" section |

**New frontend files:**
- `task-children-section.component.ts` — list and manage child tasks
- `task-breadcrumb.component.ts` — show parent chain in task detail header

**Risks:** Circular references → validate by walking parent chain. Deep nesting → cap at depth 3 in app logic.

---

### Feature 6: Auto-Close Parent When All Children Done (M)

**Depends on:** Feature 5

**Migration:**
```sql
ALTER TABLE boards ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
```

Settings: `{ "auto_close_parent": bool, "auto_close_children": bool }` — both default false.

**Backend logic** (in task movement handler):
1. Task moves to "done" column → check `auto_close_parent` → if all siblings done → move parent to done
2. Parent moves to "done" → check `auto_close_children` → move all children to done
3. Limit cascade to 1 level up (prevent infinite chains)
4. Show toast: "Parent task auto-closed because all children are done"

**Files:** Modify `task_movement.rs`, `board.rs` (settings), board-settings UI.

---

### Feature 7: Convert Checklist Item → Task (S)

**Depends on:** Feature 5 (soft — without it, promoted task has no parent)

**New API:** POST `/api/subtasks/{id}/promote` — in a transaction: read subtask → create task (same board/column, carry title/assignee/due_date) → delete subtask → set `parent_task_id` to original task.

**Frontend:** Add "Promote to task" icon button on subtask row (visible on hover, next to delete).

---

### Feature 8: Keyboard Shortcuts (M)

Uses existing `KeyboardShortcutsService` (registration/unregistration/category grouping/input detection already built).

**Shortcuts to register** (in `subtask-list.component.ts`, active when task detail open):
| Key | Action |
|-----|--------|
| `N` or `+` | Create new subtask |
| `Space` | Toggle selected subtask |
| `E` or `Enter` | Edit selected subtask |
| `Delete` | Delete selected subtask |
| `↑` / `↓` | Navigate between subtasks |

Add `selectedIndex` signal for keyboard navigation. Register on init, unregister on destroy.

---

## Phase 3: Indian Market Fit

### Feature 9: Hierarchical Approval Workflows (XL)

**New tables:**
```sql
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'skipped');

CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    trigger_column_id UUID REFERENCES board_columns(id),
    target_column_id UUID REFERENCES board_columns(id),
    is_active BOOLEAN DEFAULT true,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_by_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE approval_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    approver_role user_role,
    approver_user_id UUID REFERENCES users(id),
    auto_approve_after_hours INTEGER,
    UNIQUE(workflow_id, step_order)
);

CREATE TABLE task_approval_requests (...);  -- task_id, workflow_id, current_step, status
CREATE TABLE task_approval_decisions (...); -- request_id, step_id, decided_by_id, decision, comment
```

**Flow:** Task dragged to trigger column → approval request created → step-by-step approvals → on final approval → task moves to target column.

**Backend:** New `approval.rs` routes + models + queries. Intercept column transitions in `task_movement.rs`.
**Frontend:** Board settings UI for workflow config, task detail approval section, "My Approvals" page.

---

### Feature 10: Hindi Language Support — i18n Foundation (L)

- Use `@ngx-translate/core` for runtime translations (no separate builds per locale)
- Create `assets/i18n/en.json` and `assets/i18n/hi.json`
- Store user locale in `user_preferences` JSONB
- Start with: navigation, buttons, task properties, error messages
- Fallback to English for missing keys
- Add language selector in user settings

---

### Feature 11: WhatsApp Notification Integration (M)

**Already exists:** `notification_preferences.whatsapp` boolean column, `WhatsAppError` enum, `send_whatsapp_notification` stubs in services.

**Implementation:**
- Use Twilio WhatsApp API (`reqwest` HTTP calls)
- Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- Add opt-in/verify/opt-out endpoints
- Add `whatsapp_verified` boolean to users table
- Rate limit: max 1 notification per task per hour
- Frontend: WhatsApp settings in user profile (phone, opt-in, verify)

---

### Feature 12: INR Pricing Tiers (M)

**New table:** `pricing_plans` (code, name, price_inr, price_usd, billing_period, limits, features JSONB)
**Seed plans:** Free (₹0), Pro (₹499/mo/team), Business (₹999/mo/team)
**Payment:** Razorpay integration alongside existing Stripe
**Frontend:** Pricing comparison page, Razorpay checkout component

---

## Phase 4: Innovate

### Feature 13: Dual Model — Checklists + Full Subtasks (M)
**Depends on:** Feature 5. Mostly frontend — split task detail into "Checklist" (existing subtasks) and "Sub-tasks" (child tasks from Feature 5). Clear visual distinction: checkboxes vs mini task cards.

### Feature 14: AI-Generated Subtask Suggestions (M)
- POST `/api/tasks/{task_id}/suggest-subtasks` → Claude API (server-side, haiku model for cost)
- "Suggest subtasks" button (sparkle icon) in subtask list
- Preview dialog: accept/modify/reject each suggestion
- Rate limit: 10 suggestions/user/day
- Env var: `ANTHROPIC_API_KEY`

### Feature 15: Subtask Templates Library (M)
- Extend existing `task_templates` + `task_template_subtasks` tables
- Add `is_checklist_only` flag, `category`, `tags` columns
- "Save as template" and "Apply template" actions in subtask list
- Scoped: personal, board, or tenant-level

### Feature 16: Bulk Operations (S)
- Multi-select checkboxes in subtask list
- Bulk actions bar: Complete All, Delete Selected, Reassign
- Confirmation dialog for destructive actions
- POST `/api/tasks/{task_id}/subtasks/bulk-toggle` and `/bulk-delete`

### Feature 17: Gantt Chart with Subtask Dependencies (L)
**Depends on:** Feature 5. Extend existing `gantt-view.component.ts` — add nested bars, expand/collapse, drag-to-adjust dates, critical path highlighting. Consider existing libraries vs custom SVG.

---

## Implementation Sequence & Dependencies

```
PHASE 1 (no dependencies)
  Migration → Feature 3 (DnD) → Feature 1+2 (Assignee+Date) → Feature 4 (polish)

PHASE 2
  Feature 5 (Parent-Child) ──► Feature 6 (Auto-Close)
       │                   ──► Feature 7 (Promote)
       │
  Feature 8 (Shortcuts) ← independent

PHASE 3 (all independent)
  Feature 11 (WhatsApp) → Feature 10 (Hindi) → Feature 12 (Pricing) → Feature 9 (Approvals)

PHASE 4
  Feature 13 (Dual Model) ← needs Feature 5
  Feature 14 (AI) ← independent
  Feature 15 (Templates) ← independent
  Feature 16 (Bulk) ← independent
  Feature 17 (Gantt) ← needs Feature 5
```

## Effort Summary

| Feature | Phase | Size | Depends On |
|---------|-------|------|------------|
| 1+2. Assignees + Due Dates | 1 | M | — |
| 3. Drag-to-Reorder UI | 1 | S | — |
| 4. Kanban Progress (polish) | 1 | S | — |
| 5. Parent-Child Hierarchy | 2 | L | — |
| 6. Auto-Close Parent | 2 | M | #5 |
| 7. Convert Checklist→Task | 2 | S | #5 (soft) |
| 8. Keyboard Shortcuts | 2 | M | — |
| 9. Approval Workflows | 3 | XL | — |
| 10. Hindi i18n | 3 | L | — |
| 11. WhatsApp Notifications | 3 | M | — |
| 12. INR Pricing | 3 | M | — |
| 13. Dual Model | 4 | M | #5 |
| 14. AI Subtask Suggestions | 4 | M | — |
| 15. Subtask Templates | 4 | M | — |
| 16. Bulk Operations | 4 | S | — |
| 17. Gantt Enhanced | 4 | L | #5 |

## Success Criteria

### Phase 1
- [ ] Subtask items support assignee (avatar inline, dropdown to assign from board members)
- [ ] Subtask items support due date (inline display, overdue in red, today in amber)
- [ ] Drag-to-reorder works with smooth animation and gripper handle
- [ ] All changes pass `./scripts/quick-check.sh`
- [ ] No performance regression (subtask queries < 50ms)

### Phase 2
- [ ] Tasks can have child tasks (up to 3 levels deep)
- [ ] Parent auto-closes when all children done (configurable per board)
- [ ] Checklist items can be promoted to full tasks
- [ ] Keyboard shortcuts work for subtask management

### Phase 3
- [ ] Board column transitions can require multi-step approval
- [ ] UI renders in Hindi with fallback to English
- [ ] WhatsApp notifications delivered for task assignments/due dates
- [ ] Pricing page shows INR plans with Razorpay checkout

### Phase 4
- [ ] Task detail shows both "Checklist" and "Sub-tasks" sections
- [ ] AI generates 3-7 relevant subtask suggestions from task context
- [ ] Checklist templates can be saved and applied
- [ ] Multi-select + bulk actions work on subtasks
- [ ] Gantt shows nested child tasks with dependency arrows

## Verification

After each phase:
1. Run `./scripts/quick-check.sh` (backend cargo check + clippy + frontend tsc + build)
2. Test manually on https://taskflow.paraslace.in
3. Verify WebSocket real-time updates reflect changes
4. Test on mobile viewport (Chrome DevTools responsive mode)
