# GRAPH_TOUR — TaskBolt Knowledge Graph Sweep

**Graph:** `graphify-out/graph.json` · **Generated:** 2026-04-21
**Coverage:** 50 queries across auth, tasks, websockets, automations, data, notifications, storage, tests, bridges.

## Reading This Report

| Tag | Meaning |
|-----|---------|
| **EXTRACTED** | Edge grounded in AST (import/call/contain) |
| **INFERRED** | Edge inferred by semantic pass; confidence ≤ 0.9 |
| **AMBIGUOUS** | Uncertain edge — flagged for review |
| **NOT IN GRAPH** | Query terms matched nothing or only noise |

**Known graph hazards (apply to ALL path queries below):** The graph has five high-betweenness "bridge" nodes that are name-collision artifacts, not real call chains:
- `map_err()` @ `task_issue_link.rs:L23` (degree 237)
- `.new()` @ `middleware/rate_limit.rs:L295` (degree 222)
- `.from_str()` @ `notifications/events.rs:L54` (degree 179)
- `.from()`, `.as_str()`, `.forbidden()` at various locations

Any shortest path that routes through these should be treated as **AMBIGUOUS** — they're likely AST-matched trait-impl siblings, not real control flow.

---

## Auth & Authorization (Q1–Q10)

### Q1 — why does `verify_project_membership` connect so many communities
`verify_project_membership()` lives at `backend/crates/db/src/queries/membership.rs:L57` and a mirror at `backend/crates/api/src/routes/common.rs:L24` (degree 101). BFS surfaces it alongside rate-limit, metrics, and extract_ip nodes — it's called from nearly every authenticated route handler (comments, tasks, boards, automations) which is why it bridges many communities. **INFERRED** outbound edges dominate.

### Q2 — what depends on `is_workspace_member`
Defined at `backend/crates/db/src/queries/workspaces.rs:L374` (degree 61). Callers include WhatsApp notifications, member search, audit logging, workspace trash, invitations, export, and onboarding. Every workspace-scoped route checks through it — it's the workspace equivalent of `verify_project_membership`.

### Q3 — how does `auth_middleware` flow into route handlers
`auth.rs:L1` (middleware) exposes `auth_middleware` / `optional_auth_middleware` (`middleware/auth.rs:L124`). BFS shows it feeding every `*_router()` (workspace, tasks, dashboard, export, sessions, prometheus, etc.) at `backend/crates/api/src/router.rs:L46` via `build_router()`. All routers attach it as a tower layer.

### Q4 — path `auth_middleware` → `TaskRepository`
**NOT IN GRAPH.** `TaskRepository` node not present — TaskBolt uses free functions in `db/queries/tasks.rs`, not a repository class. Query db/queries/tasks.rs directly.

### Q5 — explain `AuthUserExtractor`
`backend/crates/api/src/extractors/auth.rs:L48`, degree 2. Only edges: `contains → auth.rs` and `method → .from_request_parts()`. Axum `FromRequestParts` extractor that pulls the authenticated user out of request parts; semantic pass did not trace its callers (every `Handler(AuthUser, …)` usage).

### Q6 — which routes skip `verify_project_membership`
**NOT IN GRAPH** (noise hit). BFS returned serialization tests for User/WorkspaceApiKey/Webhook models — graph has no "skip" relation. Answer requires grep for route handlers that omit the call: prometheus/health/webhook-delivery/shared-board-public routes skip it by design.

### Q7 — path `auth_router` → `admin_users_router`
```
auth_router() [routes/auth.rs:L702]
  --calls [INFERRED]--> .new() [middleware/rate_limit.rs:L295]
  --calls [INFERRED]--> admin_users_router() [routes/admin_users.rs:L463]
```
**AMBIGUOUS** — path routes through the `.new()` bridge node. Real connection is both routers being mounted onto the same top-level `build_router()`, not a direct call.

### Q8 — how is JWT validated on websocket connect
BFS touches `set_active_websocket_connections()`, `extract_client_ip()`, `extract_token_from_cookie()` @ `middleware/auth.rs:L158`, `extract_cookie_token()` @ `ws/handler.rs:L81`, `wait_for_auth()` @ `ws/handler.rs:L542`. Flow: `ws_handler` → `wait_for_auth` → token extracted from cookie → `verify_access_token()` @ `auth/src/jwt.rs:L130`.

### Q9 — explain `AdminUser`
`backend/crates/api/src/extractors/auth.rs:L123`, degree 2. Edges: `contains → auth.rs`, `calls → .from_request_parts()`. Axum extractor that rejects non-admins; callers not linked by extractor pattern.

### Q10 — what happens on invalid token
`backend/crates/auth/src/jwt.rs`: `verify_access_token`, `verify_refresh_token`, `build_validation` (L77). On failure `.unauthorized()` @ `middleware/auth.rs:L44` returns 401. Integration tests: `test_protected_route_with_invalid_token_returns_401` @ `integration_tests/auth_tests.rs:L27`, `test_expired_token_format_returns_401` @ L71.

---

## Tasks & Kanban (Q11–Q20)

### Q11 — what does `update_task_handler` do end-to-end
`routes/task_crud.rs:L318`, degree 23 (2nd-highest handler). DFS reached 697 nodes — too broad. Direct neighbors: validation, `verify_project_membership`, `ActivityLogService.record_updated`, `BroadcastService.broadcast_project_event`, cache invalidation (`project_tasks_key`), reminder reset (`reset_reminders_for_task`). Mixed **EXTRACTED**/**INFERRED**.

### Q12 — path `create_task` → `BroadcastService`
```
test_create_task_input_deserialize() [db/queries/tasks.rs:L810]
  --calls [INFERRED]--> .from_str() [notifications/events.rs:L54]
  --calls [INFERRED]--> test_broadcast_message_json_structure() [services/broadcast.rs:L274]
  --contains [EXTRACTED]--> broadcast.rs --contains--> BroadcastService
```
**AMBIGUOUS** — path goes through `.from_str()` bridge. Real chain: `create_task_handler` → `BroadcastService::broadcast_project_event()` @ `services/broadcast.rs:L102` (not traced by graph).

### Q13 — why does `move_task_to_project` strip labels
`strip_task_labels_for_project()` @ `db/queries/tasks.rs:L757` lives next to `move_task_to_project()` @ `tasks.rs:L719`. The sibling placement plus `move_subtasks_to_project()` @ L779 implies: moving a task to a different project must drop labels because labels are workspace-scoped but label→project relations are not carried. **INFERRED** reason, grounded in co-location.

### Q14 — explain `reset_reminders_for_task`
`backend/crates/db/src/queries/task_reminders.rs:L160`, degree 2. Edges: `contains → task_reminders.rs`, `calls (INFERRED) → update_task_handler()`. Called on task updates so due-date changes invalidate queued reminders.

### Q15 — how is task ordering fractional index computed
`backend/crates/db/src/utils/fractional_index.rs:L1` with `midpoint()` @ L77 and `test_ordering_sequence()` @ L179. BFS links it to `move_task_inner()` @ `routes/task_movement.rs:L93` and task/column broadcast events. Standard fractional-index (midpoint between neighbor keys) for O(1) reorder without renumber.

### Q16 — path `task_crud` → `activity_log`
```
task_crud.rs --contains--> create_task_handler()
  --calls [INFERRED]--> verify_project_membership()
  --calls [INFERRED]--> list_activity_handler() [routes/activity_log.rs:L48]
  --calls [INFERRED]--> list_activity_by_task() [db/queries/activity_log.rs:L43]
  --contains--> activity_log.rs
```
**INFERRED chain.** Real path: handlers call `ActivityLogService.record_*` methods (see Q33).

### Q17 — which handlers trigger notification dispatch
`services/notifications/dispatcher.rs` + `NotificationService.create_notification()` @ `service.rs:L63` and `.create_notifications_batch()` @ L203. Handlers in BFS: `create_comment_handler`, `assign_user_handler`, `move_task_to_project_handler`, `fire_member_joined_trigger`, automation `execute_action`, `add_favorite_handler`, `resolve_issue_handler`, comment updates. Outbound channels: `send_whatsapp_notification`, `send_slack_notification`, `.send_notification_email()`.

### Q18 — explain `TaskService`
**NOT IN GRAPH** (partial). Only match is frontend `createMockTaskService()` @ `features/task-detail/task-detail-page.component.spec.ts:L97`. Backend has no class named `TaskService` — task logic is free functions in `db/queries/tasks.rs`.

### Q19 — how do subtasks inherit from parent
BFS surfaces `db/queries/subtasks.rs` with `test_create_subtask`, `test_list_subtasks_by_task`, `test_update_subtask`, `test_reorder_subtask`. `test_max_subtask_depth_is_5` @ `validation.rs:L270`. Inheritance is limited: subtasks inherit board/project from parent but have their own title/status/priority; depth capped at 5.

### Q20 — path `BulkOperationResult` → `apply_action`
```
BulkOperationResult [db/queries/bulk_operations.rs:L42]
  --contains--> bulk_operations.rs
  --contains--> apply_action() [db/queries/bulk_operations.rs:L279]
```
Trivial same-file path. **EXTRACTED**, but says nothing about call flow.

---

## WebSockets & Real-time (Q21–Q25)

### Q21 — how does `handle_socket` broadcast to clients
`ws/handler.rs:L97` + `services/broadcast.rs:L1`. `BroadcastService.broadcast_project_event()` @ L102. Events: `TaskBroadcast`, `ColumnBroadcast` @ `db/models/ws_events.rs:L64/L81`. PubSub relay: `ws/pubsub_relay.rs` — `.spawn()` @ L37 relays tokio broadcast channel messages to each socket's send loop.

### Q22 — path `update_task_handler` → `pubsub_relay`
```
update_task_handler() → .new() [rate_limit.rs:L295] (INFERRED, bridge)
  → .dummy() [ws/pubsub_relay.rs:L56] (INFERRED)
  → test_pubsub_relay_unsubscribe_nonexistent() (EXTRACTED)
```
**AMBIGUOUS.** Real flow: handler writes to `BroadcastService` channel → `pubsub_relay.spawn()` fan-out → socket writers.

### Q23 — explain `presence` (PresenceService)
`backend/crates/services/src/presence.rs:L22`, degree 15. Full method list: `.new`, `.board_key`, `.lock_key`, `.now_secs`, `.join_board`, `.leave_board`, `.heartbeat`, `.get_board_viewers`, `.lock_task`, `.unlock_task`, `.get_task_lock`, `.cleanup_user_locks`, `.track_user_lock`, `.untrack_user_lock`. Tracks who's viewing a board and who holds a task edit-lock; all **EXTRACTED**.

### Q24 — what channels exist and who subscribes
**NOT IN GRAPH** as a coherent answer. BFS matched `test_*_nonexistent_returns_404` tests — unrelated noise. Known channels from broadcast.rs (not captured cleanly): per-project `broadcast_project_event`, per-workspace `broadcast_workspace_update`. Subscribers = each socket via `pubsub_relay`.

### Q25 — how is websocket auth enforced
`ws_handler` → `wait_for_auth()` @ `ws/handler.rs:L542` waits for first message to contain a valid JWT cookie or authenticates from upgrade headers via `extract_cookie_token()` @ L81. Cross-references RBAC: `has_permission()`, `require_role_level()`, `AuthError` @ `auth/rbac.rs`. Sockets that fail auth are dropped with `.unauthorized()`.

---

## Automations & Jobs (Q26–Q30)

### Q26 — how does an automation rule execute an action
`get_active_rules_for_trigger()` @ `db/queries/automation_evaluation.rs:L100` → `fold_rules_with_actions()` @ L45 produces `AutomationRuleWithActions` → `evaluate_trigger()` @ `services/jobs/automation/mod.rs:L104` → `execute_action()` @ `services/jobs/automation/actions.rs:L17` dispatches to `execute_set_priority`, `execute_set_due_date`, `execute_send_webhook`, etc. `log_automation()` records each run; circuit breaker in `automation/mod.rs`.

### Q27 — path `CreateRuleRequest` → `execute_action`
```
CreateRuleRequest [routes/automation.rs:L34] → automation.rs
  → list_activity_handler() (INFERRED, wrong target)
  → map_err() (INFERRED, bridge)
  → execute_set_due_date() [actions.rs:L399]
  → execute_action() [actions.rs:L17]
```
**AMBIGUOUS** — two INFERRED bridge hops. Real flow: HTTP `POST /automations` → `create_rule_handler` → `create_rule()` in DB → later triggered by `spawn_automation_evaluation()` @ `automation/mod.rs:L341`.

### Q28 — explain `deadline_scanner`
Only node found: `test_deadline_scanner_error_display()` @ `services/jobs/deadline_scanner.rs:L459`, degree 1. The actual `scan_deadlines()` @ L49 exists in graph (seen in Q29) but was not returned by direct term match. Job periodically scans tasks with upcoming due dates and enqueues notifications.

### Q29 — how do recurring tasks get scheduled
`routes/cron.rs` exposes `process_recurring_handler()` @ L204 returning `RecurringTasksResult` @ L192. It calls `create_recurring_instance()` @ `db/queries/recurring_generation.rs:L75` using `get_due_configs()` @ L26. `test_recurring_task_config_with_cron()` @ `models/recurring.rs:L114` confirms cron-expression configs. Paired with `scan_deadlines()`.

### Q30 — path `cron` → `report_jobs`
```
test_recurring_task_config_with_cron() → .from_str() (INFERRED bridge)
  → dequeue_email() → map_err() (bridge) → send_morning_agenda_reports()
  → report_jobs.rs
```
**AMBIGUOUS.** Direct real path: `cron_router()` @ `routes/cron.rs:L316` has a handler that calls `report_jobs::send_morning_agenda_reports` @ L28 — graph missed the direct call edge.

---

## Data Flow & Models (Q31–Q35)

### Q31 — what touches both projects and tasks tables
`db/queries/tasks.rs`, `db/queries/workspace_tasks.rs`, `db/queries/projects/projects_read.rs` (`list_projects_by_workspace`, `list_project_tasks_with_badges`, `is_project_member`), `report_jobs.rs` (`fetch_open_tasks`, `fetch_completed_tasks`), `services/cache.rs` (`project_tasks_key`, `workspace_projects_key`), `db/queries/task_bulk.rs` (`bulk_update_tasks`, `bulk_delete_tasks`), `task_views.rs` (calendar/gantt/flat). Handlers: `list_projects`, `list_tasks`, `move_task_to_project_handler`.

### Q32 — path `Workspace` → `Task`
```
WorkspaceWithMembers → workspaces.rs → list_workspaces_for_user()
  → test_list_workspaces_for_user() (INFERRED)
  → .as_str() (bridge, INFERRED)
  → request_id_middleware() (INFERRED)
  → .from_str() (bridge) → test_task_updated_event_serde()
```
**AMBIGUOUS (strongly).** 7 hops, 5 bridges. The real relation is `Workspace → Project → Board → Column → Task` — the graph chose a noise path because `Workspace` and `Task` models live far apart in the extraction graph.

### Q33 — explain `ActivityLogService`
`backend/crates/api/src/services/activity_log.rs:L30`, degree 13. Methods: `.record`, `.record_created`, `.record_moved`, `.record_assigned`, `.record_unassigned`, `.record_commented`, `.record_attachment_added`, `.record_attachment_removed`, `.record_updated`, `.record_status_changed`, `.record_priority_changed`, `.record_deleted`. All **EXTRACTED**. Central write-side of the audit/activity feed.

### Q34 — which queries use `workspace_scope`
`workspace_scope()` @ `routes/workspace_trash.rs:L27` and `verify_workspace_scope()` @ `routes/helpers/trash_queries.rs:L338`. BFS was noisy (1251 nodes). Real callers visible: trash helpers, milestone queries, task-template queries, saved views, user preferences. Workspace-scoping enforces tenant isolation in multi-tenant queries.

### Q35 — how are custom fields stored and retrieved
**Backend side missing from graph.** Match only returned frontend: `task-detail.component.ts` — `.saveCustomFields` (L493), `.doSaveCustomFields` (L808), `.loadCustomFields` (L665), `.onCustomFieldChanged` (L481), `buildCustomFieldValues` helper. Backend uses `set_task_custom_field_values()` @ `db/queries/custom_fields.rs:L320` (seen earlier) + `update_custom_field_handler` @ `routes/custom_field.rs:L100` but query term didn't match those labels.

---

## Notifications & Digests (Q36–Q40)

### Q36 — how does `daily_digest` assemble content
`services/jobs/daily_digest.rs:L1` with `send_daily_digests()` @ L14. WhatsApp variant: `send_enhanced_daily_digests()` @ `whatsapp_digest.rs:L774`, `format_enhanced_daily_message()` @ L899. Uses `digest_service.rs` with `.preference_key()` @ L32, `NotifyContext`, and `PostalClient` for email. Content assembled from per-user open tasks / completed tasks / upcoming deadlines.

### Q37 — path `digest_service` → `email_worker`
```
digest_service.rs --contains--> generate_digests() [L89]
  --calls [INFERRED]--> .send_email() [email.rs:L202]
  --calls [INFERRED]--> run_email_worker() [email_worker.rs:L17]
```
**INFERRED** but plausible: digest generates envelopes → `send_email` enqueues to Postal/SMTP → background `run_email_worker` drains `email_queue`.

### Q38 — explain `notification_preferences`
Best match: `notification_preferences_router()` @ `routes/notification_preferences.rs:L105`, degree 4. Edges: mounted on `build_router()` and `build_test_router()`. Preference evaluator: `should_notify()` @ `db/queries/notification_preferences.rs:L160` (seen earlier). Event registry: `NotificationEvent` @ `notifications/events.rs:L12`.

### Q39 — which events produce notifications
`NotificationEvent` @ `services/notifications/events.rs:L12` with `.name()` @ L25, `.all()` @ L73 enumerating all kebab-case event names (`test_all_notification_event_names_are_kebab_case` asserts this). Channels: Slack (`send_slack_notification`, `send_slack_text`, `get_event_emoji`), WhatsApp (`send_whatsapp_notification`, `format_rich_notification`, `.send_link_custom_preview`, `.send_file`), in-app (`NotificationService.create_notification`).

### Q40 — path `slack dispatcher` → `email_queue`
```
test_is_slack_enabled_default_false → slack.rs → send_slack_notification()
  → map_err() (bridge, INFERRED)
  → enqueue_email() [email_queue.rs:L54] → email_queue.rs
```
**AMBIGUOUS.** Slack and email are parallel sibling channels both called from `NotificationService`, not chained — graph routed via `map_err` bridge.

---

## Storage & Attachments (Q41–Q43)

### Q41 — how does minio upload flow work end to end
`services/minio.rs` with `MinioService` @ L40, `.bucket()` @ L236, `.new()` @ L54. Routes: `routes/upload.rs` — `UploadRequest` (L16), `ConfirmRequest` (L30), `UploadLogoRequest` (L184), `ConfirmLogoRequest` (L192), `create_minio_service_async()` @ L197, `upload_avatar` (L50), `upload_workspace_logo` (L110), `confirm_avatar` (L73), `confirm_workspace_logo` (L141), `validate_image_upload` (L34). Attachments: `routes/attachment.rs` — `GetUploadUrlRequest`, `DownloadUrlResponse`, `get_upload_url`, `confirm_upload`. Flow: client gets presigned URL → uploads direct to MinIO → calls `confirm_upload` → row inserted via `create_attachment()` @ `db/queries/attachments.rs:L51`.

### Q42 — path `confirm_upload` → `delete_attachment_handler`
```
confirm_upload() [attachment.rs:L149]
  --contains--> attachment.rs
  --contains--> delete_attachment_handler() [attachment.rs:L280]
```
**EXTRACTED** — same-file co-location. Not a call chain, just sibling handlers.

### Q43 — explain `DownloadUrlResponse`
`backend/crates/api/src/routes/attachment.rs:L86`, degree 1. Only `contains` edge. Response DTO for presigned download URL endpoint. Low graph coverage suggests the response is only constructed once in `get_download_url` handler.

---

## Integration Test Surface (Q44–Q46)

### Q44 — what does `test_app` build
`test_app()` @ `middleware/security_headers.rs:L48` and `test_app_state()` @ `test_helpers.rs:L88`. Together with `build_test_router()` @ `test_helpers.rs:L227`, `build_router()` @ `router.rs:L46`, and `test_pool()` @ `test_helpers.rs:L81`. Builds an Axum app with real DB pool + middleware stack for integration tests — test harness backbone (degree 123).

### Q45 — path `test_pool` → `build_test_router`
```
test_pool() [test_helpers.rs:L81]
  --contains--> test_helpers.rs
  --contains--> build_test_router() [test_helpers.rs:L227]
```
**EXTRACTED** same-file co-location — both are top-level items in the test-helpers module.

### Q46 — which endpoints lack integration tests
**Cannot be answered directly from graph** — no "lacks_test" relation. BFS returned integration_tests_* modules and setup helpers. Inverse query (routes with no inbound test edges) would need a custom query; high-level check: `prometheus_router`, `personal_board_router`, `task_snooze_router`, `filter_presets_router`, `recent_items_router`, `task_issue_link_router`, several `workspace_export`/`workspace_audit` handlers have no visible test-file node neighbors.

---

## Bridges & Bottlenecks (Q47–Q50)

### Q47 — which functions are cross-community bridges
Graph term match failed. Computed betweenness-centrality (sample-200, normalized) over the giant component:

| Rank | Score | Node | Location |
|------|-------|------|----------|
| 1 | 0.3475 | `.new()` | `middleware/rate_limit.rs:L295` |
| 2 | 0.2462 | `map_err()` | `routes/task_issue_link.rs:L23` |
| 3 | 0.2070 | `.from_str()` | `notifications/events.rs:L54` |
| 4 | 0.0970 | `.forbidden()` | `extractors/auth.rs:L33` |
| 5 | 0.0664 | `.as_str()` | `routes/common.rs:L92` |
| 6 | 0.0562 | `test_app()` | `middleware/security_headers.rs:L48` |
| 7 | 0.0519 | `verify_project_membership()` | `routes/common.rs:L24` |
| 8 | 0.0492 | `test_pool()` | `test_helpers.rs:L81` |
| 9 | 0.0459 | `.spawn()` | `ws/pubsub_relay.rs:L37` |
| 10 | 0.0358 | `.from()` | `routes/roles.rs:L60` |

**FLAG: ranks 1–5 and 10 are extraction artifacts** — same-name trait methods (`map_err`, `.new`, `.from_str`, `.from`, `.as_str`) fused across files. **Real architectural bridges:** `.forbidden()` extractor, `verify_project_membership`, `test_app`, `test_pool`, `.spawn()` pubsub relay.

### Q48 — path `map_err` → `ActivityLogError`
```
map_err() [task_issue_link.rs:L23]
  --calls [INFERRED]--> create_task_handler()
  --calls [INFERRED]--> .record_created() [activity_log.rs:L56]
  --method [EXTRACTED]--> ActivityLogService
  --contains--> activity_log.rs
  --contains--> ActivityLogError [activity_log.rs:L15]
```
Mixed **INFERRED/EXTRACTED.** Reasonable: handlers call `.record_*` which returns `Result<_, ActivityLogError>`.

### Q49 — top 10 high-fan-in endpoints
Computed from graph degree:

| Degree | Endpoint | Location |
|--------|----------|----------|
| 79 | `build_router()` | `router.rs:L46` |
| 52 | `build_test_router()` | `test_helpers.rs:L227` |
| 23 | `update_task_handler()` | `routes/task_crud.rs:L318` |
| 22 | `create_task_handler()` | `routes/task_crud.rs:L93` |
| 20 | `assign_user_handler()` | `routes/task_collaboration.rs:L288` |
| 18 | `move_task_to_project_handler()` | `routes/task_movement.rs:L439` |
| 16 | `ws/handler.rs` | `ws/handler.rs:L1` |
| 16 | `ws/batch_handler.rs` | `ws/batch_handler.rs:L1` |
| 15 | `create_comment_handler()` | `routes/comments.rs:L93` |
| 15 | `delete_task_handler()` | `routes/task_crud.rs` |

Task CRUD + assignments + comments dominate — these are the most coupled code paths and the highest-value targets for refactoring.

### Q50 — path `setup_full` → `verify_project_membership`
```
setup_full() [db/queries/webhooks.rs:L314]
  --calls [EXTRACTED]--> test_list_webhooks()
  --calls [INFERRED]--> .as_str() (bridge)
  --calls [INFERRED]--> create_comment_handler()
  --calls [INFERRED]--> filter_project_members()
  --contains--> membership.rs --contains--> verify_project_membership()
```
**AMBIGUOUS** — 6 hops, 3 bridges. Note: `setup_full` is a test fixture with many copies (webhooks, custom_fields, recurring, subtasks, automations) — each seeds a workspace+project+board+task, so they all *do* end up calling `verify_project_membership` indirectly via the handlers they test, but the graph chose a bridge-noisy route.

---

## Graph Health Observations

1. **Semantic layer is thin** — most high-degree nodes are AST-matched methods (`.new`, `map_err`, `.from_str`). Real "architectural" concepts (TaskService, repositories, services) under-represented because TaskBolt uses free-function DB queries, not layered services.
2. **Bridge nodes are mostly noise** — 5 of 10 top betweenness scores are same-name trait impls. Future `--update` should prune name-collision edges or tag them `AMBIGUOUS`.
3. **Architectural bridges that are real:** `verify_project_membership`, `is_workspace_member`, `auth_middleware`, `BroadcastService`, `PresenceService`, `ActivityLogService`, `NotificationService`, `build_router`.
4. **Not in graph / grep instead:** `TaskRepository`, `TaskService` (no class exists), "which routes skip X" (no negation relation), "channels list" (dynamic).

## Recommended Next Queries
- `/graphify explain "BroadcastService"` — high-value real bridge.
- `/graphify explain "NotificationService"` — mapping event→channel→preference needs a full node walk.
- `/graphify path "create_task_handler" "ActivityLogService"` — direct call chain (avoid bridges).
- Rebuild with `--mode deep --directed` to capture semantic inheritance and call-direction.
