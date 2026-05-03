# ADR-0004: No Watchtower — Renovate-Only Flow for Twenty Image Bumps

**Status:** Accepted (2026-05-03)

## Context

Phase 8a of the original plan (`/home/ankur/.claude/plans/donwload-twenty-one-open-purring-parasol.md`, lines 215-226) proposed [Watchtower](https://containrrr.dev/watchtower/) as the auto-update control plane for Twenty containers: nightly checks at 03:00 IST, scoped via labels, with custom pre-update `pg_dump` and post-update health gates plus auto-rollback on failure.

Both eng review voices flagged this as a SPOF + observability gap (plan lines 1146, 1239, 1377, 1432-1436):
- Watchtower owning both update execution and monitoring means: if Watchtower fails silently, no update **and** no alert.
- Schema-irreversible migrations (e.g., a future Twenty release dropping a column) cannot be rolled back by re-tagging the image (plan line 1165).
- Lifecycle hook scripts (pre-pull `pg_dump`, post-update health check, rollback re-tagging) duplicate logic that already belongs in CI.

Per **USER DECISIONS UC5 (2026-05-03)** (plan line 1467), Watchtower is dropped entirely. All Twenty bumps — including patch versions — flow through Renovate PRs gated by human review and CI.

## Decision

Remove Watchtower from `docker-compose.yml`. Use **Renovate-only** for every Twenty image bump:

1. Renovate watches the Twenty image tag in `docker-compose.yml` at **patch + minor + major granularity**.
2. **Patch PRs** (`v2.5.1` → `v2.5.2`): auto-approve label applied **after** CI passes (CI = ephemeral docker-compose stack + 5-step smoke per plan lines 1500-1501). Human still merges.
3. **Minor PRs** (`v2.5` → `v2.6`): require human review of release notes + smoke checklist (Renovate fetches release notes from GitHub).
4. **Major PRs** (`v2.x` → `v3.0`): `automerge: false`; treated as planned maintenance window with full smoke run + rollback plan.
5. CD pipeline (not Watchtower) executes the deploy on merge.

## Consequences

**Positive:**
- Strictly safer: every bump gated by human + CI tests against the proposed Twenty version.
- No SPOF: Watchtower failure mode (silent no-update + no-alert) eliminated.
- Schema-breaking changes caught in CI smoke before reaching production.
- Effort drops from 2-3 days (Watchtower lifecycle hooks + rollback scripts) to 1-2 days.
- Single source of truth for "what's deployed": git history of merged PRs.

**Negative:**
- ~10 minute latency per patch (PR review + merge) vs. theoretical zero-touch nightly auto-update.
- Requires a human in the loop for every patch — not true zero-touch ops.
- Renovate GitHub App must be installed and maintained (one-time setup per plan line 1702).

## Alternatives Considered

- **Watchtower-only (original plan):** Rejected. SPOF + observability gap; cannot roll back schema-breaking migrations; both eng voices unanimous against.
- **Watchtower for patches + Renovate for minor/major (hybrid):** Rejected. Splits the deploy surface across two systems with different failure semantics; Watchtower SPOF still present for patch path.
- **Full manual updates (no Renovate either):** Rejected. Loses release-notes automation and patch-cadence visibility; encourages drift.
- **Argo CD / Flux GitOps:** Rejected. Heavier infra than warranted for one external image; revisit if more bundled OSS apps are added.
