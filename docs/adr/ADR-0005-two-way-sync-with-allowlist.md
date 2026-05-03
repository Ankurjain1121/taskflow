# ADR-0005: Two-Way Sync with Email/Phone Field Allowlist

**Status:** Accepted (2026-05-03)

## Context

Phase 6b + 6c of the integration plan (`/home/ankur/.claude/plans/donwload-twenty-one-open-purring-parasol.md`, lines 172, 175, 595, 1233, 1402-1407) specifies two-way sync between TaskBolt task drawers and Twenty CRM entities (contacts, companies, deals).

**Four-of-four voice consensus recommended deferring outbound sync to a later phase** (plan lines 1402-1407): CEO Codex called two-way sync "the highest-complexity, lowest-thankfulness pattern"; Eng Codex recommended "defer everything beyond inbound webhook ingest, cache projection, and read-only task linking." Most CRM users edit deals in the CRM, not the host app — outbound usage was projected at <5%.

**USER DECISIONS UC1 (2026-05-03)** (plan line 1463) overrode the consensus: keep two-way sync in MVP, accept ~5 days at risk if outbound usage <5%.

To make the override safer, Eng Arch1 (plan line 1233) imposed a strict directional model: **cache rows are read-only mirrors of Twenty; outbound is opt-in per-field with explicit allowlist (initially: `email`, `phone` only).** This bounds the correctness surface (race conditions, conflict resolution, idempotency) to the smallest set of fields with clear user value.

## Decision

Ship full two-way sync in MVP, **with a hard-coded outbound field allowlist of `email` and `phone` only** on the contact entity. All other fields remain read-only mirrors of Twenty (inbound-only).

The outbound queue (Phase 6b/6c) implements:

1. **Deterministic idempotency keys** per outbound job (plan lines 1137, 1283), derived from `(taskbolt_user_id, entity_id, field, new_value_hash, monotonic_ts)`. Replays are safe.
2. **Bounded retries** with exponential backoff: 3 attempts on `TimeoutError`/`UpstreamError`, 5 attempts on `DBError` (plan lines 578, 588).
3. **Dead-letter queue** (`crm_sync_dlq` table) on terminal failure, with admin UI to retry/discard (plan lines 595, 1330).
4. **Backpressure cap:** bb8-redis explicit cap=10k; on overflow → 503 Retry-After (plan line 1163).
5. Field allowlist is enforced at the API boundary (`/api/integrations/twenty/contacts/:id`) — non-allowlisted fields return 403 even if the schema would accept them.

Allowlist expansion is tracked as TODO-009 (plan line 1310); requires explicit ADR amendment.

## Consequences

**Positive:**
- Honors user decision while bounding the correctness surface to two fields.
- Idempotency + DLQ + bounded retries close the highest-risk failure modes the eng review identified.
- Read-only mirrors for everything else means cache-vs-source-of-truth conflicts can only occur on `email`/`phone` — small enough to reason about exhaustively.
- Allowlist provides a clean expansion contract: every new field gets an explicit risk review.

**Negative:**
- Up to ~5 days of engineering at risk if outbound usage <5% in production (user-acknowledged risk).
- Two-way sync infra (queue, idempotency, DLQ, conflict resolution, admin UI) carries permanent ops cost regardless of usage.
- User-perceived inconsistency: most fields edit-in-Twenty, two fields edit-anywhere — onboarding must explain this.

## Alternatives Considered

- **Defer outbound entirely (4-of-4 voice recommendation):** Rejected by user override (UC1). Eng review acknowledged this was the lower-risk path; user accepted the trade.
- **Full two-way on all contact fields:** Rejected. Multiplies race conditions, conflict cases, and DLQ surface across dozens of fields with no usage data to justify.
- **Two-way on all entities (contacts + companies + deals):** Rejected. Companies and deals have multi-user editing patterns (sales team) where Twenty must remain source of truth.
- **Last-write-wins without idempotency keys:** Rejected. Plan line 1137 mandates deterministic idempotency for replay safety; LWW without keys produces duplicate writes on retry.
