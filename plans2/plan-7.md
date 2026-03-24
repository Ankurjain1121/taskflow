# Performance Optimization: Close the Gap with Linear/Notion

## Objective
Make TaskBolt feel as responsive as Linear/Notion by implementing highest-impact frontend and backend performance patterns, prioritized by effort-to-reward ratio.

## Key Decisions
- Frontend data layer is the biggest gap, not the server
- Optimistic UI is the single highest-impact improvement
- Each phase is independently shippable
- Reuse existing patterns: snapshot+rollback from `board-drag-drop.handler.ts`, Redis from `AppState`, WebSocket state mutation from `board-websocket.handler.ts`

## Critical Details
- Angular `outputHashing: "all"` already appends content hashes — safe to add immutable cache headers
- 183 `@for` loops across 88 files — most use `track entity.id` correctly
- Zero `shareReplay()` in entire codebase currently
- Zero virtual scrolling in codebase currently
- Redis `ConnectionManager` already available in `AppState`

---

## Implementation Plan

### Phase 1: Quick Wins (< 2 hours, zero risk)
- [ ] **1.1** Route Preloading — add `withPreloadAllModules()` to `app.config.ts`
- [ ] **1.2** Nginx Static Asset Caching — `expires 1y` + `immutable` for hashed assets, `no-cache` for `index.html`
- [ ] **1.3** `shareReplay()` on `workspace-state.service.ts` and `dashboard.service.ts`
- [ ] **1.4** `@for` Track Audit — verify all dynamic lists use `track entity.id`, fix `rule-builder.component.ts` line 230

### Phase 2: Optimistic UI (3-4 hours, medium risk)
- [ ] **2.1** Optimistic Task Creation — insert temp task immediately, replace on server response, rollback on error
- [ ] **2.2** Optimistic Task Update — snapshot+rollback pattern, wire into task-detail components
- [ ] **2.3** Optimistic Task Deletion — remove from boardState immediately, rollback on error
- [ ] **2.4** Optimistic Column Create/Delete — same pattern

### Phase 3: Virtual Scrolling (3-4 hours, medium risk)
- [ ] **3.1** Kanban Column Virtual Scrolling — `cdk-virtual-scroll-viewport` (fallback: IntersectionObserver)
- [ ] **3.2** List View Virtual Scrolling — simpler, no drag-drop
- [ ] **3.3** My Tasks Timeline Virtual Scrolling

### Phase 4: Backend Caching (2-3 hours)
- [ ] **4.1** Redis Dashboard Stats Caching — 30s TTL, invalidate on task mutations
- [ ] **4.2** HTTP Cache Headers Middleware — `Cache-Control` on GET endpoints

### Phase 5: Client-Side Cache (4-5 hours)
- [ ] **5.1** In-Memory Cache Service — `Map<key, {data, timestamp, ttl}>` with stale-while-revalidate
- [ ] **5.2** Mutation Debounce Batcher — batch rapid edits into single PATCH after 300ms
- [ ] **5.3** NgZone Escape for File Uploads — run progress tracking outside zone

### Phase 6: Delta/Incremental Sync (future, 2+ days)
- [ ] **6.1** Backend Sync Version Tracking — `sync_version BIGINT` on boards table
- [ ] **6.2** Frontend Delta Reconciliation — `/sync?since_version=N` endpoint

---

## Success Criteria Checklist
- [ ] Lighthouse Performance > 90 on `/dashboard`
- [ ] Time to Interactive < 2s (cold load)
- [ ] All mutations feel instant (< 50ms perceived response)
- [ ] Second route navigation < 100ms (preloaded modules)
- [ ] Static assets show `(disk cache)` on second load in DevTools
- [ ] Task creation: card appears before network request completes
- [ ] Board with 200+ tasks/column: DOM shows < 30 task nodes per column, scroll at 60fps
- [ ] Dashboard stats < 5ms on cached request (Redis hit)
- [ ] Board re-navigation renders instantly from cache
- [ ] All phases pass `quick-check.sh` after implementation

---

## Files Modified Summary

| Phase | File | Change |
|-------|------|--------|
| 1.1 | `frontend/src/app/app.config.ts` | Add `withPreloadAllModules()` |
| 1.2 | `/etc/nginx/sites-available/paraslace.conf` | Add static asset caching + immutable headers |
| 1.3 | `frontend/src/app/core/services/workspace-state.service.ts` | Add `shareReplay()` caching |
| 1.3 | `frontend/src/app/core/services/dashboard.service.ts` | Add `shareReplay()` with 30s TTL |
| 1.4 | Various `@for` loops | Audit track expressions |
| 2.1-2.4 | `frontend/src/app/features/board/board-view/board-state.service.ts` | Optimistic create/update/delete/column |
| 2.2 | `frontend/src/app/features/board/task-detail/*.component.ts` | Wire to optimistic update |
| 3.1 | `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` | CDK virtual scroll |
| 3.2 | `frontend/src/app/features/board/list-view/list-view.component.ts` | CDK virtual scroll |
| 3.3 | `frontend/src/app/features/my-tasks/my-tasks-timeline/my-tasks-timeline.component.ts` | CDK virtual scroll |
| 4.1 | `backend/crates/api/src/routes/dashboard.rs` | Redis caching with 30s TTL |
| 4.2 | `backend/crates/api/src/middleware/cache_headers.rs` (new) | Cache-Control middleware |
| 5.1 | `frontend/src/app/core/services/cache.service.ts` (new) | In-memory SWR cache |
| 5.2 | `frontend/src/app/core/services/mutation-batcher.service.ts` (new) | Debounced mutation batching |
| 5.3 | `frontend/src/app/features/board/file-upload-zone/file-upload-zone.component.ts` | NgZone escape |

## Existing Patterns to Reuse
- **Optimistic UI snapshot+rollback**: `board-drag-drop.handler.ts:15-78`
- **Skeleton CSS classes**: `.skeleton`, `.skeleton-text` in `styles.css`
- **WebSocket state mutation**: `board-websocket.handler.ts` updates `boardState` signal directly
- **Redis ConnectionManager**: Already in `AppState` (`backend/crates/api/src/state.rs:16,31-32`)
- **`BoardFullResponse` batch endpoint**: `getBoardFull()` fetches board+columns+tasks in one call

---

## Progress Log
- 2026-02-23: Plan finalized and saved
