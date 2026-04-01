# Logic Audit: Board → Project Naming Inconsistency

**Date:** 2026-04-01
**Commit:** `e2c5ed9` (master)
**Focus:** Semantic mismatch — "board" references surviving the rename to "project"
**Health Score:** 38/100

```
CRITICAL: 4 | HIGH: 7 | MEDIUM: 5 | LOW: ~20 cosmetic
```

---

## Fix These 11 Things This Week

### 1. [CRITICAL] Presence WS messages use wrong type names — viewers list completely broken

**Frontend:** `presence.service.ts:27,33` sends `{ type: "join_board" }` and `{ type: "leave_board" }`
**Backend:** Expects `"presence_join"` / `"presence_leave"` (serde rename of `PresenceJoin`/`PresenceLeave`)

Backend deserializes `"join_board"` → unknown variant → error. **Live presence never works.** Viewers list is always empty. Heartbeats are ignored.

**Fix:** Change frontend to send `"presence_join"` / `"presence_leave"`. ~2 min.

### 2. [CRITICAL] `all-tasks` reads `board_id`/`board_name` — backend sends `project_id`/`project_name`

**Frontend:** `all-tasks.component.ts:35-36` — `AllTask` interface has `board_id: string`, `board_name: string`
**Backend:** `workspace_tasks.rs` serializes `project_id`, `project_name`

Result: `task.board_id` is `undefined` → navigation goes to `/project/undefined`. Project name column is blank.

**Fix:** Rename fields in the `AllTask` interface + all template bindings. ~10 min.

### 3. [CRITICAL] `all-tasks` project filter param silently ignored

**Frontend:** `all-tasks.component.ts:348` sends `?board_id=xxx`
**Backend:** `WorkspaceTaskFilters` has no `board_id` field — serde ignores unknown keys

Result: Selecting a project filter does nothing. All tasks always shown.

**Fix:** Change param to `project_id` in frontend AND add `project_id` to `WorkspaceTaskFilters` in backend. ~15 min.

### 4. [CRITICAL] Audit middleware matches `/api/boards/` but routes are `/api/projects/`

**Backend:** `middleware/audit.rs:161,169-171` pattern-matches `["api", "boards", ...]`
**Reality:** Routes are registered as `/api/projects/...`

Result: Audit logging for project create/update/delete is **silently skipped**. The audit log has a blind spot for all project CRUD.

**Fix:** Update match patterns from `"boards"` to `"projects"`. Also fix `extract_entity_from_path` at line 208. ~5 min.

### 5. [HIGH] Presence Redis key `presence:board:{id}` diverges from naming convention

**Backend:** `services/presence.rs:32` — `format!("presence:board:{}", board_id)`

Currently self-consistent (reads/writes both use `board`), but any new code expecting `presence:project:` will see 0 viewers. Rename when fixing presence.

### 6. [HIGH] `project_template.rs` API response returns `{"board_id": ...}`

**Backend:** `routes/project_template.rs:116` — `Ok(Json(json!({ "board_id": board_id })))`
**Frontend expects:** `project_id` after creating from template

Result: Frontend receives `board_id` field, reads `project_id` → `undefined`. Template creation succeeds but the redirect afterward fails.

**Fix:** Change to `"project_id"`. ~1 min.

### 7. [HIGH] WS event payloads use `"board_id"` key in 3 places

| File | Line | Event |
|---|---|---|
| `task_crud.rs` | 496 | Task duplicate broadcast |
| `task_collaboration.rs` | 120 | Task assign/unassign broadcast |
| `automation/actions.rs` | 447 | Automation action broadcast |

All send `"board_id": board_id` in JSON. Frontend WS handlers that read `project_id` get `undefined`.

**Fix:** Change all to `"project_id"`. ~5 min.

### 8. [HIGH] `MyTaskItem` serializes `board_id`/`board_name` to frontend

**Backend:** `db/queries/my_tasks.rs:20-21` — struct fields `board_id`, `board_name`
**SQL:** `t.project_id as board_id` (aliases correctly)

The My Tasks API returns `board_id`/`board_name`. If the frontend reads `project_id`, those are undefined.

**Fix:** Rename struct fields to `project_id`/`project_name`, update SQL alias. ~5 min.

### 9. [HIGH] Search API returns `board_id`/`board_name` fields

**Backend:** `db/queries/search.rs:10-56` — `TaskSearchResult`, `SubtaskSearchResult`, `SearchFilters` all use `board_id`/`board_name`

Search results sent to frontend have old field names.

**Fix:** Rename struct fields, update SQL aliases. ~10 min.

### 10. [HIGH] All notification payloads use `board_id`/`board_name`

**Backend:** `services/notifications/events.rs:98-154` — 6 payload structs (`TaskAssigned`, `TaskDueSoon`, `TaskOverdue`, `TaskCompleted`, `MentionInComment`, `TaskCommented`)

These are stored as JSON in the DB and rendered in the notification panel. If the renderer expects `project_id`/`project_name`, links are broken and project context is missing.

**Fix:** Rename in all 6 structs. ~15 min. Note: existing notification rows in DB still have `board_id` — the renderer needs a fallback `project_id ?? board_id` during transition.

### 11. [HIGH] Dashboard `OverdueTask`/`UpcomingDeadline` types have `board_id`

**Frontend:** `dashboard.service.ts:44,59` — interfaces declare `board_id: string`
**Backend:** Serializes `project_id: Uuid`

`board_id` is always `undefined`. Currently not used for routing, but the type contract is broken.

**Fix:** Rename to `project_id` in the interface. ~2 min.

---

## Medium Findings

| # | Location | Issue |
|---|---|---|
| M1 | `archive.rs:68` | Entity type literal `'board'` in SQL — should be `'project'` if trash/archive UI filters by entity type |
| M2 | `audit.rs:208` | `extract_entity_from_path` maps `"boards"` → `"board"` but `/projects/` requests fall through |
| M3 | `task-detail-page.component.ts:396` | Defensive fallback `project_id ?? board_id` — dead code, reveals uncertainty |
| M4 | `project-state.service.ts:305,380` | Reads `project_id` via `unknown` cast — works but fragile |
| M5 | `PresenceUpdate` WS event (`ws_events.rs:43`) | Field named `board_id` — just regenerated via ts-rs, will show as `board_id` in generated TypeScript |

---

## Low / Cosmetic (~20 items)

- **Function names:** `broadcast_board_event`, `get_task_board_id`, `list_tasks_by_board`, `save_board_as_template`, `board_columns_router`, etc. — all function names, not runtime keys
- **Route path params:** `{board_id}` in URL templates like `/projects/{board_id}/tasks` — matches the Axum extractor `Path(board_id)` so it works, but reads oddly
- **Type name:** `WsBoardEvent` — just renamed `Status*` → `Column*` variants, but the enum itself is still called "Board"
- **Service method names:** `getBoard()`, `updateBoard()`, `duplicateBoard()` in `project.service.ts` — URLs are correct, only names are legacy

---

## Root Cause Analysis

The rename was applied correctly at the **database schema** and **route URL** level. The places it was missed are:

1. **Rust struct field names** → these are directly serialized as JSON keys via serde. Renaming a route URL doesn't rename the JSON fields.
2. **Frontend interface fields** → were updated in some places but not others (esp. `AllTask`, dashboard types)
3. **WS message types** → the `serde(rename_all = "snake_case")` on the backend enum produces names like `presence_join`, but the frontend was manually coded to send `join_board`
4. **String literals** → `"board_id"` in `json!({})` macros, `'board'` in SQL, `"presence:board:"` in Redis keys — none are caught by a type-system rename

## The Pattern

Every bug here is a **string literal** or **struct field name** that the compiler can't check. The ts-rs pipeline we just set up catches the struct field names (#5, #7, #8, #9, #10, #11) because they go through `#[derive(TS)]`. The string literals (#1 presence message types, #4 audit middleware, WS event JSON keys) need manual grep.

**Recommendation:** After fixing these, add all notification payload structs and search result structs to the ts-rs `#[derive(TS)]` export so future renames are caught at compile time.
