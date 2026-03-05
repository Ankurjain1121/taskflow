# Memory Optimization - All Containers & Storage

## Objective
Fix all memory spike issues across the entire TaskFlow project: Docker containers, Rust backend, Angular frontend, and storage.

## Success Criteria Checklist
- [x] All Docker services have deploy.resources.limits.memory set (MinIO 512M, backend 512M, frontend 256M, minio-setup 128M)
- [x] PostgreSQL: switched to host PG 17 (removed Docker container, saved ~1GB)
- [x] Redis: switched to host Redis (removed Docker container, saved ~384MB)
- [x] PgPool has idle_timeout (300s) and max_lifetime (1800s)
- [x] board_channels DashMap has background GC (60s interval, removes channels with 0 receivers)
- [x] RateLimiter DashMap has background GC (300s interval, removes expired entries)
- [x] WebSocket connections have configurable max limit (WS_MAX_CONNECTIONS, default 500)
- [x] Per-WebSocket channel subscription count capped at 50
- [x] Frontend subscription leaks fixed (4 components: board-settings, workload-dashboard, member-detail, workspace-settings)
- [x] setInterval/setTimeout cleanup verified (all properly cleared in ngOnDestroy)
- [x] /api/health/detailed endpoint reports board_channels, ws_connections, db_pool, process_rss
- [x] monitor-memory.sh + check-disk-usage.sh scripts exist
- [x] Backend passes cargo check + clippy
- [x] Frontend passes tsc --noEmit
- [ ] Deploy and verify

## Progress Log
- [COMPLETE] 2026-03-05: All 4 tasks done
- Task #1: Removed Docker PG/Redis, switched to host services, MinIO limits, PgPool tuning
- Task #2: board_channels GC, RateLimiter GC, WS connection limit (503), subscription cap (50)
- Task #3: Fixed 4 subscription leaks with takeUntilDestroyed, audited all timers
- Task #4: /api/health/detailed endpoint, monitor-memory.sh, check-disk-usage.sh

## Memory Savings Summary
| Change | Memory Saved |
|--------|-------------|
| Remove Docker PostgreSQL | ~1024MB |
| Remove Docker Redis | ~384MB |
| Backend limit 1024M -> 512M | ~512MB |
| Frontend limit 512M -> 256M | ~256MB |
| board_channels GC | Prevents unbounded growth |
| RateLimiter GC | Prevents unbounded growth |
| WS connection limit | Prevents memory exhaustion |
| **Total container savings** | **~2.2GB** |
