# ADR-0002: Embed Twenty via Iframe with Intentional Visual Separation

**Status:** Accepted (2026-05-03)

## Context

The original UX direction for the TaskBolt + Twenty integration aimed for a "fake-seamless" experience — Twenty's iframe themed to match TaskBolt's active palette (one of 29 themes including Warm Earth, Sea Foam, Cosmic, etc.) so users would not perceive a boundary.

The W1 tech-audit (Phase 0.5b feasibility, plan lines 1490, 1057, 904) tested Twenty's theming surface and confirmed Twenty exposes **no theme-injection mechanism deep enough to bridge font, radius, spacing, or surface tokens** — at most a primary color override. Attempting fake seamlessness would therefore produce a partial, uncanny-valley result that fails on every TaskBolt theme.

Both CEO voices (plan line 904: "AI slop MEDIUM — embrace intentional separation") and the design review (plan lines 944, 969-975, 1057) converged on the alternative: **own the seam honestly**. CEO Claude framed it as "you're integrating, not merging — own it" (line 1428).

## Decision

Embed Twenty in an iframe with an explicit, branded **TaskBolt CRM Bar** (40px high, full-width, anchored above the iframe). The bar carries TaskBolt's active theme (color, font, radius) and contains: app identity, sync health chip, "Open in new tab" affordance, and state-machine UI (`loading`, `offline`, `csp_blocked`, `upgrading`, `error`, `disconnected` per plan lines 969-975).

The iframe area itself remains Twenty-default styling — no CSS injection, no theme bridging beyond what Twenty natively supports. The 40px bar **is** the brand boundary, communicating "you are now in the CRM module" without pretending otherwise.

## Consequences

**Positive:**
- Honest UX; no broken half-themed Twenty surface across 29 TaskBolt themes.
- Zero coupling to Twenty's CSS or component internals — survives Twenty version bumps unchanged (supports ADR-0004).
- Clear ownership: TaskBolt owns chrome and orchestration; Twenty owns CRM rendering.
- Failure states (CSP block, upgrade-in-progress, offline) have a stable surface to render in.

**Negative:**
- Visible seam between TaskBolt theme and Twenty default. Some users may perceive it as "two apps glued together" rather than one product.
- 40px of vertical space lost to chrome on the CRM page.
- Cannot match Twenty's typography to user's selected TaskBolt font pair (e.g., Syne + DM Sans for Warm Earth).

## Alternatives Considered

- **Full theme bridging (color + font + radius + spacing):** Rejected. W1 audit confirmed Twenty's theme API does not expose these tokens; would require forking Twenty (violates ADR-0001).
- **Color-only injection, hide everything else:** Rejected. Produces uncanny-valley result — colors match but typography/spacing clash, signaling broken integration rather than intentional one.
- **Redirect to Twenty subdomain (no embedding):** Rejected. Loses unified shell; user leaves TaskBolt context entirely; sync health and cross-links become harder to surface.
- **Reverse-proxy + CSS rewrite at nginx layer:** Rejected. Brittle, breaks on every Twenty release, effectively a fork by another name.
