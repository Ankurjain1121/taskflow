# Plan F1: Presence Indicators

> Feature: F1 — Real-Time Presence Indicators
> Status: Planned
> Dependencies: Existing WebSocket infrastructure (Redis pub/sub, board channel subscriptions)
> Risk: YELLOW (bidirectional WS messages + Redis state management)

---

## Requirements

### What F1 Means

F1 adds real-time presence awareness to TaskBolt boards. When multiple team members view the same board simultaneously, each user sees an **avatar stack** in the board header showing who else is currently viewing. When someone opens a task for editing, other users see a visual indicator ("Maya is editing...") on the task card and a banner in the task detail drawer, with editing controls disabled for non-holders.

### Sub-features IN SCOPE

1. **Board-level presence tracking** — backend tracks which users are viewing each board via Redis HSET with TTL-based cleanup
2. **Avatar stack in board header** — Figma-style avatar stack (max 5 + "+N" counter) showing live viewers
3. **Heartbeat/keepalive** — 15-second heartbeat from client refreshes presence; 30-second stale threshold triggers cleanup
4. **Task editing lock** — opening task detail sends `LockTask`; other users see "X is editing..." and fields become read-only
5. **Lock cleanup on disconnect** — browser close, navigation away, WS disconnect all release locks (Redis TTL as safety net)
6. **Reconnection resilience** — on WS reconnect, re-send JoinBoard + active locks

### Sub-features OUT OF SCOPE

1. **Live cursors** (Figma/Notion style) — too complex for board-level UX; minimal value on a kanban board vs. a document
2. **Follow mode** (Figma) — not applicable to kanban boards
3. **Conflict resolution / OT** (F3 scope) — deferred to F3
4. **Card drag highlight for remote users** — would require streaming drag coordinates; deferred to F2/F3

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> Figma's avatar stack (max 5 + counter) in top bar + Jira's "editing" outline on the task card being edited. For TaskBolt (board-level): avatar stack showing who's on this board, highlight ring on card being dragged/edited by another user.

### Most Important Gap

TaskBolt currently has **zero presence awareness**. Users have no idea if anyone else is viewing the same board or editing the same task. The single most important gap is the lack of any visual indicator that other users are present — this makes the product feel single-player.

---

## What Already Exists

### Files That Partially Implement This

| File | What Exists | Extend or Build? |
|------|-------------|-----------------|
| `backend/crates/api/src/ws/handler.rs` | WebSocket handler with Auth/Subscribe/Unsubscribe/Ping. Channel validation. Redis pub/sub forwarding. | **Extend** — add JoinBoard/LeaveBoard/Heartbeat/LockTask/UnlockTask message types + presence tracking |
| `backend/crates/api/src/ws/mod.rs` | Exports handler types | **Extend** — export new types |
| `backend/crates/services/src/broadcast.rs` | BroadcastService with Redis pub/sub | **Extend** — add `broadcast_presence_update` method |
| `backend/crates/api/src/state.rs` | AppState with `redis: ConnectionManager` | No changes needed |
| `frontend/src/app/core/services/websocket.service.ts` | WebSocketService with connect/disconnect/send/messages$ | No changes needed (generic enough) |
| `frontend/src/app/features/board/board-view/board-websocket.handler.ts` | Handles task:created/updated/moved/deleted | **Extend** — add presence:update/task:locked/task:unlocked handlers |
| `frontend/src/app/features/board/board-view/board-state.service.ts` | Board state signals, boardMembers signal | **Extend** — add presence and lock signals |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | Board header with title, settings, buttons. No avatar stack. | **Extend** — add BoardPresenceComponent in header |
| `frontend/src/app/features/board/task-detail/task-detail.component.ts` | Task detail drawer | **Extend** — add lock banner, read-only mode when locked |
| `frontend/src/app/features/board/task-card/task-card.component.ts` | Task card display | **Extend** — add "editing" ring overlay when locked by another user |

---

## Backend Changes

### SQL Migrations

**No SQL migrations needed.** Presence is ephemeral state stored in Redis, not PostgreSQL. Task locks are also Redis-only with TTL auto-expiry.

### Redis Data Structures

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `presence:board:{board_id}` | HASH | None (entries cleaned via timestamp check) | `{user_id}` -> `{"name":"Alice","avatar_url":"...","joined_at":"ISO8601"}` |
| `lock:task:{task_id}` | STRING | 300s (5 min) | `{"user_id":"...","user_name":"...","locked_at":"ISO8601"}` |

**Presence cleanup logic:** When broadcasting a presence update, iterate the hash entries and remove any where `joined_at` is older than 30 seconds (stale entries from crashed clients). Heartbeat refreshes the timestamp.

### New WebSocket Message Types

#### Client -> Server (extend `ClientMessage` enum)

```rust
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    // ... existing variants ...
    JoinBoard { payload: BoardPayload },
    LeaveBoard { payload: BoardPayload },
    Heartbeat { payload: BoardPayload },
    LockTask { payload: TaskLockPayload },
    UnlockTask { payload: TaskLockPayload },
}

#[derive(Debug, Deserialize)]
pub struct BoardPayload {
    pub board_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TaskLockPayload {
    pub task_id: String,
    pub board_id: String,
}
```

#### Server -> Client (extend `ServerMessage` enum or use Data variant)

Presence updates and lock events are broadcast via the existing `Data(serde_json::Value)` variant through Redis pub/sub, using the event format:

```json
// Presence update (broadcast to board:{id} channel)
{
  "event": "presence:update",
  "data": {
    "board_id": "...",
    "users": [
      { "user_id": "...", "name": "Alice", "avatar_url": "...", "joined_at": "..." },
      { "user_id": "...", "name": "Bob", "avatar_url": null, "joined_at": "..." }
    ]
  }
}

// Task locked (broadcast to board:{id} channel)
{
  "event": "task:locked",
  "data": {
    "task_id": "...",
    "user_id": "...",
    "user_name": "Alice",
    "locked_at": "..."
  }
}

// Task unlocked (broadcast to board:{id} channel)
{
  "event": "task:unlocked",
  "data": {
    "task_id": "..."
  }
}
```

### Backend Handler Logic

**JoinBoard handler:**
1. Validate `board_id` is a valid UUID
2. Verify user has board access (already done via channel subscription)
3. Fetch user info from DB (name, avatar_url) — cache in a local HashMap for the connection lifetime
4. HSET `presence:board:{board_id}` field `{user_id}` value `{"name":"...","avatar_url":"...","joined_at":"now"}`
5. Read all entries from the hash, remove stale (>30s), broadcast `presence:update` to `board:{board_id}`

**LeaveBoard handler:**
1. HDEL `presence:board:{board_id}` field `{user_id}`
2. Broadcast updated `presence:update`

**Heartbeat handler:**
1. HSET `presence:board:{board_id}` field `{user_id}` — update `joined_at` to now
2. If any active task locks for this user, refresh their TTL (EXPIRE `lock:task:{id}` 300)
3. No broadcast needed (heartbeat is silent)

**LockTask handler:**
1. Check if `lock:task:{task_id}` exists in Redis
2. If locked by another user: send error back to requesting client
3. If not locked or locked by same user: SET `lock:task:{task_id}` with 300s TTL
4. Broadcast `task:locked` event to `board:{board_id}`

**UnlockTask handler:**
1. GET `lock:task:{task_id}` — verify current user is the lock holder
2. DEL `lock:task:{task_id}`
3. Broadcast `task:unlocked` event to `board:{board_id}`

**Connection cleanup (on WS close):**
1. For each board the user had joined: HDEL presence entry + broadcast update
2. For each task the user had locked: DEL lock + broadcast unlock
3. Track joined boards and locked tasks in local `HashSet`s on the connection

### New Broadcast Events

Add to `broadcast.rs` events module:

```rust
pub const PRESENCE_UPDATE: &str = "presence:update";
pub const TASK_LOCKED: &str = "task:locked";
pub const TASK_UNLOCKED: &str = "task:unlocked";
```

### API Routes

**No new HTTP API routes needed.** All presence operations happen over WebSocket. The existing `/api/ws` endpoint is sufficient.

---

## Frontend Changes

### New Components

#### 1. `BoardPresenceComponent`

**File:** `frontend/src/app/features/board/board-view/board-presence.component.ts`
**Selector:** `app-board-presence`

Avatar stack showing users currently viewing the board. Figma-style: up to 5 overlapping circular avatars with initials or avatar images, "+N" counter if more than 5.

```
Template sketch (pseudo-HTML):
<div class="flex items-center -space-x-2">
  @for (user of visibleUsers(); track user.user_id) {
    <div class="w-8 h-8 rounded-full border-2 border-[var(--card)] flex items-center justify-center text-xs font-bold"
         [title]="user.name"
         pTooltip="user.name">
      @if (user.avatar_url) {
        <img [src]="user.avatar_url" class="w-full h-full rounded-full object-cover" />
      } @else {
        {{ initials(user.name) }}
      }
    </div>
  }
  @if (overflowCount() > 0) {
    <div class="w-8 h-8 rounded-full border-2 border-[var(--card)] bg-[var(--muted)] flex items-center justify-center text-xs font-medium text-[var(--muted-foreground)]"
         pTooltip="overflowTooltip()">
      +{{ overflowCount() }}
    </div>
  }
</div>
```

**Signals:**
- `presenceUsers = input<PresenceUser[]>([])` — from parent
- `currentUserId = input<string>('')` — to exclude self from display
- `visibleUsers = computed()` — first 5 users excluding self
- `overflowCount = computed()` — count beyond 5
- `overflowTooltip = computed()` — "Alice, Bob, Charlie" for tooltip

#### 2. `PresenceService` (not a component — Angular service)

**File:** `frontend/src/app/core/services/presence.service.ts`

Manages presence state with signals. Handles heartbeat interval.

```typescript
@Injectable({ providedIn: 'root' })
export class PresenceService {
  // Signals
  readonly boardPresence = signal<PresenceUser[]>([]);
  readonly taskLocks = signal<Map<string, TaskLock>>(new Map());

  // Methods
  joinBoard(boardId: string): void;
  leaveBoard(boardId: string): void;
  lockTask(taskId: string, boardId: string): void;
  unlockTask(taskId: string, boardId: string): void;
  handlePresenceUpdate(data: PresenceUpdateData): void;
  handleTaskLocked(data: TaskLockedData): void;
  handleTaskUnlocked(data: TaskUnlockedData): void;
  startHeartbeat(boardId: string): void;
  stopHeartbeat(): void;
  isTaskLockedByOther(taskId: string): Signal<TaskLock | null>;
}
```

### Modified Components

#### 1. `board-view.component.ts`

**Changes:**
- Inject `PresenceService`
- Call `presenceService.joinBoard(boardId)` in `ngOnInit` after board loads
- Call `presenceService.leaveBoard(boardId)` in `ngOnDestroy`
- Add `@HostListener('window:beforeunload')` to call leaveBoard
- Add `<app-board-presence>` component in the board header div (between title and settings button)
- Pass `presenceService.boardPresence()` to the presence component

#### 2. `board-websocket.handler.ts`

**Changes:**
- Inject `PresenceService`
- Add cases in `handleMessage` for:
  - `presence:update` -> `presenceService.handlePresenceUpdate(data)`
  - `task:locked` -> `presenceService.handleTaskLocked(data)`
  - `task:unlocked` -> `presenceService.handleTaskUnlocked(data)`

#### 3. `task-detail.component.ts`

**Changes:**
- Inject `PresenceService`
- On task detail open: call `presenceService.lockTask(taskId, boardId)`
- On task detail close: call `presenceService.unlockTask(taskId, boardId)`
- Add computed signal `taskLock = computed(() => presenceService.isTaskLockedByOther(taskId))`
- When `taskLock()` is not null: show "X is editing..." banner at top, disable editing controls

#### 4. `task-card.component.ts`

**Changes:**
- Inject `PresenceService`
- Add computed signal checking if this card's task is locked by another user
- When locked: show a colored ring/border (e.g., `ring-2 ring-blue-400`) and a small avatar of the editor in the card corner

#### 5. `ws/handler.rs` (backend)

**Changes:**
- Add new `ClientMessage` variants: `JoinBoard`, `LeaveBoard`, `Heartbeat`, `LockTask`, `UnlockTask`
- Add new payload structs: `BoardPayload`, `TaskLockPayload`
- Track joined boards (`HashSet<String>`) and locked tasks (`HashSet<String>`) per connection
- Implement handlers for each new message type
- Add cleanup logic in the connection close path
- Add helper functions: `handle_join_board`, `handle_leave_board`, `handle_heartbeat`, `handle_lock_task`, `handle_unlock_task`
- Fetch user name/avatar from DB on first JoinBoard (cache for connection)

#### 6. `broadcast.rs` (backend)

**Changes:**
- Add event constants: `PRESENCE_UPDATE`, `TASK_LOCKED`, `TASK_UNLOCKED`
- Add `broadcast_presence_update` helper method (fetches hash, filters stale, publishes)

### Signal Architecture

```
PresenceService (providedIn: 'root')
├── boardPresence: WritableSignal<PresenceUser[]>
│   └── updated by handlePresenceUpdate() from WS
├── taskLocks: WritableSignal<Map<string, TaskLock>>
│   ├── updated by handleTaskLocked() from WS
│   └── updated by handleTaskUnlocked() from WS
└── heartbeatInterval: number (setInterval ID)

BoardPresenceComponent
├── presenceUsers: InputSignal<PresenceUser[]> (from parent)
├── currentUserId: InputSignal<string> (from parent)
├── visibleUsers: computed(() => first 5 excluding self)
├── overflowCount: computed(() => total - 5 or 0)
└── overflowTooltip: computed(() => names of overflow users)

TaskCardComponent (extended)
└── isLockedByOther: computed(() => presenceService.taskLocks().get(taskId)?)

TaskDetailComponent (extended)
└── taskLock: computed(() => presenceService.taskLocks().get(taskId)?)
```

### TypeScript Interfaces

```typescript
// In presence.service.ts
export interface PresenceUser {
  user_id: string;
  name: string;
  avatar_url: string | null;
  joined_at: string;
}

export interface TaskLock {
  task_id: string;
  user_id: string;
  user_name: string;
  locked_at: string;
}

export interface PresenceUpdateData {
  board_id: string;
  users: PresenceUser[];
}

export interface TaskLockedData {
  task_id: string;
  user_id: string;
  user_name: string;
  locked_at: string;
}

export interface TaskUnlockedData {
  task_id: string;
}
```

---

## Phased Implementation

### Phase 1: Core Presence Tracking (Backend WS + Redis)

**Goal:** Backend tracks and broadcasts board presence via WebSocket.

1. Extend `ClientMessage` enum with `JoinBoard`, `LeaveBoard`, `Heartbeat` variants and their payload structs
2. Add `LockTask` and `UnlockTask` variants to `ClientMessage`
3. In `handle_socket`, track `joined_boards: HashSet<String>` and `locked_tasks: HashSet<String>`
4. Implement `handle_join_board`:
   - Query user name + avatar_url from DB (SELECT name, avatar_url FROM users WHERE id = $1)
   - HSET presence hash in Redis
   - Broadcast presence:update to board channel
5. Implement `handle_leave_board`:
   - HDEL from presence hash
   - Broadcast updated presence
6. Implement `handle_heartbeat`:
   - Update timestamp in presence hash
   - Refresh TTL on any active task locks
7. Implement `handle_lock_task` / `handle_unlock_task`:
   - Redis SET/GET/DEL with TTL
   - Broadcast task:locked / task:unlocked
8. Add cleanup in WS close path: remove presence entries + release locks + broadcast updates
9. Add event constants to broadcast.rs
10. Run `cargo check --workspace --all-targets && cargo clippy --workspace --all-targets -- -D warnings && cargo fmt --all -- --check`

**Estimated effort:** ~200 lines backend Rust

### Phase 2: Frontend Avatar Stack Display

**Goal:** Board header shows live avatars of users on the board.

1. Create `PresenceService` in `frontend/src/app/core/services/presence.service.ts`:
   - Inject `WebSocketService`
   - `joinBoard(boardId)` sends WS message + starts 15s heartbeat interval
   - `leaveBoard(boardId)` sends WS message + stops heartbeat
   - Signal-based state for `boardPresence` and `taskLocks`
   - Handlers for presence:update, task:locked, task:unlocked
2. Create `BoardPresenceComponent` in `frontend/src/app/features/board/board-view/board-presence.component.ts`:
   - Avatar stack with overlapping circles, +N counter
   - Tooltip with full names on hover
   - Exclude current user from the visible list
3. Integrate into `board-view.component.ts`:
   - Import and add `BoardPresenceComponent` to template
   - Call `presenceService.joinBoard()` / `leaveBoard()` on init/destroy
   - Add `beforeunload` handler
4. Extend `board-websocket.handler.ts`:
   - Add cases for `presence:update`, `task:locked`, `task:unlocked`
   - Delegate to PresenceService
5. Run `npx tsc --noEmit && npm run build -- --configuration=production`

**Estimated effort:** ~250 lines frontend TypeScript

### Phase 3: Task Lock UI & Card Highlights

**Goal:** Cards show editing indicator; task detail shows lock banner with read-only mode.

1. Extend `task-card.component.ts`:
   - Inject `PresenceService`
   - Add computed signal for lock state
   - Add ring overlay + small avatar badge when locked by another user
2. Extend `task-detail.component.ts`:
   - Inject `PresenceService`
   - Send lockTask on open, unlockTask on close
   - Show "X is editing..." banner when locked by another user
   - Disable editing controls (description, fields) when locked
3. Handle edge cases:
   - `beforeunload` -> unlockTask
   - `ngOnDestroy` -> unlockTask + leaveBoard
   - WS reconnect -> re-send joinBoard + re-lock active tasks
4. Run full checks: `./scripts/quick-check.sh`

**Estimated effort:** ~150 lines frontend TypeScript

---

## File Change List

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `backend/crates/api/src/ws/handler.rs` | Modify | Add JoinBoard/LeaveBoard/Heartbeat/LockTask/UnlockTask message types, Redis presence tracking, connection cleanup |
| 2 | `backend/crates/api/src/ws/mod.rs` | Modify | Export new types if needed |
| 3 | `backend/crates/services/src/broadcast.rs` | Modify | Add PRESENCE_UPDATE, TASK_LOCKED, TASK_UNLOCKED event constants |
| 4 | `frontend/src/app/core/services/presence.service.ts` | Create | PresenceService with signals for board presence + task locks, heartbeat, WS message sending |
| 5 | `frontend/src/app/features/board/board-view/board-presence.component.ts` | Create | Avatar stack component (max 5 + counter), tooltip, initials fallback |
| 6 | `frontend/src/app/features/board/board-view/board-view.component.ts` | Modify | Add BoardPresenceComponent in header, inject PresenceService, joinBoard/leaveBoard lifecycle |
| 7 | `frontend/src/app/features/board/board-view/board-websocket.handler.ts` | Modify | Add handlers for presence:update, task:locked, task:unlocked events |
| 8 | `frontend/src/app/features/board/task-detail/task-detail.component.ts` | Modify | Add lock/unlock on open/close, "X is editing..." banner, read-only mode |
| 9 | `frontend/src/app/features/board/task-card/task-card.component.ts` | Modify | Add lock indicator ring + editor avatar badge |

**Total: 2 new files, 7 modified files**

---

## Success Criteria Checklist

- [ ] Board header shows circular avatar stack of users currently viewing the board (excluding self)
- [ ] Avatar stack shows max 5 avatars with "+N" counter for overflow
- [ ] Hovering an avatar shows the user's full name (PrimeNG Tooltip)
- [ ] Hovering "+N" counter shows names of all overflow users
- [ ] Presence updates appear within 2 seconds of a user joining/leaving the board
- [ ] Opening same board in 2 browser tabs (alice + bob) shows each user's avatar in the other tab
- [ ] Closing a browser tab removes that user's avatar from other tabs within 30 seconds
- [ ] Opening task detail from board shows "You are editing" state and broadcasts lock
- [ ] Another user viewing the same board sees "Alice is editing..." on the locked task card (ring + avatar)
- [ ] Another user opening the locked task detail sees "Alice is editing this task" banner at top
- [ ] Locked task fields (description, assignee, priority, etc.) are read-only for non-lock-holders
- [ ] Lock auto-expires after 5 minutes of inactivity (no heartbeat)
- [ ] Navigating away from board releases both presence and any task locks
- [ ] WebSocket reconnection re-establishes presence and active task locks
- [ ] `cargo check --workspace --all-targets` passes with no errors
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` passes with no warnings
- [ ] `cargo fmt --all -- --check` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build -- --configuration=production` succeeds
- [ ] No `.unwrap()` in Rust code (proper `?` error handling)
- [ ] No orphaned code (every backend message type has a frontend handler)
