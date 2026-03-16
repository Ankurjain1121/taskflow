# UI/UX Audit Report — TaskFlow Frontend (2026-03-16)

## Anti-Patterns Verdict: WARNING

Not blocked, but clear AI slop tells in auth pages (animated gradient blobs on sign-up, inconsistent brand panels). The main app shell is well-designed with a real token system. Issues are concentrated in auth, my-tasks, and dashboard widgets.

## Executive Summary

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Accessibility | 7 | 11 | 8 | 0 |
| Theming/Dark Mode | 4 | 7 | 0 | 0 |
| Responsive | 1 (in theming) | 0 | 2 | 0 |
| Anti-Patterns/Design | 2 | 0 | 12 | 3 |
| **Total** | **14** | **18** | **22** | **3** |

### Top 5 Critical Issues
1. Gantt chart completely keyboard-inaccessible (a11y C-2, C-3)
2. `/my-tasks` route broken in dark mode — white card on dark bg (theme C-1)
3. Auth form labels not linked to inputs (a11y C-4, C-5)
4. List view has zero responsive/mobile strategy (theme C-4)
5. Animated blobs on sign-up = clearest AI slop tell (design HIGH)

---

## Accessibility Findings

### CRITICAL

| ID | File | Issue | WCAG |
|----|------|-------|------|
| C-1 | `kanban-column.component.ts:57` | Collapsed column is `<div>` with click — no keyboard access | 4.1.2, 2.1.1 |
| C-2 | `gantt-view.component.ts:118` | Gantt task rows are `<div>` with click — no keyboard access | 4.1.2, 2.1.1 |
| C-3 | `gantt-view.component.ts:191` | SVG Gantt bars have click/mousedown — completely inaccessible | 4.1.2, 2.1.1, 1.1.1 |
| C-4 | All auth forms | Error messages not linked to inputs via `aria-describedby` | 1.3.1, 3.3.1 |
| C-5 | `sign-in/sign-up` | Password `<label for>` doesn't match `p-password inputId` | 1.3.1, 4.1.2 |
| C-6 | `reset-password.component.ts:57,78` | `<a>` wrapping `<button>` — invalid HTML | 4.1.1, 4.1.2 |
| C-7 | `board-view.component.ts:544` | Error snackbar has no `role="alert"`, dismiss button no aria-label | 4.1.3 |

### HIGH

| ID | File | Issue | WCAG |
|----|------|-------|------|
| W-1 | `kanban-column.component.ts:150` | Collapse button `opacity-0` — invisible to keyboard users | 2.4.7, 2.1.1 |
| W-2 | `kanban-column.component.ts:171` | Column menu button uses `title` only — not accessible on touch | 4.1.2 |
| W-3 | `board-view-header.component.ts:68` | "More options" icon button has no accessible name | 4.1.2 |
| W-4 | `top-nav.component.ts:121,143` | Quick-create and Theme buttons use tooltip only, no aria-label | 4.1.2 |
| W-5 | `board-view.component.ts:327` | Drag-and-drop has no ARIA keyboard affordance signalling | 2.1.1 |
| W-6 | `list-view.component.ts:103,126,158` | Priority/status/due-date `<div>` with click — no keyboard | 4.1.2, 2.1.1 |
| W-7 | `list-view.component.ts:61` | Inline title edit input has no label | 1.3.1, 4.1.2 |
| W-8 | `conflict-dialog.component.ts:54` | Diff HTML uses colour alone for yours/theirs distinction | 1.4.1, 1.3.1 |
| W-9 | `global-search.component.ts:94`, `command-palette.component.ts:88` | `outline-none` with no focus-visible replacement | 2.4.7 |
| W-10 | `dashboard.component.ts:316` | View toggle buttons missing `aria-pressed` | 4.1.2 |
| W-11 | `dashboard.component.ts:152` | Stat card link icons not aria-hidden, vague link purpose | 2.4.4, 1.1.1 |

### MEDIUM

- Decorative SVGs missing `aria-hidden="true"` across board components
- No `<main>` landmark on board view (dashboard has one)
- Auth component animations not covered by `prefers-reduced-motion`
- Password strength indicator has no `aria-live`
- `text-gray-400`/`text-gray-500` fail contrast (~2.5:1 / ~3.95:1)
- `<aside>` sidebar has no `aria-label`
- WIP limit uses colour as sole indicator
- Heading hierarchy gaps in board and dashboard views

---

## Theming / Dark Mode Findings

### CRITICAL

| ID | File | Issue |
|----|------|-------|
| C-1 | `my-tasks/my-tasks.component.html` | Entire component uses `bg-white`, `border-gray-200` — broken in dark mode |
| C-2 | Auth pages (accept-invite, forgot-password, reset-password) | `text-gray-900`, `bg-yellow-100` etc. — zero dark variants |
| C-3 | `bulk-actions-bar.component.ts` | `bg-gray-900 text-white` permanently — invisible in dark mode |
| C-4 | `list-view.component.ts` | Fixed px column widths, zero responsive breakpoints, no scroll wrapper |

### HIGH

| ID | File | Issue |
|----|------|-------|
| H-1 | `admin/audit-log.component.ts` | Status badges `bg-green-100 text-green-800` — no dark variants. Same in admin-trash, admin-users |
| H-2 | `workspace/members-list/members-list.component.ts` | Role/invite badges no dark variants |
| H-3 | Chart widgets (tasks-by-status, tasks-by-priority, completion-trend) | Tooltip bg fallback hardcoded to dark hex, wrong in light mode |
| H-4 | `summary-numbers.component.ts` | Metric tile colors `#6366f1` etc. — ignore accent setting |
| H-5 | `task-detail-helpers.ts` | Due date/priority hex colors duplicate tokens |
| H-6 | `styles.css:849` | `.stat-card--warning` uses bare `#f59e0b` while others use CSS vars |
| H-7 | `favorites.component.ts` | `dark:bg-gray-800` overrides `var(--card)` with wrong dark value |

### WARNINGS

- `on-time-metric.component.ts` — RGB values instead of CSS vars
- `member-workload-card.component.ts` — inline `rgb()` border colors
- `activity-timeline.component.ts` — timeline dots no dark variants
- `themes.css:72` — dark sidebar hardcodes `#1e1e2e` and indigo active
- `notification-bell.component.ts` — `border-gray-200` vs `var(--border)` mismatch
- `word-diff.ts` — generated diff HTML uses Tailwind classes, no dark support

---

## Anti-Pattern / Design Findings

### HIGH

| File | Anti-Pattern | Fix |
|------|-------------|-----|
| `sign-up.component.ts:329-375` | Animated blob background — clearest AI slop tell | Remove 3 blob divs entirely |
| `sign-up.component.ts:393` vs `sign-in.component.ts:269` | Inconsistent brand panels (gradient vs flat) | Standardize to flat `var(--primary)` |

### MEDIUM

| File | Issue |
|------|-------|
| `my-tasks-timeline.component.ts:63` | Hero gradient with hardcoded violet `#7c3aed` — breaks accent system |
| `global-search.component.ts:57`, `command-palette.component.ts:63` | `backdrop-blur-sm` glassmorphism on modals |
| `my-tasks-timeline.component.ts:76-93` | Glassmorphism stat chips inside gradient banner |
| `my-tasks.component.ts:328`, `team-overview.component.ts:104` | Gradient empty-state icons bypass tokens |
| `summary-numbers.component.ts:122-160` | Hardcoded AI color palette (`#6366f1`/`#8b5cf6`) |
| `styles.css:849-854` | Stat card warning uses `#f59e0b` not token |
| Auth buttons (sign-in, sign-up, accept-invite) | Box-shadow tied to specific blue/indigo hex — breaks accent |
| `styles.css:914` | Bounce easing on sidebar tooltip |
| Multiple files | `onmouseover`/`onmouseout` inline DOM handlers instead of CSS hover |
| `sidebar.component.ts:461` | `var(--surface-overlay)` undefined — resolves to transparent |
| Multiple | Inconsistent border-radius — auth `1.5rem` not tokenized |

### LOW

- Sidebar workspace color array is indigo-biased
- 25-element decorative dot grid (CSS background pattern would suffice)
- ALL-CAPS widget titles feel dated (2018-era dashboard style)

---

## Positive Findings (Keep These)

1. **Comprehensive design token system** — CSS custom properties with full light/dark coverage
2. **8-color accent system** — swappable via `[data-accent]`, all with proper L/D variants
3. **`prefers-reduced-motion` respected** — all global animations guarded
4. **Task card design** — excellent density modes, priority border-top, hover-reveal actions
5. **Sidebar token isolation** — separate `--sidebar-*` layer allows independent styling
6. **Animation easing library** — `--ease-out-expo`, `--duration-fast/normal` match Linear's style
7. **CDK drag-drop polish** — `rotate(1.5deg)` preview, smooth reflow transitions
8. **OnPush everywhere** — consistent `ChangeDetectionStrategy.OnPush`
9. **Skeleton loading states** — content-shaped skeletons, not generic spinners
10. **`celebrateCheck` animation** — spring-like overshoot on task completion, branded delight

---

## Recommendations by Priority

### Immediate (blocks WCAG AA compliance)
1. Fix auth form label associations (C-4, C-5) — affects every registration
2. Add `role="alert"` to error snackbar (C-7) — one-line fix
3. Change collapsed kanban column `<div>` to `<button>` (C-1) — one-line fix
4. Fix dark mode on `/my-tasks` — replace `bg-white` with `var(--card)` (theme C-1)
5. Fix dark mode on bulk-actions bar (theme C-3)

### Short-term (this sprint)
6. Convert list-view priority/status/date `<div>` to `<button>` (W-6)
7. Add `aria-label` to all icon-only buttons (W-2, W-3, W-4)
8. Add `overflow-x-auto` + hide columns on mobile for list view (theme C-4)
9. Replace hardcoded hex in summary-numbers with CSS vars (theme H-4)
10. Remove animated blobs from sign-up (design HIGH)
11. Fix auth dark mode (theme C-2)
12. Replace status badge Tailwind colors with `--status-*` tokens (theme H-1, H-2)

### Medium-term (next sprint)
13. Gantt chart keyboard navigation (a11y C-2, C-3) — architectural
14. Add `<main>` landmark to board view
15. Fix contrast on `text-gray-400` usage
16. Replace all `onmouseover`/`onmouseout` with CSS hover
17. Standardize border-radius via tokens
18. Fix chart tooltip fallback colors

### Long-term
19. Add ARIA drag-and-drop affordances to kanban
20. Extract inline component styles to token-based CSS classes
21. Replace widget-title uppercase with modern sentence-case
