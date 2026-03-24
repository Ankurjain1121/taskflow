# Plan H5: Keyboard Shortcut Discovery Modal

**Feature:** H5 — Keyboard Shortcut Discovery Modal
**Date:** 2026-03-02
**Phase group:** H — Onboarding & Feature Discovery
**Status:** Planned

---

## Requirements

### What H5 Means

H5 is about making TaskBolt's keyboard shortcuts **discoverable** to all users, especially
non-tech-savvy ones. The existing `ShortcutHelpComponent` is a solid foundation but lacks
two critical elements:

1. **Shortcut hints on UI elements** — hover a toolbar button and see its keyboard shortcut
   inline (not just a plain tooltip string, but a styled `<kbd>` badge embedded in the tooltip)
2. **Command palette shortcut hints** — each action in the Ctrl+K palette shows the shortcut
   that triggers it directly
3. **"?" button always visible in the top nav** — users who don't know `?` is the shortcut
   have no way to discover the modal
4. **Help page integration** — the Help page lists shortcuts per category (already partial),
   but missing a "Launch Tour" button to re-open the shortcut modal from there
5. **Shortcut hint overlay on first board visit** — a one-time, auto-dismissing banner
   ("Press ? anytime to see all shortcuts") shown to users who have never opened the modal

### Sub-features In Scope

| ID | Sub-feature | Description |
|----|-------------|-------------|
| H5-A | Enhanced ShortcutHelpComponent | Add "? button" in top nav, category grouping, "Used recently" highlighting in blue (Figma pattern) |
| H5-B | Toolbar shortcut hints | Board toolbar buttons show `<kbd>` badges inside PrimeNG tooltips |
| H5-C | Command palette shortcut hints | Each quick-action in Ctrl+K palette shows the keyboard shortcut that invokes the same action |
| H5-D | First-visit shortcut banner | One-time dismissible banner on first board open: "Press ? to see keyboard shortcuts" |
| H5-E | Help page shortcut modal trigger | "Open Shortcut Reference" button on Help page that fires `helpRequested$` |

### Sub-features Explicitly OUT OF SCOPE

| Sub-feature | Reason |
|-------------|---------|
| Full product tour (H3/H4) | H3 is the onboarding checklist and H4 is contextual tooltips — separate features |
| Shortcut customization | No per-user rebinding; too complex for non-tech-savvy audience |
| Interactive spotlight tutorial | Covered by H3/H4, not H5 |
| Audio/haptic feedback | Out of scope for MVP |
| Backend persistence of "modal opened" flag | localStorage is sufficient for first-visit state; avoids backend churn |

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> **Figma's interactive panel + command palette.**
> `?` key → panel with categorized shortcuts, **recently used highlighted in blue**.
> `Cmd+K` also shows keyboard shortcut for each result.
> Lazy-load obscure shortcuts.

**The single most important gap TaskBolt has vs best-in-class:**

The `ShortcutHelpComponent` already exists and is solid (categories, search, recently-used
tracking). But Figma's key differentiator is that **the shortcut modal is visually connected
to the UI** — users discover shortcuts by using the product, not by going to a separate help
page. TaskBolt has no visual signal connecting toolbar interactions to keyboard shortcuts.
A non-tech-savvy user hovering "Clear filters (C)" in the toolbar tooltip would see it, but
the `(C)` is invisible unless they hover — and they have no reason to try.

The most impactful fix: make the `?` shortcut discoverable via a **persistent icon in the
top nav** and show **styled `<kbd>` hints in board toolbar tooltips** and **command palette
entries**.

---

## What Already Exists

| Component / Service | Location | Current State |
|---------------------|----------|---------------|
| `ShortcutHelpComponent` | `frontend/src/app/shared/components/shortcut-help/shortcut-help.component.ts` | Fully built: modal with search, 2-col grid, recently-used section. Triggered by `?` key via `helpRequested$`. Uses `KeyboardShortcutsService`. |
| `KeyboardShortcutsService` | `frontend/src/app/core/services/keyboard-shortcuts.service.ts` | Fully built: register/unregister, category grouping, recently-used signal (last 5), `helpRequested$` Subject, `formatShortcut()`, `pushDisable()`/`popDisable()`. |
| `BoardShortcutsService` | `frontend/src/app/features/board/board-view/board-shortcuts.service.ts` | Fully built: 20+ shortcuts registered across categories (Board, Navigation, Card Actions). 259 lines. |
| Board toolbar tooltips | `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | Partial: PrimeNG `pTooltip` on density/filter buttons includes shortcut key in tooltip text (e.g. `pTooltip="Compact density (D)"`). Not styled as `<kbd>`. |
| `CommandPaletteComponent` | `frontend/src/app/shared/components/command-palette/command-palette.component.ts` | Partially done: `action.shortcut` string is rendered as `<kbd>` per action already (`shortcut: 'N'`, `shortcut: 'G D'`). NOT all actions have shortcut populated. |
| `HelpComponent` | `frontend/src/app/features/help/help.component.ts` | Partial: shows shortcuts grouped by category, but no "Open Modal" button. Has `refreshShortcuts()` on `ngOnInit`. |
| `TopNavComponent` | `frontend/src/app/shared/components/top-nav/top-nav.component.ts` | Has `<kbd>Ctrl+K</kbd>` hint in search area. No `?` icon/button. |
| `EmptyStateComponent` | `frontend/src/app/shared/components/empty-state/empty-state.component.ts` | Existing variants: board, column, search, tasks, workspace, my-tasks-done, generic. No 'shortcuts' variant. |

### What Needs to Be Extended vs Built from Scratch

| Item | Action | Reason |
|------|--------|--------|
| `ShortcutHelpComponent` | Extend: add "recently used" blue highlight (change `<kbd>` color class from muted to blue for recently-used items) | Figma differentiator — visually distinguish used vs unused shortcuts |
| `TopNavComponent` | Extend: add `?` icon button that emits `helpRequested$` | Discovery entry point for non-keyboard users |
| `BoardToolbarComponent` | Extend: tooltip strings that already contain `(X)` shortcut notation stay the same; add inline `<kbd>` styled badges inside tooltip content | Better visual affordance |
| `CommandPaletteComponent` | Extend: populate `shortcut` field on the remaining quick actions (currently only `N` and `G D` are set) | Complete the Figma pattern |
| `HelpComponent` | Extend: add "Open Keyboard Shortcuts" button that calls `shortcutsService.helpRequested$.next()` | Re-trigger entry point |
| First-visit shortcut banner | Build from scratch: new inline component (not a dialog) shown in `BoardViewComponent` on first board open | New discoverability feature |

---

## Backend Changes

**No backend changes required.**

All H5 state (modal-opened flag, recently-used shortcuts) is UI-only and stored in
`localStorage`. The `KeyboardShortcutsService.recentlyUsedIds` signal is already
in-memory. No new API endpoints, no migrations, no Rust changes.

---

## Frontend Changes

### 1. `ShortcutHelpComponent` — Enhance "Recently Used" highlighting

**File:** `frontend/src/app/shared/components/shortcut-help/shortcut-help.component.ts`

**Changes:**
- In the "Recently Used" section, change the `<kbd>` element to use a blue accent color
  (Figma pattern: recently used shown in blue/primary to make them visually distinct)
- Add signal `modalOpenedBefore` that checks `localStorage.getItem('tf_shortcut_modal_opened')`
- On modal open (`visible.set(true)`), write `localStorage.setItem('tf_shortcut_modal_opened', '1')`
  so the first-visit banner knows to stop showing

**Template change for recently-used `<kbd>` elements:**
```html
<!-- Before -->
<kbd class="... text-[var(--muted-foreground)]">{{ formatShortcut(s) }}</kbd>

<!-- After: recently-used get primary color -->
<kbd class="... text-[var(--primary)] border-[var(--primary)]/30">{{ formatShortcut(s) }}</kbd>
```

### 2. `TopNavComponent` — Add `?` icon button

**File:** `frontend/src/app/shared/components/top-nav/top-nav.component.ts`

**Changes:**
- Inject `KeyboardShortcutsService`
- Add a `?` icon button in the top-right action zone (before notification bell)
- On click: call `shortcutsService.helpRequested$.next()`
- Add `pTooltip="Keyboard shortcuts (?)"` on the button
- The button renders as a small `?` glyph or a `⌨` icon in the nav

**Signal/computed additions:** none required (uses existing `helpRequested$` Subject)

**Template sketch:**
```html
<!-- In top-nav right action zone, before notification bell -->
<button
  (click)="openShortcutHelp()"
  pTooltip="Keyboard shortcuts (?)"
  tooltipPosition="bottom"
  class="w-8 h-8 flex items-center justify-center rounded-lg
         hover:bg-[var(--secondary)] text-[var(--muted-foreground)]
         hover:text-[var(--foreground)] transition-colors"
  aria-label="Open keyboard shortcuts"
>
  <span class="text-sm font-semibold select-none">?</span>
</button>
```

### 3. `CommandPaletteComponent` — Populate missing shortcut hints

**File:** `frontend/src/app/shared/components/command-palette/command-palette.component.ts`

**Changes:**
- The `QuickAction` interface already has `shortcut?: string` and `<kbd>` rendering exists.
- Currently only 2 actions have shortcut populated (`N`, `G D`). Add shortcuts to remaining
  quick actions:

| Action | Shortcut to Add |
|--------|----------------|
| Create Task | `N` (already set) |
| Go to Board | `G D` (already set) |
| Open Keyboard Shortcuts | `?` |
| Focus Filter | `F` |
| Clear Filters | `C` |
| Cycle Density | `D` |
| Focus Search | `/` |

- No structural changes needed — just populate the `shortcut` string on each action object.

### 4. `BoardToolbarComponent` — Richer shortcut hint tooltips

**File:** `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`

**Changes:**
- The existing `pTooltip="Compact density (D)"` pattern is already good UX. No structural
  change needed.
- However, add the `?` shortcut hint to the view-toggle buttons (Kanban/List/Calendar/etc.)
  that don't yet mention their shortcuts (`1`, `2`, `3`, `4`, `5`, `6`):

| Button | Current tooltip | Updated tooltip |
|--------|----------------|-----------------|
| Kanban view | `'Kanban View'` via `item.tooltip` | `'Kanban view (1)'` |
| List view | `'List View'` | `'List view (2)'` |
| Calendar view | `'Calendar View'` | `'Calendar view (3)'` |
| Gantt chart | `'Gantt Chart'` | `'Gantt chart (4)'` |
| Reports | `'Reports'` | `'Reports view (5)'` |
| Time report | `'Time Report'` | `'Time report (6)'` |

- Also add `pTooltip="Keyboard shortcuts (?)"` on any "help" or "?" icon if present in
  the toolbar (currently absent — toolbar does not have one, so no change needed here).

### 5. First-Visit Shortcut Banner — New Component

**File:** `frontend/src/app/shared/components/shortcut-discovery-banner/shortcut-discovery-banner.component.ts` (NEW)

**Angular selector:** `app-shortcut-discovery-banner`

**Purpose:** One-time dismissible banner that appears at the top of `BoardViewComponent`
on the first time a user visits a board, reminding them the `?` shortcut opens the help modal.
Disappears after: user dismisses it, user opens the modal (via any method), or 8 seconds.

**Signals:**
```typescript
readonly visible = signal(false);
```

**Computed signals:** none

**Logic:**
- On `ngOnInit`: check `localStorage.getItem('tf_shortcut_modal_opened')`. If not set,
  set `visible(true)`.
- Subscribe to `shortcutsService.helpRequested$` — on any emission, set `visible(false)`
  and write `localStorage.setItem('tf_shortcut_modal_opened', '1')`.
- Auto-dismiss after 8 seconds via `setTimeout` (cleared on `ngOnDestroy`).
- Dismiss button writes `localStorage.setItem('tf_shortcut_dismissed_banner', '1')` and
  sets `visible(false)`.

**Template sketch:**
```html
@if (visible()) {
  <div
    class="flex items-center gap-3 px-4 py-2.5 bg-[var(--primary)]/8
           border-b border-[var(--primary)]/20 text-sm
           text-[var(--foreground)] animate-fade-in"
    role="status"
  >
    <span class="text-[var(--primary)]">⌨</span>
    <span>
      Press
      <kbd class="mx-1 px-1.5 py-0.5 text-xs font-mono bg-[var(--secondary)]
                  border border-[var(--border)] rounded">?</kbd>
      anytime to see all keyboard shortcuts
    </span>
    <button
      (click)="dismiss()"
      class="ml-auto text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1"
      aria-label="Dismiss"
    >
      <svg class="w-3.5 h-3.5" ...><!-- × icon --></svg>
    </button>
  </div>
}
```

**Placement:** Inside `BoardViewComponent` template, immediately below the toolbar and
above the kanban columns (inside the board-root container, outside the scrollable column area).

### 6. `BoardViewComponent` — Wire the Banner

**File:** `frontend/src/app/features/board/board-view/board-view.component.ts`

**Changes:**
- Import and add `ShortcutDiscoveryBannerComponent` to the `imports` array
- Insert `<app-shortcut-discovery-banner>` in template between toolbar and the kanban area

**No signal changes required** — banner is self-contained.

### 7. `HelpComponent` — Add "Open Keyboard Shortcuts" button

**File:** `frontend/src/app/features/help/help.component.ts`

**Changes:**
- Inject `KeyboardShortcutsService`
- Add a prominent button in the "Keyboard Shortcuts" section header area:
  `"Open Keyboard Shortcuts Reference"` → calls `shortcutsService.helpRequested$.next()`
- The button triggers the full modal, which has search + categories + recently used

**Template sketch (in the Keyboard Shortcuts section):**
```html
<div class="flex items-center justify-between mb-4">
  <h2 class="text-lg font-semibold ...">Keyboard Shortcuts</h2>
  <button
    (click)="openShortcutModal()"
    class="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg
           border border-[var(--border)] hover:bg-[var(--secondary)]
           text-[var(--foreground)] transition-colors"
  >
    <kbd class="text-xs font-mono">?</kbd>
    Open Reference
  </button>
</div>
```

---

## Phased Implementation

### Phase 1 — Frontend-Only, No Backend (Recommended shipping order)

All H5 changes are frontend-only. Implement in this order:

**Phase 1a — Core modal improvements (highest value, zero risk):**

1. `ShortcutHelpComponent`: add blue highlight to recently-used `<kbd>` elements;
   write `tf_shortcut_modal_opened` to localStorage on modal open.
2. `TopNavComponent`: add `?` icon button → emits `helpRequested$`.
3. `HelpComponent`: add "Open Keyboard Shortcuts Reference" button → emits `helpRequested$`.

**Phase 1b — Discoverability surface improvements:**

4. `CommandPaletteComponent`: populate `shortcut` field for all quick actions
   that have a corresponding keyboard shortcut.
5. `BoardToolbarComponent`: update view-mode button tooltip strings to include their
   shortcut key (`(1)` through `(6)`).

**Phase 1c — First-visit banner:**

6. Create `ShortcutDiscoveryBannerComponent` (new file, ~60 lines).
7. `BoardViewComponent`: import banner, add `<app-shortcut-discovery-banner>` in template.

### Phase 2 — Trivial Backend Additions

None required for H5.

### Phase 3 — Complex Features (Optional)

None for H5. The scope is intentionally constrained: H5 is about shortcut _discovery_,
not shortcut _customization_ or a new tour framework (those belong to H3/H4).

---

## File Change List

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/shared/components/shortcut-help/shortcut-help.component.ts` | MODIFY | Add blue `<kbd>` color for recently-used items; write `tf_shortcut_modal_opened` flag to localStorage on open |
| `frontend/src/app/shared/components/top-nav/top-nav.component.ts` | MODIFY | Inject `KeyboardShortcutsService`; add `?` icon button in right action zone that emits `helpRequested$` |
| `frontend/src/app/features/help/help.component.ts` | MODIFY | Inject `KeyboardShortcutsService`; add "Open Keyboard Shortcuts Reference" button in shortcuts section header |
| `frontend/src/app/shared/components/command-palette/command-palette.component.ts` | MODIFY | Populate `shortcut` string on remaining quick actions (F, C, D, /, ?) |
| `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | MODIFY | Update view-mode item tooltip strings to include shortcut key `(1)`–`(6)` |
| `frontend/src/app/shared/components/shortcut-discovery-banner/shortcut-discovery-banner.component.ts` | CREATE | New standalone component: first-visit shortcut discovery banner (~60 lines) |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | MODIFY | Import `ShortcutDiscoveryBannerComponent`; add `<app-shortcut-discovery-banner>` in template |

**Total files changed: 6 modified + 1 created = 7 files**

No new packages required. No backend files changed.

---

## Signal Architecture

No new services or signals are introduced. H5 reuses existing infrastructure:

| Signal / Service | Source | Used by |
|-----------------|--------|---------|
| `KeyboardShortcutsService.helpRequested$` | `keyboard-shortcuts.service.ts` | `TopNavComponent` (emit), `HelpComponent` (emit), `ShortcutDiscoveryBannerComponent` (subscribe to dismiss) |
| `KeyboardShortcutsService.recentlyUsedIds` | `keyboard-shortcuts.service.ts` | `ShortcutHelpComponent` (read for blue highlight) |
| `ShortcutDiscoveryBannerComponent.visible` | Local `signal(false)` | Self-contained; read from `localStorage` |

---

## Success Criteria Checklist

### Core Modal (H5-A)

- [ ] `?` key opens `ShortcutHelpComponent` modal (existing — verify still works)
- [ ] Modal shows categorized shortcuts (Board / Navigation / Card Actions / Global)
- [ ] "Recently Used" section shows last 5 shortcuts used, with `<kbd>` elements rendered
      in blue/primary color (visually distinct from unused shortcuts)
- [ ] Search box filters shortcuts in real-time
- [ ] `Escape` or backdrop click closes the modal
- [ ] Opening the modal writes `tf_shortcut_modal_opened` flag to localStorage

### Top Nav `?` Button (H5-A)

- [ ] A `?` icon button is visible in the top-nav right action zone
- [ ] Hovering the button shows tooltip `"Keyboard shortcuts (?)"` via PrimeNG
- [ ] Clicking the button opens the shortcut help modal
- [ ] Button is accessible: has `aria-label="Open keyboard shortcuts"`

### Command Palette Shortcut Hints (H5-C)

- [ ] Opening Ctrl+K shows quick actions
- [ ] Quick actions with keyboard equivalents display a `<kbd>` badge: F (filter),
      C (clear), D (density), / (search), ? (shortcuts modal)
- [ ] `<kbd>` badge renders with `bg-[var(--secondary)]` rounded styling (matching existing style)
- [ ] No regression: actions without shortcuts show no badge

### Board Toolbar Tooltip Improvements (H5-B)

- [ ] All 6 view-mode toggle buttons show shortcut in tooltip: `"Kanban view (1)"`,
      `"List view (2)"`, `"Calendar view (3)"`, `"Gantt chart (4)"`,
      `"Reports view (5)"`, `"Time report (6)"`
- [ ] Existing density tooltips unchanged (`"Compact density (D)"` etc.)

### First-Visit Shortcut Banner (H5-D)

- [ ] On first board visit (no `tf_shortcut_modal_opened` in localStorage), a thin banner
      appears below the board toolbar
- [ ] Banner shows: `Press [?] anytime to see all keyboard shortcuts` with styled `<kbd>`
- [ ] Banner has a close `×` button; clicking it dismisses and does not show again
      (writes `tf_shortcut_dismissed_banner` to localStorage)
- [ ] Opening the shortcut modal (any method) auto-dismisses the banner
- [ ] Banner auto-dismisses after 8 seconds
- [ ] On second board visit (flag set), banner does NOT appear
- [ ] Banner uses `animate-fade-in` class and has accessible `role="status"`

### Help Page Integration (H5-E)

- [ ] Help page Keyboard Shortcuts section has an "Open Reference" button
- [ ] Clicking "Open Reference" opens the shortcut modal
- [ ] Existing shortcut group display (loaded via `refreshShortcuts()`) still renders

### Build Checks

- [ ] `cd frontend && npx tsc --noEmit` — zero errors
- [ ] `npm run build -- --configuration=production` — succeeds within bundle budget
- [ ] No new `console.log` statements
- [ ] No mutation of existing objects
- [ ] All new component files < 200 lines

### No Orphaned Code

- [ ] Every new component is imported in at least one consuming component
- [ ] No backend endpoint created without a frontend consumer (N/A — no backend changes)
- [ ] `ShortcutDiscoveryBannerComponent` has exactly one consumer: `BoardViewComponent`

---

## Implementation Notes

### localStorage Key Namespace

Use `tf_` prefix consistent with existing keys in the codebase (`tf_card_density`,
`tf_sidebar_recent`, etc.):

| Key | Purpose |
|-----|---------|
| `tf_shortcut_modal_opened` | Set when modal is opened for the first time; suppresses banner |
| `tf_shortcut_dismissed_banner` | Set when user explicitly dismisses the banner |

### Angular Patterns to Follow

- `ShortcutDiscoveryBannerComponent`: standalone, `ChangeDetectionStrategy.OnPush`
- Use `inject()` not constructor injection for services in new component
- Use `input()` / `output()` signals for any bindings (none needed here — fully self-contained)
- Subscribe to `helpRequested$` using `takeUntilDestroyed()` from `@angular/core/rxjs-interop`
  to avoid memory leaks in the banner component

### Why No Service Is Needed

A dedicated `FeatureTourService` (mentioned in section-08) is scoped to H3/H4 (onboarding
checklist + contextual tooltips). H5 is purely about shortcut discovery; the two localStorage
flags and the `helpRequested$` Subject are sufficient — no new service required.

### PrimeNG Usage

- `Tooltip` directive from `primeng/tooltip` is already imported in `BoardToolbarComponent`
  and `TopNavComponent` — no new PrimeNG modules needed
- The `?` button in top-nav uses the same `pTooltip` + `tooltipPosition="bottom"` pattern
  already used on other nav buttons

---

## Relationship to Other H Features

| Feature | Dependency |
|---------|-----------|
| H1 (Empty States) | Parallel — H5 does not depend on H1 and does not affect it |
| H2 (Sample Data on Signup) | Parallel — independent |
| H3 (Onboarding Checklist) | H3 may include a checklist item "Learn keyboard shortcuts" that calls `helpRequested$`; H5 provides the target. H5 should be implemented before H3. |
| H4 (Contextual Tooltips) | H4's `ContextualTooltipComponent` may reference shortcuts discovered via H5's modal. H5 first. |
