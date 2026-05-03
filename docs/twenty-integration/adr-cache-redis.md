# ADR: Redis for Twenty Health-Check Cache

**Status:** Accepted  
**Date:** 2026-05-03  
**Context:** Phase 8 — Twenty CRM integration

## Decision

The Twenty health-check handler (`GET /api/integrations/twenty/health`) caches its result in Redis with a 30-second TTL (`SET_EX`) rather than using an in-process `Mutex<Option<(Instant, Result)>>` cache.

## Rationale

| Concern | Redis | In-process Mutex |
|---------|-------|-----------------|
| Multi-pod cache coherency | Shared across all API replicas — one hit warms all pods | Each pod maintains its own cache; burst traffic during a rolling deploy hits Twenty once per pod per 30 s |
| TTL semantics | Native (`SET_EX`) — no boilerplate, atomic expiry | Manual `Instant` arithmetic; must handle overflow and clock skew |
| Cache invalidation | Can flush `twenty_health_status` key from ops tooling at any time | Requires a rolling restart or a new internal endpoint |
| Failure mode | If Redis is unreachable the handler falls back to a live HTTP check (logs a warning; no panic) | No equivalent failure mode — the mutex always responds |

The Redis option is strictly better for a horizontally-scalable deployment. The added failure-mode risk (Redis down) is mitigated by the fallback path added in `twenty_health_handler`: a `match` on `redis.get(...)` logs a warning and proceeds with a live check rather than returning an error or panicking.

## Consequences

- **+** Consistent health results across pods; no thundering-herd on Twenty on pod restart.
- **+** Ops can force a cache refresh via `redis-cli DEL twenty_health_status`.
- **-** An additional Redis round-trip per request (mitigated by the 30-second TTL reducing live-check frequency).
- **-** Cold-start behaviour when Redis is unreachable: falls through to live check (acceptable; logged as WARN).
