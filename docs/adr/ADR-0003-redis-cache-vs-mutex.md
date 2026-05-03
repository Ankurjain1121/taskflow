# ADR-0003: Twenty Health Endpoint Uses Redis SETEX Cache, Not In-Memory Mutex

**Status:** Accepted (2026-05-03)

## Context

The TaskBolt-side health endpoint `/api/integrations/twenty/health` (plan line 289) is hit on every CRM page load and by the iframe state machine (plan lines 969-975) to decide whether to render `online`, `offline`, `upgrading`, or `csp_blocked` states. It probes Twenty's `/healthz`, validates the API key still works, and confirms a webhook can fire — a multi-second composite check unsafe to run on every request.

The W11 reviewer (autoupdate window, plan lines 1635, 1677) flagged a P0 finding on the initial implementation: results were memoized in an in-memory `tokio::sync::Mutex<Option<HealthSnapshot>>` per axum process. This is unsafe under the planned scale-out posture — multiple TaskBolt API pods would each hold an independent cache, producing divergent health states, racy "upgrading" banners, and inconsistent state-machine transitions across simultaneous browser tabs hitting different pods.

The reviewer initially recommended a full rewrite. Resolution: keep the implementation, switch the cache backend, and document the boundary here instead of rewriting.

## Decision

Replace the in-memory `Mutex` cache with **Redis `SETEX` keyed at `taskbolt:twenty:health`**, TTL 15 seconds.

- Reads: `GET` the key; on hit, return cached snapshot. On miss, run the live composite check, then `SETEX` with 15s TTL.
- Writes: single live-check execution gated by a short Redis lock (`SET NX PX 5000`) to prevent thundering herd against Twenty during cache-miss bursts.
- Fallback: if Redis is unreachable (`RedisError`), bypass cache and run the live check directly. Degraded mode is correct behavior, not failure (consistent with plan line 587: Redis-down handling).

## Consequences

**Positive:**
- Multi-pod cache coherency: every TaskBolt API pod sees the same health state.
- Native TTL semantics; no manual eviction logic.
- Graceful degradation when Redis is down (live check still works, just without caching).
- Reuses existing Redis dependency; no new infra.
- Closes W11 P0 finding without a full endpoint rewrite.

**Negative:**
- Adds Redis as a runtime dependency for health checks (already required for sync queue, webhooks, rate limits — net new surface = zero).
- 15s staleness window during Twenty state transitions (acceptable; iframe state machine retries on `upgrading`/`offline`).
- Lock acquisition adds ~1 round-trip on cache miss.

## Alternatives Considered

- **Keep `tokio::sync::Mutex` per-process:** Rejected — divergent health state across pods (the original P0 finding).
- **Postgres `LISTEN`/`NOTIFY` + materialized snapshot table:** Rejected — heavier infra, slower invalidation, mixes operational signal with business data.
- **Full rewrite to push-based health (Twenty webhooks signaling state):** Rejected — Twenty does not emit health/upgrade webhooks; would require forking (violates ADR-0001).
- **No cache — live check on every request:** Rejected — multi-second composite check on every page load is a self-inflicted DoS on Twenty.
