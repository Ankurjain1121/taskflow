# WhatsApp Notification Enhancement

## Objective
Enhance WhatsApp notifications with rich detail, button messages, org-level daily reports, subtask escalation, and real-time task closure alerts to workspace admins.

## Key Decisions
- Use WAHA `/api/sendButtons` with URL button type, **with plain-text fallback** (buttons are deprecated/fragile)
- `NotificationMetadata` struct added to `notify()` for rich context (actor, project, due date/time, priority)
- Watchers = task-level concept (existing `task_watchers` table)
- Admin = workspace `admin` role (not super admin), queried from `workspace_members`
- `TaskUpdatedWatcher` event already exists but unused — activate it
- Daily org report at 8 AM IST to workspace admins/owners
- Subtask overdue → escalate to parent task watchers

## Implementation Plan

### Phase 1: WahaClient button support + message builder
- [ ] Add `SendButtonPayload` struct and `send_button_message()` to `whatsapp.rs`
- [ ] Fallback: if `/api/sendButtons` fails, retry with `/api/sendText`
- [ ] Create `WhatsAppMessageBuilder` for formatting rich messages with sections

### Phase 2: NotificationMetadata + enhanced notify()
- [ ] Create `NotificationMetadata` struct (actor_name, project_name, due_date, due_time, priority, task_id)
- [ ] Update `notify()` signature to accept `Option<&NotificationMetadata>`
- [ ] Update WhatsApp dispatch to format rich messages using metadata
- [ ] Update all 5 call sites (task_crud, task_movement, task_collaboration, comments x2)

### Phase 3: Task closure → workspace admin real-time alert
- [ ] New DB query: `get_workspace_admin_phones(pool, workspace_id)` → Vec<(user_id, name, phone)>
- [ ] In `task_movement.rs`: when status type = "done", send instant WhatsApp to workspace admins
- [ ] Message: who closed it, task name, project, completion time

### Phase 4: Subtask notifications
- [ ] On subtask completion: notify parent task watchers with progress (3/5 done)
- [ ] On subtask overdue (daily digest): escalate to parent task watchers
- [ ] Include parent task context in subtask assignee reminders

### Phase 5: Enhanced daily digest
- [ ] Org report for workspace admins: tasks completed today (incl subtasks), per-employee breakdown
- [ ] Assignee daily report: include subtask reminders with parent context, due TIME emphasis
- [ ] Watcher report: status of watched tasks + subtask progress

## Success Criteria
- [ ] WhatsApp event notifications include: actor, project, due date+time, remaining time, button link
- [ ] Task closure sends instant WhatsApp to workspace admins with full context
- [ ] Subtask completion notifies parent task watchers with progress fraction
- [ ] Overdue subtasks escalate to parent task watchers in daily digest
- [ ] Daily org report sent to workspace admins at 8 AM IST with per-employee breakdown
- [ ] All messages use button format with plain-text fallback
- [ ] Backend compiles clean (cargo check + clippy)

## Progress Log
- 2026-04-13: Plan created. Research complete on WAHA button API, DB schema, notification architecture.
