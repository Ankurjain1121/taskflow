# TODOS

## TODO-001: Refactor board membership verification (DRY)
**Priority:** Low | **Depends on:** Phase 1 completion

Extract `verify_project_membership(pool, project_id, user_id)` shared function (created in Phase 1 for time_entries.rs) and replace all ~6 inline copies across:
- `task_crud.rs`
- `task_helpers.rs`
- `task_movement.rs`
- `attachment.rs`
- `comments.rs`

**Why:** DRY violation — each copy is slightly different inline SQL doing `SELECT EXISTS(SELECT 1 FROM project_members ...)`. Risk of divergence if project_members schema changes.

---

## TODO-002: Auth-before-write pattern audit
**Priority:** Medium (security) | **Depends on:** Nothing

Audit all route handlers for the anti-pattern where SQL UPDATE/INSERT executes BEFORE authorization is checked. Found in `column.rs` (rename_status, update_status_type) — likely exists in other route files too.

**Why:** Unauthorized writes can execute before role check. JWT middleware blocks unauthenticated users, but a valid Member-role token could trigger Owner-only writes before the role check catches it.

**Where to start:** `grep -rn "require_editor_access\|require_viewer_access" backend/crates/api/src/routes/` and check if the call comes after any SQL mutation.

---

## TODO-003: Assignee column in list view
**Priority:** Medium | **Depends on:** Phase 1 inline editing

Add assignee column to list-view.component.ts with member-picker dropdown for inline assignment. Requires:
- Loading project members into list view
- Adapting `MemberPickerComponent` for inline cell use
- Handling multi-assignee display (avatar stack)
- PATCH task assignee on selection

**Why:** Zoho's list view shows assignees. Power users expect to reassign from list view without opening task detail.
