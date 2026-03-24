# Performance Optimization Plan: Close the Gap with Linear/Notion

## Context

Competitor research against the top 10 PM SaaS tools revealed TaskBolt's biggest performance gap is the **frontend data layer** — not the server. Competitors like Linear, Notion, and Todoist feel instant because users never see server latency (optimistic UI, client caching, delta sync). TaskBolt's Rust backend is faster than most competitors' servers, but every user action still waits for a network round-trip.

**Goal**: Make TaskBolt feel as responsive as Linear/Notion by implementing the highest-impact patterns from competitor research, prioritized by effort-to-reward ratio.

---

## Phase 1: Quick Wins (< 2 hours total, zero risk)

### 1.1 Route Preloading Strategy
**File**: `frontend/src/app/app.config.ts`
- Add `withPreloadAllModules()` to `provideRouter()` (line 20)
- Currently uses default `NoPreloading` — all 20+ lazy routes only load on navigation
- After this: idle browser preloads all route chunks, making second navigation instant
- **Impact**: HIGH | **Effort**: 5 min

### 1.2 Nginx Static Asset Caching
**File**: `/etc/nginx/sites-available/paraslace.conf` (lines 98-156)
- Add `location ~* \.(js|css|woff2?|ttf|svg|png|jpg|ico|webp)$` with `expires 1y` + `Cache-Control: public, immutable`
- Add `location = /index.html` with `Cache-Control: no-cache`
- Safe because Angular `outputHashing: "all"` already appends content hashes to all JS/CSS filenames
- Currently: every page navigation re-downloads all assets
- **Impact**: HIGH | **Effort**: 10 min

### 1.3 `shareReplay()` on High-Frequency Services
**Files**:
- `frontend/src/app/core/services/workspace-state.service.ts` — cache workspace list
- `frontend/src/app/core/services/dashboard.service.ts` — cache dashboard stats per workspace (30s TTL)
- Currently: zero `shareReplay()` in entire codebase; multiple components subscribing = multiple HTTP calls
- **Impact**: MEDIUM | **Effort**: 30 min

### 1.4 `@for` Track Audit
- 183 `@for` loops across 88 files — verify all dynamic lists use `track entity.id`
- Fix `rule-builder.component.ts` line 230 (`track $index` on dynamic actions list)
- Static skeleton arrays using `track i` are correct (no change needed)
- **Impact**: LOW-MEDIUM | **Effort**: 20 min

---

## Phase 2: Optimistic UI (3-4 hours, medium risk)

The single biggest perceived-performance improvement. Pattern already proven in codebase at `board-drag-drop.handler.ts:15-78` (uses `structuredClone` snapshot + rollback on error).

### 2.1 Optimistic Task Creation
**File**: `frontend/src/app/features/board/board-view/board-state.service.ts` (lines 246-276)
- Currently: `createTask()` waits for server response before adding to `boardState`
- Change: Insert temp task with `crypto.randomUUID()` immediately, replace with real task on server response, rollback on error
- **Impact**: VERY HIGH | **Effort**: 1.5 hr

### 2.2 Optimistic Task Update
**File**: `frontend/src/app/features/board/board-view/board-state.service.ts`
- Add `optimisticUpdateTask(taskId, updates)` method using snapshot+rollback pattern
- Wire into task detail components that call `taskService.updateTask()`:
  - `board/task-detail/task-detail-header.component.ts`
  - `board/task-detail/task-detail-metadata.component.ts`
  - `board/task-detail/task-detail-fields.component.ts`
  - `task-detail/task-detail-page.component.ts`
- **Impact**: HIGH | **Effort**: 1.5 hr

### 2.3 Optimistic Task Deletion
**File**: `frontend/src/app/features/board/board-view/board-state.service.ts`
- Remove task from `boardState` immediately, rollback on error
- **Impact**: MEDIUM | **Effort**: 20 min

### 2.4 Optimistic Column Create/Delete
**File**: `frontend/src/app/features/board/board-view/board-state.service.ts` (lines 293-316)
- Same snapshot+rollback pattern for `createColumn()`
- **Impact**: MEDIUM | **Effort**: 20 min

---

## Phase 3: Virtual Scrolling (3-4 hours, medium risk)

Currently zero virtual scrolling in the codebase. All task lists render every DOM node.

### 3.1 Kanban Column Virtual Scrolling
**File**: `frontend/src/app/features/board/kanban-column/kanban-column.component.ts`
- Replace `@for` task loop with `cdk-virtual-scroll-viewport` + `*cdkVirtualFor`
- `itemSize` ~110px (card height)
- **Risk**: CDK virtual scroll + CDK drag-drop can conflict. If so, fallback to `IntersectionObserver`-based lazy rendering
- **Impact**: VERY HIGH | **Effort**: 3 hr

### 3.2 List View Virtual Scrolling
**File**: `frontend/src/app/features/board/list-view/list-view.component.ts`
- Simpler — no drag-drop interaction. `itemSize` ~48px
- **Impact**: HIGH | **Effort**: 30 min

### 3.3 My Tasks Timeline Virtual Scrolling
**File**: `frontend/src/app/features/my-tasks/my-tasks-timeline/my-tasks-timeline.component.ts`
- Same pattern as 3.2 for each timeline group
- **Impact**: MEDIUM | **Effort**: 30 min

---

## Phase 4: Backend Caching (2-3 hours)

### 4.1 Redis Dashboard Stats Caching
**File**: `backend/crates/api/src/routes/dashboard.rs`
- Cache `get_stats`, `tasks_by_status`, `tasks_by_priority`, `completion_trend`, `overdue_tasks`, `upcoming_deadlines` in Redis with 30s TTL
- Key format: `dashboard:{handler}:{user_id}:{workspace_id}`
- Invalidate on task create/update/delete/move (add to existing broadcast handlers in task routes)
- Redis `ConnectionManager` already available in `AppState`
- **Impact**: HIGH | **Effort**: 2 hr

### 4.2 HTTP Cache Headers on GET Endpoints
**File**: `backend/crates/api/src/main.rs` (add middleware)
- New middleware: `backend/crates/api/src/middleware/cache_headers.rs`
- Dashboard routes: `Cache-Control: private, max-age=30, stale-while-revalidate=60`
- Board GET routes: `Cache-Control: private, max-age=10`
- **Impact**: MEDIUM | **Effort**: 45 min

---

## Phase 5: Client-Side Cache (4-5 hours, higher complexity)

### 5.1 In-Memory Cache Service
**New file**: `frontend/src/app/core/services/cache.service.ts`
- Simple `Map<string, { data, timestamp, ttl }>` with `get/set/invalidate/clear`
- Integrate with `BoardStateService.loadBoard()`: serve cached board data instantly, fetch fresh in background (stale-while-revalidate pattern)
- WebSocket events already update board state directly via `board-websocket.handler.ts`, which is even better than cache invalidation
- **Impact**: HIGH | **Effort**: 3 hr

### 5.2 Mutation Debounce Batcher
**New file**: `frontend/src/app/core/services/mutation-batcher.service.ts`
- When user rapidly edits title + priority + due date, batch into single PATCH after 300ms debounce
- Existing `bulkUpdate`/`bulkDelete` in `task.service.ts` already handle multi-select bulk ops
- **Impact**: MEDIUM | **Effort**: 1.5 hr

### 5.3 NgZone Escape for File Uploads
**File**: `frontend/src/app/features/board/file-upload-zone/file-upload-zone.component.ts`
- Run XHR upload progress tracking outside Angular zone
- Re-enter zone only at meaningful progress intervals for UI update
- **Impact**: LOW-MEDIUM | **Effort**: 30 min

---

## Phase 6: Delta/Incremental Sync (2+ days, future)

> Only attempt after Phases 1-5 are stable and shipped.

### 6.1 Backend Sync Version Tracking
- Add `sync_version BIGINT` column to `boards` table
- Increment on every task/column mutation
- New endpoint: `GET /api/boards/:id/sync?since_version=N`
- Returns only changed records since version N

### 6.2 Frontend Delta Reconciliation
- Store `lastSyncVersion` per board in `BoardStateService`
- On re-navigation, call `/sync?since_version=N` instead of `/full`
- Apply delta patches to cached board state

---

## Files Modified Summary

| Phase | File | Change |
|-------|------|--------|
| 1.1 | `frontend/src/app/app.config.ts` | Add `withPreloadAllModules()` |
| 1.2 | `/etc/nginx/sites-available/paraslace.conf` | Add static asset caching + immutable headers |
| 1.3 | `frontend/src/app/core/services/workspace-state.service.ts` | Add `shareReplay()` caching |
| 1.3 | `frontend/src/app/core/services/dashboard.service.ts` | Add `shareReplay()` with 30s TTL |
| 1.4 | Various `@for` loops | Audit track expressions |
| 2.1-2.4 | `frontend/src/app/features/board/board-view/board-state.service.ts` | Add optimistic create/update/delete/column ops |
| 2.2 | `frontend/src/app/features/board/task-detail/*.component.ts` | Wire to optimistic update method |
| 3.1 | `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` | CDK virtual scroll |
| 3.2 | `frontend/src/app/features/board/list-view/list-view.component.ts` | CDK virtual scroll |
| 3.3 | `frontend/src/app/features/my-tasks/my-tasks-timeline/my-tasks-timeline.component.ts` | CDK virtual scroll |
| 4.1 | `backend/crates/api/src/routes/dashboard.rs` | Redis caching with 30s TTL |
| 4.2 | `backend/crates/api/src/middleware/cache_headers.rs` (new) | Cache-Control middleware |
| 5.1 | `frontend/src/app/core/services/cache.service.ts` (new) | In-memory SWR cache |
| 5.2 | `frontend/src/app/core/services/mutation-batcher.service.ts` (new) | Debounced mutation batching |
| 5.3 | `frontend/src/app/features/board/file-upload-zone/file-upload-zone.component.ts` | NgZone escape |

## Existing Patterns to Reuse

- **Optimistic UI snapshot+rollback**: `board-drag-drop.handler.ts:15-78` — exact pattern to replicate
- **Skeleton CSS classes**: `.skeleton`, `.skeleton-text` already defined globally in `styles.css` (25 files use them)
- **WebSocket state mutation**: `board-websocket.handler.ts` already updates `boardState` signal directly on WS events
- **Redis ConnectionManager**: Already initialized in `AppState` (`backend/crates/api/src/state.rs:16,31-32`)
- **`BoardFullResponse` batch endpoint**: `getBoardFull()` already fetches board+columns+tasks in one call

---

## Verification

After each phase:
1. **Phase 1**: Chrome DevTools Network tab — verify cached JS/CSS on second navigation (size shows `(disk cache)`). Second route nav should be < 100ms.
2. **Phase 2**: Create a task — card appears in column before network request completes. Kill network mid-flight — card disappears with error toast.
3. **Phase 3**: Load board with 200+ tasks per column. DOM inspector shows < 30 task nodes per column. Scroll at 60fps.
4. **Phase 4**: Dashboard stats endpoint returns in < 5ms on second request (check Redis hit in server logs).
5. **Phase 5**: Navigate away from board and back — board renders instantly from cache, then silently refreshes.

**Overall targets**:
- Lighthouse Performance > 90 on `/dashboard`
- Time to Interactive < 2s (cold load)
- All mutations feel instant (< 50ms perceived response)

---

## Implementation Order

```
Phase 1 (quick wins) → Phase 2 (optimistic UI) → Phase 3 (virtual scroll) → Phase 4 (backend cache) → Phase 5 (client cache) → Phase 6 (future: delta sync)
```

Each phase is independently shippable. No phase depends on a later phase. Phase 2 has the highest single-item impact (optimistic task creation).
