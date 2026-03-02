# RESEARCH: TaskFlow Real-Time Collaboration (F1–F3)
Generated: 2026-03-02
Stack: Angular 19 + Rust/Axum 0.8 + Redis 7 + PostgreSQL 16 + WebSocket

---

## EXISTING INFRASTRUCTURE

| Layer | Component | Status | File |
|-------|-----------|--------|------|
| Backend WS | Handler (auth, subscribe, ping/pong) | Complete | `api/src/ws/handler.rs` (581 lines) |
| Backend WS | BroadcastService (Redis pub/sub) | Complete | `services/src/broadcast.rs` (362 lines) |
| Backend WS | Typed events (WsBoardEvent enum) | Defined, not wired | `db/src/models/ws_events.rs` (348 lines) |
| Backend DB | Task model | No version/conflict fields | `db/src/models/task.rs` (150 lines) |
| Frontend WS | WebSocketService (RxJS, auto-reconnect) | Complete | `core/services/websocket.service.ts` (88 lines) |
| Frontend State | BoardStateService (signals, optimistic) | Complete | `board-view/board-state.service.ts` (849 lines) |
| Frontend WS | BoardWebsocketHandler | Minimal, format mismatch | `board-view/board-websocket.handler.ts` (85 lines) |
| Frontend DnD | Drag-drop with optimistic rollback | Complete | `board-view/board-drag-drop.handler.ts` (309 lines) |
| Presence | None | Missing | N/A |
| Conflict | None (no version, no OCC) | Missing | N/A |
| Save indicator | None | Missing | N/A |

### Known Issue
Broadcast format mismatch: backend sends `{event, data}`, frontend handler expects `{type, payload: {userId?, task?}}`. Must standardize.

### Existing Optimistic Patterns (from E2)
- 212 occurrences across 29 files using `structuredClone()` + signal update + error rollback
- Board-level: drag-drop, quick-edit, create/delete task/column, bulk actions
- Task detail: title, description, priority, due date, assignee, labels, milestones
- **Not yet optimistic:** watchers, subtask delete/reorder, group CRUD

---

## COMPETITOR ANALYSIS

| Product | Conflict Strategy | Presence | Offline | Transport |
|---------|------------------|----------|---------|-----------|
| **Figma** | LWW per property (server authority) | Cursors + avatars + follow mode | No | WebSocket |
| **Linear** | Delta + timestamp (local-first) | Task-level status | Yes (IndexedDB) | WebSocket |
| **Notion** | Hybrid CRDT (blocks) + OT (text) | Block-level indicators | No | WebSocket |
| **Google Docs** | OT (character-level) | Cursors + avatars + typing | No | WebSocket |
| **ClickUp** | LWW (server sequencing) | Task/doc-level avatars | No | WebSocket |

### Winner Pattern for TaskFlow (Kanban Board)
- **Presence:** Figma avatar stack (max 5 + counter) + Jira card editing outline
- **Optimistic UI:** Linear's instant local apply + server confirm/rollback
- **Conflict:** Figma/ClickUp LWW for discrete fields + OCC version check + toast notifications
- **NOT needed:** Full OT/CRDT (overkill for task fields), live cursors (not a doc editor)

### Key Insight
Competitors are moving toward AI-driven automation (Linear agents, Notion agents), not richer real-time. F1–F3 are table-stakes; the next wave is intelligence.

---

## DEPENDENCIES

### Backend (Rust)
| crate | version | purpose |
|-------|---------|---------|
| yrs | 0.24.0 | CRDT for collaborative text (future) |
| testcontainers | 0.26+ | Redis integration testing |

### Frontend (npm)
| package | version | purpose |
|---------|---------|---------|
| yjs | 13.6.29 | CRDT for collaborative text (future) |

### Already Installed (no changes needed)
- `axum` 0.8 — WebSocket handler
- `redis` crate — pub/sub + presence tracking
- `tokio` — async runtime
- `serde` — WS message serialization
- `rxjs/webSocket` — frontend WS transport

> **Note:** Yjs/yrs are for Phase 3 text conflicts only. Phases 1–2 need zero new dependencies.

---

## REDIS KEY PATTERNS

```
# Presence (HASH with field-level TTL via HEXPIRE, Redis 7.4+)
presence:board:{board_id}        HASH    # field: user_id, value: {name, avatar, timestamp}
                                          # HEXPIRE 60s per field, refresh every 30s

# Task Editing Lock (simple SET with NX + EX)
lock:task:{task_id}              STRING  # value: {user_id}:{session_id}
                                          # TTL: 300s (5 min), refreshed by heartbeat

# Pub/Sub Channels (existing, extend)
board:{board_id}                 PUBSUB  # task/column CRUD events (existing)
board:{board_id}:presence        PUBSUB  # presence join/leave events (new)
task:{task_id}:lock              PUBSUB  # lock acquired/released events (new)
```

---

## WS MESSAGE PROTOCOL

### Client → Server
```
presence_join      { board_id }
presence_leave     { board_id }
heartbeat          {}
lock_task          { task_id }
unlock_task        { task_id }
```

### Server → Client
```
presence_update    { board_id, users: [{id, name, avatar}] }
task_locked        { task_id, locked_by: {id, name} }
task_unlocked      { task_id }
version_conflict   { task_id, field, your_version, server_version, server_value }
```

---

## OCC FLOW (Optimistic Concurrency Control)

```
1. GET /tasks/:id → { ...task, version: 5 }
2. User edits field (optimistic UI update)
3. PATCH /tasks/:id  Header: If-Match: 5  Body: { status: "done" }
4a. version == 5 → UPDATE SET version=6 → 200 OK → broadcast task:updated
4b. version != 5 → 409 Conflict → { current_version: 6, current_value: {...} }
5. Client: on 409 → rollback optimistic → show conflict toast → auto-refetch
```

---

## FILE CHANGE LIST (New + Modified)

### New Files
| File | Purpose |
|------|---------|
| `backend/crates/db/src/migrations/20260305000001_task_version.sql` | Add `version` column to tasks |
| `frontend/src/app/core/services/presence.service.ts` | Signal-based presence tracking |
| `frontend/src/app/shared/components/board-presence/board-presence.component.ts` | Avatar stack UI |
| `frontend/src/app/core/services/save-status.service.ts` | Global save state tracker |
| `frontend/src/app/shared/components/save-status-indicator/save-status-indicator.component.ts` | "Saving.../Saved" badge |
| `frontend/src/app/core/services/conflict-notification.service.ts` | Conflict detection + toasts |
| `frontend/src/app/shared/components/conflict-dialog/conflict-dialog.component.ts` | Version conflict resolution UI |
| `frontend/src/app/shared/utils/retry-transient.ts` | RxJS retry operator for 5xx/network |
| `frontend/src/app/shared/utils/text-diff.ts` | Word-level diff for description conflicts |

### Modified Files
| File | Change |
|------|--------|
| `backend/crates/api/src/ws/handler.rs` | Add presence/lock message handlers |
| `backend/crates/services/src/broadcast.rs` | Add presence/lock broadcast methods |
| `backend/crates/db/src/models/task.rs` | Add `version: i32` field |
| `backend/crates/db/src/models/ws_events.rs` | Add `changed_fields`, `origin_user_name`, `version` to TaskBroadcast |
| `backend/crates/db/src/queries/tasks.rs` | Version check in UPDATE, auto-increment |
| `backend/crates/api/src/routes/task_crud.rs` | Return 409 on version mismatch |
| `backend/crates/api/src/routes/task_helpers.rs` | Add `expected_version` to UpdateTaskRequest |
| `frontend/src/app/core/services/websocket.service.ts` | Add presence/lock message types |
| `frontend/src/app/features/board/board-view/board-websocket.handler.ts` | Handle presence_update, task_locked/unlocked, version_conflict |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | Wire save tracking, conflict detection |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | Add BoardPresenceComponent, send join/leave |
| `frontend/src/app/shared/components/top-nav/top-nav.component.ts` | Add SaveStatusIndicator |
| `frontend/src/app/features/task-detail/task-detail.component.ts` | Lock acquire/release, conflict banner |
| `frontend/src/app/features/board/components/task-card/task-card.component.ts` | Lock ring indicator |

---

## GAP ANALYSIS vs BEST-IN-CLASS

| Feature | Our Plan | Best-in-Class | Gap | Priority |
|---------|----------|---------------|-----|----------|
| Avatar stack | Max 5 + counter, tooltips | Figma: colored + follow mode | Follow mode out of scope | GOOD |
| Task locks | Redis SET NX EX 300s | Jira: card outline + lock | Matches | GOOD |
| Card highlight ring | On locked cards | Figma: colored per-user | Single color sufficient | GOOD |
| Save indicator | "Saving.../Saved/Error" top nav | Google Docs: same pattern | Matches | GOOD |
| Retry logic | Single auto-retry on 5xx | Standard practice | Matches | GOOD |
| LWW discrete fields | version-based OCC + toast | Figma/ClickUp: same | Matches | GOOD |
| Text conflict | Simplified diff dialog | Google Docs: OT per char | OT out of scope (correct) | PRAGMATIC |
| **Offline queue** | Not planned | Linear: IndexedDB + sync | **Missing** | **MUST-HAVE** |
| **Undo/redo** | Not planned | Figma/Notion: Ctrl+Z stack | **Missing** | **MUST-HAVE** |
| Typing indicators | Not planned | Slack/Docs: "X is typing" | Missing | NICE-TO-HAVE |
| Activity timeline | Not planned | Linear: sidebar history | Missing | NICE-TO-HAVE |
| Suggested edits | Not planned | Notion: propose mode | Missing | DEFER |
| AI auto-merge | Not planned | Linear: agent conflict | Missing | FUTURE |

### Critical Gaps to Address
1. **Offline queue** — users on flaky networks lose edits. Add IndexedDB queue + "Syncing..." indicator.
2. **Undo/redo** — table-stakes in 2025. Ctrl+Z reverts last optimistic action; bounded stack of 50.

---

## DEV TOOLING

| Category | Tool | Purpose |
|----------|------|---------|
| WS testing | `wscat` (npm) | Interactive CLI WebSocket testing |
| Multi-user E2E | Playwright multi-context | 2+ browser contexts in single test |
| Redis integration | `testcontainers-rs` 0.26+ | Spin up real Redis in tests |
| WS debugging | Chrome DevTools Network > WS | Message inspection + filtering |
| Conflict simulation | Version-stamped race test | Deterministic OCC testing |
| Load benchmark | `artillery.io` | WebSocket load testing |

---

## ARCHITECTURE DECISION RECORD

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Conflict strategy | OCC + LWW (not CRDT/OT) | Task fields are discrete; LWW is sufficient, OT is overkill |
| Presence storage | Redis HASH + HEXPIRE | Auto-expiring, no cleanup cron needed |
| Lock mechanism | Redis SET NX EX (not Redlock) | Single-leader PostgreSQL; distributed lock overkill |
| Save indicator | Global service + top nav badge | Google Docs/Notion pattern; single source of truth |
| Text conflicts | Simplified diff dialog (not full OT) | Full OT requires yrs/Yjs; defer to Phase 3 |
| Offline support | IndexedDB + service worker queue | Linear-inspired; critical for mobile/flaky networks |
| Undo/redo | In-memory stack (50 entries) | Bounded, per-session; multi-user safe (only undo own changes) |

---

## IMPLEMENTATION SEQUENCE

```
Phase 1: F1 — Presence Indicators (no new deps)
  1a. Backend: WS presence messages + Redis HASH tracking
  1b. Frontend: PresenceService + BoardPresenceComponent (avatar stack)
  1c. Frontend: Task lock UI (ring + banner + read-only mode)

Phase 2: F2 — Optimistic UI Completion (no new deps)
  2a. SaveStatusService + SaveStatusIndicatorComponent
  2b. Wire save tracking into all mutation paths
  2c. Convert remaining non-optimistic ops (watchers, subtasks, groups)
  2d. Add retryTransient utility

Phase 3: F3 — Conflict Resolution (migration needed)
  3a. SQL migration: add `version` column to tasks
  3b. Backend: OCC version check in update endpoints, return 409
  3c. Backend: Enhanced TaskBroadcast with changed_fields + version
  3d. Frontend: ConflictNotificationService + toast notifications
  3e. Frontend: ConflictDialogComponent (your version vs theirs)

Phase 4: Polish (optional, post-F3)
  4a. Offline queue (IndexedDB + service worker)
  4b. Undo/redo stack (Ctrl+Z / Ctrl+Shift+Z)
  4c. Text field diff for description conflicts
```

---

## SOURCES

### Competitor Architecture
- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [Making multiplayer more reliable — Figma](https://www.figma.com/blog/making-multiplayer-more-reliable/)
- [Scaling the Linear Sync Engine](https://linear.app/now/scaling-the-linear-sync-engine)
- [Reverse engineering Linear's sync magic](https://marknotfound.com/posts/reverse-engineering-linears-sync-magic/)
- [How Notion leveraged Rust for performance](https://medium.com/@yashbatra11111/how-notion-leveraged-rust-for-performance-critical-components-eb559144d845)
- [Google Docs Operational Transformation](https://dev.to/dhanush___b/how-google-docs-uses-operational-transformation-for-real-time-collaboration-119)
- [ClickUp Real-Time Collaboration](https://clickup.com/features/collaboration-detection)

### Libraries & Patterns
- [yrs (Rust Yjs port) on crates.io](https://crates.io/crates/yrs) — v0.24.0
- [Yjs on npm](https://www.npmjs.com/package/yjs) — v13.6.29
- [CRDT vs OT decision guide](https://thom.ee/blog/crdt-vs-operational-transform/)
- [CRDT Implementation Guide 2025](https://velt.dev/blog/crdt-implementation-guide-conflict-free-apps)
- [OCC practical guide 2025](https://www.shadecoder.com/topics/optimistic-concurrency-control-a-practical-guide-for-2025)

### Redis & WebSocket
- [Redis distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/)
- [Scaling pub/sub with WebSockets and Redis](https://ably.com/blog/scaling-pub-sub-with-websockets-and-redis)
- [Redis HASH documentation](https://redis.io/docs/latest/develop/data-types/hashes/)
- [Axum WebSocket patterns 2025](https://medium.com/rustaceans/beyond-rest-building-real-time-websockets-with-rust-and-axum-in-2025-91af7c45b5df)

### Dev Tooling
- [Playwright browser contexts](https://playwright.dev/docs/browser-contexts)
- [testcontainers-rs](https://rust.testcontainers.org/quickstart/testcontainers/)
- [Angular state management 2025](https://nx.dev/blog/angular-state-management-2025)

### Gap Analysis
- [Offline-first frontend apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Linear for Agents changelog](https://linear.app/changelog/2025-05-20-linear-for-agents)
- [Notion 2025 updates](https://www.notion.com/releases)
- [Liveblocks Presence](https://liveblocks.io/presence)
