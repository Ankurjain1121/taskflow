# Phase 0.5b — Tech Feasibility Audit: Twenty CRM Embedding

**Date:** 2026-05-03  
**Branch:** crm/phase-0.5b-tech  
**Auditor:** Agent W1 (static source analysis, no runtime)  
**Twenty source:** `/home/ankur/projects/twenty-research/twenty` (HEAD, depth-1 clone)

---

## 1. CSP / iframe Verdict: ALLOW_IFRAME

**Twenty's app server sets no frame-blocking headers.**

### Evidence

| Location | Finding |
|----------|---------|
| `packages/twenty-server/src/main.ts:30-45` | `NestFactory.create()` with only `cors: { exposedHeaders: ['WWW-Authenticate'] }`. No `helmet()` middleware registered at any point. |
| `packages/twenty-server/src/main.ts` (full file) | No `X-Frame-Options`, no `Content-Security-Policy`, no `helmet` import anywhere. |
| `packages/twenty-front/index.html:1-93` | No CSP `<meta>` tag, no `X-Frame-Options` meta equivalent. |
| `packages/twenty-front/src/modules/app/components/App.tsx` | `react-helmet-async` used only for page `<title>` and favicon — no security headers set. |
| `packages/twenty-server/src/engine/core-modules/session-storage/session-storage.module-factory.ts:33-38` | Session cookie: `{ secure: <https-based>, httpOnly: true, sameSite: 'lax', maxAge: 1800000 }` |

**FALSE POSITIVE WARNING:** `packages/twenty-website-new/next.config.ts:15-16` sets `X-Frame-Options: DENY` + `CSP: frame-ancestors 'none'` — but this is the **marketing website** (`twenty-website-new`), not the CRM app. Irrelevant to embedding.

### Cookie behavior at same-site embed

`taskflow.paraslace.in` and `crm.taskflow.paraslace.in` share eTLD+1 `paraslace.in` → they are **same-site**. `SameSite=Lax` cookies are sent on same-site iframe loads. No third-party cookie issue.

### Required nginx action (security hardening, not unblocking)

Twenty ships with zero frame-ancestors policy. Add to nginx `crm.taskflow.paraslace.in` vhost:

```nginx
add_header Content-Security-Policy "frame-ancestors 'self' https://taskflow.paraslace.in" always;
```

This whitelists only TaskBolt as the embedding origin without modifying Twenty source.

---

## 2. Theme Injection Depth: NONE (via env or postMessage)

**Twenty exposes no supported mechanism to inject CSS variables, colors, fonts, radius, or spacing from outside.**

### Evidence

| Location | Finding |
|----------|---------|
| `packages/twenty-server/src/utils/generate-front-config.ts:11-17` | Only injects `REACT_APP_SERVER_BASE_URL` into `window._env_`. No color, font, spacing, or radius env vars exist. |
| `packages/twenty-server/src/engine/core-modules/twenty-config/` | No `PRIMARY_COLOR`, `BRAND_COLOR`, `THEME_*`, or CSS variable env keys in any config file. |
| `packages/twenty-ui/src/theme-constants/ThemeProvider.tsx:50-82` | Theme IS CSS-variable-based: reads `var(--t-*)` vars from `getComputedStyle(document.documentElement)`. Theoretically overridable from within the document. |
| `packages/twenty-ui/src/theme-constants/themeCssVariables.ts:3-80+` | All design tokens are `var(--t-*)` CSS variables: color, spacing, radius, typography, animation. |
| `packages/twenty-front/src` (full grep for `postMessage\|addEventListener.*message`) | **No postMessage listener** in the app. No channel to inject theme tokens from a parent frame. |

### What this means

| Injection path | Feasible? | Notes |
|----------------|-----------|-------|
| Env var at startup | **NO** | `generate-front-config.ts` only passes server URL |
| `postMessage` from TaskBolt parent | **NO** | No listener exists in Twenty front |
| nginx `sub_filter` CSS injection | Technically yes | Not a supported Twenty mechanism; requires `proxy_set_header Accept-Encoding ""` + `sub_filter` rewrite; fragile on upgrades |
| Modify `generate-front-config.ts` | Yes but AGPL | Modifying Twenty source → must release under AGPL |
| Twenty workspace logo/icon | **YES (logo only)** | Twenty admin settings allow workspace logo/icon upload via their UI. Colors are not configurable. |

### Practical consequence

Twenty will render with its own design language (light/dark, gray palette, Inter/DM Mono fonts). It will not inherit TaskBolt's Warm Earth tokens or any other TaskBolt theme. The iframe will look visually distinct from the TaskBolt shell — this is expected and acceptable under AGPL-safe Approach A.

---

## 3. Mobile Usability at 375px: DEGRADED

**Twenty has a mobile code path at 768px breakpoint. It renders a MobileNavigationBar at 375px, but data-dense CRM views (pipeline, record tables) are not optimized for narrow viewports.**

### Evidence

| Location | Finding |
|----------|---------|
| `packages/twenty-ui/src/theme-constants/constants.ts:3` | `export const MOBILE_VIEWPORT = 768;` — breakpoint is 768px |
| `packages/twenty-front/src/modules/ui/utilities/responsive/hooks/useIsMobile.ts:4` | `useMediaQuery({ query: '(max-width: 768px)' })` — true at 375px |
| `packages/twenty-front/src/modules/ui/layout/page/components/DefaultLayout.tsx:65,129` | `isMobile` replaces sidebar `AppNavigationDrawer` with bottom `MobileNavigationBar` |
| `packages/twenty-front/src/modules/navigation/components/MobileNavigationBar.tsx:28-113` | 3-item bottom bar: List (hamburger), Search, AI Chat. Functional but minimal. |
| `packages/twenty-front/src/modules/ui/layout/page/components/ShowPageContainer.tsx:35-46` | Uses `mobileStyle` overrides when `isMobile`. |
| `packages/twenty-front/src/modules/ui/layout/page/components/PageHeader.tsx:50` | `@media (max-width: 768px)` rule adjusts header layout. |
| Multiple `@media (max-width: ${MOBILE_VIEWPORT}px)` | Spread across `TableRow`, `EventCard`, `EventRowActivity`, `AddressInput`, `SettingsApiWebhooks`, `UserOrMetadataLoader` |

### Assessment

- **Navigation:** Works — bottom nav bar replaces sidebar at 375px.
- **Record lists / kanban pipeline:** Multi-column data grids will overflow at 375px. No evidence of column hiding or card-stacking at narrow widths.
- **Record detail (show-page):** Has mobile style overrides — functional but cramped.
- **Verdict:** A user can open Twenty at 375px and navigate, but editing deals, viewing pipeline boards, or managing contact tables will require horizontal scrolling and is not a first-class mobile experience.

**For Phase 5 (iframe shell):** The iframe's viewport is set by the container div inside TaskBolt. If the container is full-width at 375px, Twenty activates its mobile layout. The mobile nav bar duplicates TaskBolt's nav — minor UX issue. Recommend: on mobile, fall back to a direct link/redirect to `crm.taskflow.paraslace.in` rather than iframe embedding.

---

## 4. Phase 5 Path: IFRAME_OK (desktop) / REDIRECT_FALLBACK (mobile)

### Summary

| Dimension | Finding | Phase 5 consequence |
|-----------|---------|---------------------|
| Server blocks iframe | **NO** — no X-Frame-Options, no CSP frame-ancestors in app server | Iframe is unblocked by default |
| Cookie compatibility | **YES** — `SameSite=Lax`, same-site embedding | Session persists in iframe |
| Theme unification | **NOT POSSIBLE** via env/postMessage | Twenty retains its own design language; add a visual separator in the TaskBolt shell |
| Mobile at 375px | **DEGRADED** — mobile layout exists but CRM views are cramped | Use `useIsMobile()` in TaskBolt: show iframe on desktop, redirect link on mobile |

### Recommended Phase 5 implementation

```typescript
// In frontend/src/app/features/crm/crm-shell.component.ts
if (isMobile) {
  // Open crm.taskflow.paraslace.in in new tab or navigate directly
  window.open(crmUrl, '_blank');
} else {
  // Render <iframe [src]="crmUrl"> with full-height container
}
```

Nginx vhost for `crm.taskflow.paraslace.in`:
```nginx
add_header Content-Security-Policy "frame-ancestors 'self' https://taskflow.paraslace.in" always;
# Do NOT add X-Frame-Options — it is deprecated and overridden by CSP frame-ancestors
```

---

## Appendix: Files Audited

| File | Purpose |
|------|---------|
| `packages/twenty-server/src/main.ts` | NestJS bootstrap, middleware registration |
| `packages/twenty-server/src/engine/core-modules/session-storage/session-storage.module-factory.ts` | Cookie config |
| `packages/twenty-server/src/utils/generate-front-config.ts` | Env → window._env_ injection |
| `packages/twenty-front/index.html` | SPA entry, meta tags, inline config |
| `packages/twenty-front/src/modules/ui/theme/components/BaseThemeProvider.tsx` | Theme wiring |
| `packages/twenty-ui/src/theme-constants/ThemeProvider.tsx` | CSS variable resolution |
| `packages/twenty-ui/src/theme-constants/themeCssVariables.ts` | Full `var(--t-*)` token map |
| `packages/twenty-ui/src/theme-constants/constants.ts` | `MOBILE_VIEWPORT = 768` |
| `packages/twenty-front/src/modules/ui/utilities/responsive/hooks/useIsMobile.ts` | Mobile detection |
| `packages/twenty-front/src/modules/ui/layout/page/components/DefaultLayout.tsx` | Root layout, mobile branching |
| `packages/twenty-front/src/modules/navigation/components/MobileNavigationBar.tsx` | Mobile nav component |
| `packages/twenty-website-new/next.config.ts` | Marketing site headers (NOT the CRM app) |
