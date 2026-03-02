# Section 06: Presence & Collaboration

> Project: TaskFlow World-Class Upgrade
> Batch: 2 | Tasks: 6 | Risk: YELLOW
> PRD Features: P1 - Presence Indicators, Task Editing Lock

---

## Overview

Add real-time presence awareness to TaskFlow. When team members are viewing the same board, their avatars appear in the board header. When someone opens a task for editing, other users see "Maya is editing..." and are prevented from making conflicting changes.

This builds on the existing WebSocket infrastructure (Redis pub/sub, board channel subscriptions).

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | YELLOW |
| Summary | Bidirectional WebSocket messages + Redis lock state management |

### Risk Factors
- Complexity: 3 (bidirectional WS messages, Redis lock state, TTL handling)
- Novelty: 2 (extending existing WS protocol)
- Dependencies: 1 (existing WebSocket infrastructure)
- Integration: 1 (internal)
- Data sensitivity: 1 (user presence only)
- **Total: 8 → YELLOW**

### Mitigation
- Use Redis SET with TTL for locks (auto-expire if user disconnects)
- Heartbeat pings refresh lock TTL
- Test with 2 browser tabs simultaneously

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| None | - | Uses existing WebSocket infrastructure |

**Batch:** 2

---

## TDD Test Stubs

1. `PresenceService should track which users are viewing the current board`
2. `PresenceService should remove user from presence list on disconnect`
3. `BoardHeaderComponent should show avatars of users currently viewing the board`
4. `TaskLockService should acquire a lock when user opens task for editing`
5. `TaskLockService should release lock when user closes task detail`
6. `TaskLockService should show "Maya is editing..." when task is locked by another user`
7. `TaskLockService should auto-release lock after 5 minutes of inactivity`

---

## Tasks

### Task 1: Backend - Add Presence Message Types
**Files:** `backend/crates/api/src/ws/handler.rs`
**Steps:**
1. Add `ClientMessage` variants: `JoinBoard { board_id }`, `LeaveBoard { board_id }`, `Heartbeat`
2. Add `ServerMessage` variants: `PresenceUpdate { board_id, users: Vec<UserPresence> }`
3. Track active users per board in Redis hash: `presence:board:{id}` → `{ user_id: timestamp }`
4. Broadcast `PresenceUpdate` when users join/leave
5. Clean up stale entries (no heartbeat for 30s) via TTL
**Done when:** Backend tracks and broadcasts board presence

### Task 2: Backend - Add Task Locking
**Files:** `backend/crates/api/src/ws/handler.rs`, `backend/crates/services/src/broadcast.rs`
**Steps:**
1. Add `ClientMessage` variants: `LockTask { task_id }`, `UnlockTask { task_id }`
2. Store lock in Redis: `lock:task:{id}` → `{ user_id, user_name, locked_at }` with 300s TTL
3. On `LockTask`: check if already locked → if not, set lock + broadcast `task:locked`
4. On `UnlockTask`: verify owner → remove lock + broadcast `task:unlocked`
5. Heartbeat refreshes lock TTL
**Done when:** Tasks can be locked/unlocked via WebSocket with auto-expiry

### Task 3: Frontend - Board Presence Display
**Files:** `board-header.component.ts` or new `board-presence.component.ts`
**Steps:**
1. Create presence indicator showing avatars of current board viewers
2. Subscribe to `PresenceUpdate` messages via BoardWebsocketHandler
3. Show up to 5 avatars, "+N" for overflow
4. Tooltip on hover shows full names
5. Send `JoinBoard` on board mount, `LeaveBoard` on unmount
**Done when:** Board header shows live presence avatars

### Task 4: Frontend - Task Editing Lock UI
**Files:** `task-detail.component.ts`
**Steps:**
1. On task detail open: send `LockTask` via WebSocket
2. On task detail close: send `UnlockTask`
3. If task is locked by another user: show "Maya is editing..." banner at top of task detail
4. Disable editing controls when locked by someone else (description, fields become read-only)
5. Show lock holder's avatar and name
**Done when:** Opening a task locks it; other users see the lock indicator

### Task 5: Frontend - WebSocket Handler Extension
**Files:** `board-websocket.handler.ts`
**Steps:**
1. Add handlers for `presence:update`, `task:locked`, `task:unlocked` events
2. Update board state signals with presence/lock data
3. Handle reconnection: re-send `JoinBoard` and active locks after reconnect
**Done when:** All new event types are processed correctly

### Task 6: Lock Cleanup & Edge Cases
**Steps:**
1. Handle browser tab close (beforeunload → send UnlockTask)
2. Handle navigation away from board (ngOnDestroy → LeaveBoard + UnlockTask)
3. Handle WebSocket disconnection (Redis TTL auto-cleans after 300s)
4. Handle stale locks display (if lock exists but no heartbeat, show "may be editing...")
**Done when:** Locks are reliably cleaned up in all disconnect scenarios

---

## Section Completion Criteria

- [ ] Board header shows avatars of users currently viewing
- [ ] Presence updates in real-time (within 1s of join/leave)
- [ ] Opening task detail locks the task
- [ ] Other users see "X is editing..." for locked tasks
- [ ] Locked tasks are read-only for non-lock-holders
- [ ] Locks auto-expire after 5 minutes of inactivity
- [ ] Navigating away/closing tab releases locks
