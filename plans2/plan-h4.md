# Plan H4: Product Tours / Contextual Tooltips

> Feature: H4 from TASK.md | Phase: H (Onboarding & Feature Discovery)
> Stack: Angular 19 + Tailwind CSS 4 + PrimeNG 19 | Rust/Axum backend
> Created: 2026-03-02

---

## Requirements

H4 implements a non-blocking contextual help system that teaches users about TaskFlow features through in-context hints rather than forced modal tours. The approach follows the Asana pattern (3x higher completion rate than linear Shepherd-style tours).

### Sub-features IN SCOPE

1. **Feature Hints Service** -- Central service tracking which contextual hints a user has seen/dismissed, persisted in localStorage with optional backend sync.
2. **Contextual Hint Component** -- Floating "Did you know?" hint bubbles that appear near underused features. Max 1 per session. Permanently dismissible via "Got it" button.
3. **Spotlight Overlay (First-Run Only)** -- A semi-transparent overlay with a spotlight cutout highlighting key UI elements on first board visit. 3-step walkthrough: (1) Board columns, (2) Quick filters, (3) Keyboard shortcuts. Skippable.
4. **Enhanced Empty-State Micro-Copy** -- Upgrade existing `EmptyStateComponent` with richer, action-oriented copy for board columns and other empty areas. Include shortcut hints inline.
5. **Help Icons on Advanced Features** -- Small `?` icon buttons on advanced toolbar controls (Group By, Density, Filter Presets) that open a short contextual explanation popover.

### Sub-features OUT OF SCOPE

- **Microvideos / GIF tutorials** -- Requires video hosting infrastructure and content creation. Defer to I-phase or later.
- **Backend-synced hint state** -- Phase 2 enhancement. Phase 1 uses localStorage only.
- **Feature Dashboard page** -- Covered by H-phase Task 4 in the ultraplan (separate from H4).
- **Onboarding checklist** -- Covered by H3 (separate feature).

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> **Asana pattern: no modal tours.** Instead:
> 1. Empty-state micro-copy as contextual teaching moments
> 2. Hover tooltips with shortcut hint on advanced features
> 3. Optional microvideos (30-60s GIFs) behind ? icons
> 4. First-run-only contextual overlays
>
> Completion rate 3x higher than Shepherd-style linear tours.

### Most Important Gap

TaskFlow currently has only basic PrimeNG `pTooltip` on a few toolbar buttons. There is:
- No first-run contextual overlay/spotlight
- No "Did you know?" contextual hints for underused features
- No `?` help icons on advanced features
- Empty column states show a generic icon + text with no action guidance

---

## What Already Exists

| File | What It Does | Reuse? |
|------|-------------|--------|
| `frontend/src/app/shared/components/empty-state/empty-state.component.ts` | Generic empty state with icon + title + description + CTA button. 7 variants. | EXTEND -- add new variants with richer micro-copy |
| `frontend/src/app/shared/components/shortcut-help/shortcut-help.component.ts` | Full keyboard shortcuts modal (? key trigger) | REUSE -- reference from contextual hints |
| `frontend/src/app/features/help/help.component.ts` | Help page with features list, FAQ, keyboard shortcuts | EXTEND -- add "Restart Tour" button |
| `frontend/src/app/core/services/keyboard-shortcuts.service.ts` | Global keyboard shortcut management | REUSE -- integrate with spotlight overlay |
| `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | Board toolbar with filters, density, group-by | MODIFY -- add ? help icons |
| `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` | Kanban column with task cards | MODIFY -- enhance empty column state |
| PrimeNG `Tooltip` directive (`pTooltip`) | Already used on toolbar buttons | REUSE -- extend with shortcut hints |
| Angular CDK `Overlay` | Already a dependency for card quick-edit popovers | REUSE -- for spotlight + hint positioning |

---

## Backend Changes

### Phase 1: No Backend Changes Required

All hint/tour state is persisted in `localStorage` keyed by user ID to prevent cross-user leakage on shared browsers.

### Phase 2 (Optional): Persist Hint State Server-Side

**Migration:** Add `dismissed_hints JSONB DEFAULT '{}'::jsonb` column to `user_preferences` table.

```sql
-- 20260303000010_dismissed_hints.sql
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS dismissed_hints JSONB DEFAULT '{}'::jsonb NOT NULL;
```

**API changes:** Extend existing `PUT /api/users/me/preferences` to accept `dismissed_hints` field. No new routes needed.

**DB model change:** Add `pub dismissed_hints: serde_json::Value` to `UserPreferences` struct.

---

## Frontend Changes

### New Components

#### 1. `FeatureHintsService` (CREATE)
**Path:** `frontend/src/app/core/services/feature-hints.service.ts`
**Selector:** N/A (injectable service)

Signal-based service managing contextual hint state.

```
Signals:
  - dismissedHints: signal<Set<string>>  -- loaded from localStorage
  - activeHint: signal<string | null>    -- currently showing hint ID (max 1)
  - hasSeenSpotlight: signal<boolean>    -- first-run spotlight completed

Methods:
  - isHintDismissed(hintId: string): boolean
  - dismissHint(hintId: string): void
  - showHint(hintId: string): boolean     -- returns false if already dismissed
  - completeSpotlight(): void
  - resetAll(): void                      -- for "Restart Tour" from Help page

Persistence:
  - localStorage key: `tf_hints_${userId}`
  - effect() auto-syncs to localStorage on change
```

#### 2. `ContextualHintComponent` (CREATE)
**Path:** `frontend/src/app/shared/components/contextual-hint/contextual-hint.component.ts`
**Selector:** `<app-contextual-hint>`

Floating bubble that appears near a target element with a "Did you know?" message.

```
Inputs:
  - hintId: string                       -- unique identifier
  - targetRef: ElementRef | string       -- element to attach near (or CSS selector)
  - message: string                      -- hint text
  - shortcutKey: string (optional)       -- keyboard shortcut to display
  - position: 'top' | 'bottom' | 'left' | 'right'  -- preferred position
  - delay: number                        -- ms delay before showing (default 2000)

Outputs:
  - dismissed: EventEmitter<void>

Behavior:
  - Checks FeatureHintsService.isHintDismissed(hintId) on init
  - Shows after delay if not dismissed, max 1 hint per session
  - "Got it" button permanently dismisses
  - Auto-positions using CDK FlexibleConnectedPositionStrategy
  - Animates in/out with CSS transition (opacity + translateY)
```

Template sketch:
```html
<div class="absolute z-40 max-w-xs p-4 rounded-xl shadow-lg border
            bg-[var(--card)] border-[var(--primary)]/30">
  <div class="flex items-start gap-3">
    <span class="text-[var(--primary)] text-lg flex-shrink-0">
      <!-- lightbulb icon -->
    </span>
    <div>
      <p class="text-sm font-medium text-[var(--foreground)]">Did you know?</p>
      <p class="text-sm text-[var(--muted-foreground)] mt-1">{{ message }}</p>
      @if (shortcutKey) {
        <kbd class="mt-1 inline-block px-1.5 py-0.5 text-xs font-mono
                     bg-[var(--secondary)] rounded border border-[var(--border)]">
          {{ shortcutKey }}
        </kbd>
      }
    </div>
  </div>
  <div class="flex justify-end mt-3">
    <button class="text-xs font-medium text-[var(--primary)]
                    hover:text-[var(--primary)]/80 transition-colors"
            (click)="dismiss()">
      Got it
    </button>
  </div>
  <!-- Arrow indicator pointing to target -->
  <div class="absolute w-3 h-3 bg-[var(--card)] border border-[var(--primary)]/30
              rotate-45 ...position-dependent..."></div>
</div>
```

#### 3. `SpotlightOverlayComponent` (CREATE)
**Path:** `frontend/src/app/shared/components/spotlight-overlay/spotlight-overlay.component.ts`
**Selector:** `<app-spotlight-overlay>`

Full-screen semi-transparent overlay with a spotlight cutout around a target element. Used for first-run-only walkthrough (3 steps).

```
Inputs:
  - steps: SpotlightStep[]   -- array of { targetSelector, title, description, position }
  - active: boolean           -- whether to show

Outputs:
  - completed: EventEmitter<void>
  - skipped: EventEmitter<void>

Internal signals:
  - currentStepIndex: signal<number>
  - currentRect: signal<DOMRect | null>   -- getBoundingClientRect of target

SpotlightStep interface:
  targetSelector: string      -- CSS selector for target element
  title: string               -- step title
  description: string         -- step description
  position: 'top' | 'bottom' | 'left' | 'right'

Behavior:
  - On init, finds target element via querySelector(steps[0].targetSelector)
  - Renders full-screen overlay with SVG mask (rect with cutout around target)
  - Tooltip card positioned adjacent to spotlight cutout
  - "Next" / "Back" / "Skip tour" buttons
  - Step indicator dots (1/3, 2/3, 3/3)
  - Esc key skips tour
  - On complete/skip, calls FeatureHintsService.completeSpotlight()
  - ResizeObserver tracks target element position changes
```

Template sketch:
```html
@if (active && currentRect()) {
  <div class="fixed inset-0 z-[60]" role="dialog" aria-modal="true"
       (keydown.escape)="skip()">
    <!-- SVG overlay with spotlight cutout -->
    <svg class="absolute inset-0 w-full h-full">
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white"/>
          <rect [attr.x]="spotX()" [attr.y]="spotY()"
                [attr.width]="spotW()" [attr.height]="spotH()"
                rx="8" fill="black"/>
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)"
            mask="url(#spotlight-mask)"/>
    </svg>

    <!-- Tooltip card -->
    <div class="absolute z-[61] max-w-sm p-5 rounded-xl bg-[var(--card)]
                shadow-2xl border border-[var(--border)]"
         [style.top.px]="tooltipTop()" [style.left.px]="tooltipLeft()">
      <h3 class="text-base font-semibold text-[var(--foreground)]">
        {{ currentStep().title }}
      </h3>
      <p class="text-sm text-[var(--muted-foreground)] mt-2">
        {{ currentStep().description }}
      </p>
      <div class="flex items-center justify-between mt-4">
        <!-- Step dots -->
        <div class="flex gap-1.5">
          @for (step of steps; track $index) {
            <div class="w-2 h-2 rounded-full transition-colors"
                 [class]="$index === currentStepIndex()
                   ? 'bg-[var(--primary)]'
                   : 'bg-[var(--muted)]'">
            </div>
          }
        </div>
        <div class="flex gap-2">
          <button class="text-sm text-[var(--muted-foreground)]
                         hover:text-[var(--foreground)]"
                  (click)="skip()">
            Skip
          </button>
          @if (currentStepIndex() > 0) {
            <button class="text-sm text-[var(--primary)]"
                    (click)="prev()">Back</button>
          }
          <button class="px-3 py-1.5 text-sm font-medium rounded-lg
                         bg-[var(--primary)] text-[var(--primary-foreground)]"
                  (click)="next()">
            {{ isLastStep() ? 'Done' : 'Next' }}
          </button>
        </div>
      </div>
    </div>
  </div>
}
```

#### 4. `FeatureHelpIconComponent` (CREATE)
**Path:** `frontend/src/app/shared/components/feature-help-icon/feature-help-icon.component.ts`
**Selector:** `<app-feature-help-icon>`

Small `?` circle icon button that opens a brief contextual explanation popover on click.

```
Inputs:
  - title: string          -- feature name
  - description: string    -- 1-2 sentence explanation
  - shortcutKey: string    -- optional keyboard shortcut to mention

Behavior:
  - Renders as a small 16x16 circle with ? character
  - Click opens a CDK connected overlay with the explanation
  - Click outside or Esc closes
  - Uses OverlayModule with FlexibleConnectedPositionStrategy
```

### Modified Components

#### 5. `EmptyStateComponent` (MODIFY)
**Path:** `frontend/src/app/shared/components/empty-state/empty-state.component.ts`

Add new variants with richer, action-oriented micro-copy:
- Add `'column-empty'` variant with drag hint: "No tasks yet. Drag a card here or press N to create one."
- Add `'filters-empty'` variant: "No tasks match your filters. Try adjusting or clearing them."
- Add `'first-board'` variant: "Your first board is ready! Add columns to organize your workflow."
- Add optional `hint` input for inline shortcut hint text

#### 6. `BoardViewComponent` (MODIFY)
**Path:** `frontend/src/app/features/board/board-view/board-view.component.ts`

- Import and render `SpotlightOverlayComponent`
- On first visit (checked via `FeatureHintsService.hasSeenSpotlight()`), activate spotlight with 3 steps
- Define spotlight steps targeting: (1) `.kanban-column:first-child` -- "Your tasks live in columns", (2) `.toolbar-wrapper` -- "Use filters to find tasks fast", (3) implicit -- "Press ? for keyboard shortcuts"

#### 7. `BoardToolbarComponent` (MODIFY)
**Path:** `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts`

- Add `<app-feature-help-icon>` next to "Group By" button
- Add `<app-feature-help-icon>` next to density toggle
- Add `<app-feature-help-icon>` next to filter presets section

#### 8. `KanbanColumnComponent` (MODIFY)
**Path:** `frontend/src/app/features/board/kanban-column/kanban-column.component.ts`

- Enhance empty column state to use new `'column-empty'` variant of `EmptyStateComponent` with drag/shortcut hint

#### 9. `HelpComponent` (MODIFY)
**Path:** `frontend/src/app/features/help/help.component.ts`

- Add "Restart Feature Tour" button that calls `FeatureHintsService.resetAll()` and navigates to a board
- Add contextual hints section explaining the hint system

#### 10. `BoardViewComponent` -- Contextual Hints (MODIFY)
**Path:** `frontend/src/app/features/board/board-view/board-view.component.ts`

- Add `<app-contextual-hint>` instances for:
  - Drag-and-drop: hints at reordering (appears after 3rd board visit if user hasn't dragged)
  - Keyboard shortcuts: hints at pressing `?` (appears after 2nd board visit)
  - Filters: hints at using quick filters (appears after 5th board visit with no filter usage)

---

## Phased Implementation

### Phase 1 -- Frontend-Only (No Backend Changes)

| Step | What to Build | Files | Effort |
|------|-------------|-------|--------|
| 1.1 | `FeatureHintsService` -- localStorage-based hint state tracking | `core/services/feature-hints.service.ts` (CREATE) | LOW |
| 1.2 | `SpotlightOverlayComponent` -- first-run spotlight with SVG mask | `shared/components/spotlight-overlay/spotlight-overlay.component.ts` (CREATE) | MEDIUM |
| 1.3 | Wire spotlight into `BoardViewComponent` -- 3-step first-run tour | `features/board/board-view/board-view.component.ts` (MODIFY) | LOW |
| 1.4 | `ContextualHintComponent` -- floating "Did you know?" bubbles | `shared/components/contextual-hint/contextual-hint.component.ts` (CREATE) | MEDIUM |
| 1.5 | Wire contextual hints into board view (drag, shortcuts, filters) | `features/board/board-view/board-view.component.ts` (MODIFY) | LOW |
| 1.6 | `FeatureHelpIconComponent` -- `?` icon with explanation popover | `shared/components/feature-help-icon/feature-help-icon.component.ts` (CREATE) | LOW |
| 1.7 | Add `?` icons to board toolbar (Group By, Density, Presets) | `features/board/board-toolbar/board-toolbar.component.ts` (MODIFY) | LOW |
| 1.8 | Enhance `EmptyStateComponent` with new variants + hint input | `shared/components/empty-state/empty-state.component.ts` (MODIFY) | LOW |
| 1.9 | Enhance kanban column empty state with richer micro-copy | `features/board/kanban-column/kanban-column.component.ts` (MODIFY) | LOW |
| 1.10 | Add "Restart Tour" button to Help page | `features/help/help.component.ts` (MODIFY) | LOW |

### Phase 2 -- Backend Persistence (Trivial)

| Step | What to Build | Files | Effort |
|------|-------------|-------|--------|
| 2.1 | Migration: `dismissed_hints JSONB` column on `user_preferences` | `backend/crates/db/src/migrations/20260303000010_dismissed_hints.sql` (CREATE) | LOW |
| 2.2 | Update `UserPreferences` model to include `dismissed_hints` | `backend/crates/db/src/models/user_preferences.rs` (MODIFY) | LOW |
| 2.3 | Update upsert/get queries for `dismissed_hints` | `backend/crates/db/src/queries/user_preferences.rs` (MODIFY) | LOW |
| 2.4 | Accept `dismissed_hints` in PUT preferences API | `backend/crates/api/src/routes/user_preferences.rs` (MODIFY) | LOW |
| 2.5 | Sync `FeatureHintsService` with backend on login | `core/services/feature-hints.service.ts` (MODIFY) | LOW |

### Phase 3 -- Advanced (Optional, Highest Effort)

| Step | What to Build | Effort |
|------|-------------|--------|
| 3.1 | Micro-video/GIF support behind `?` icons | HIGH |
| 3.2 | Usage analytics tracking (which hints are dismissed vs engaged) | MEDIUM |
| 3.3 | A/B testing framework for hint content | HIGH |

---

## File Change List

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `frontend/src/app/core/services/feature-hints.service.ts` | CREATE | Signal-based service tracking hint dismissals, spotlight completion, session hint limit |
| 2 | `frontend/src/app/shared/components/spotlight-overlay/spotlight-overlay.component.ts` | CREATE | Full-screen SVG-masked spotlight overlay with step navigation for first-run tour |
| 3 | `frontend/src/app/shared/components/contextual-hint/contextual-hint.component.ts` | CREATE | Floating "Did you know?" hint bubble with CDK positioning, dismiss, and delay |
| 4 | `frontend/src/app/shared/components/feature-help-icon/feature-help-icon.component.ts` | CREATE | Small `?` icon button with CDK connected overlay explanation popover |
| 5 | `frontend/src/app/shared/components/empty-state/empty-state.component.ts` | MODIFY | Add `column-empty`, `filters-empty`, `first-board` variants; add optional `hint` input |
| 6 | `frontend/src/app/features/board/board-view/board-view.component.ts` | MODIFY | Import + render SpotlightOverlay on first visit; add ContextualHint instances |
| 7 | `frontend/src/app/features/board/board-toolbar/board-toolbar.component.ts` | MODIFY | Add FeatureHelpIcon next to Group By, Density toggle, and Filter Presets |
| 8 | `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` | MODIFY | Enhance empty column state with richer micro-copy and shortcut hints |
| 9 | `frontend/src/app/features/help/help.component.ts` | MODIFY | Add "Restart Feature Tour" button wired to FeatureHintsService.resetAll() |
| 10 | `backend/crates/db/src/migrations/20260303000010_dismissed_hints.sql` | CREATE (Phase 2) | Add `dismissed_hints JSONB` column to `user_preferences` |
| 11 | `backend/crates/db/src/models/user_preferences.rs` | MODIFY (Phase 2) | Add `dismissed_hints: serde_json::Value` field |
| 12 | `backend/crates/db/src/queries/user_preferences.rs` | MODIFY (Phase 2) | Include `dismissed_hints` in SELECT, INSERT, UPDATE queries |
| 13 | `backend/crates/api/src/routes/user_preferences.rs` | MODIFY (Phase 2) | Accept `dismissed_hints` in UpdatePreferencesRequest |
| 14 | `frontend/src/app/core/services/feature-hints.service.spec.ts` | CREATE | Unit tests for FeatureHintsService |
| 15 | `frontend/src/app/shared/components/spotlight-overlay/spotlight-overlay.component.spec.ts` | CREATE | Unit tests for SpotlightOverlayComponent |
| 16 | `frontend/src/app/shared/components/contextual-hint/contextual-hint.component.spec.ts` | CREATE | Unit tests for ContextualHintComponent |
| 17 | `frontend/src/app/shared/components/feature-help-icon/feature-help-icon.component.spec.ts` | CREATE | Unit tests for FeatureHelpIconComponent |

---

## Signal Architecture

### FeatureHintsService

```typescript
// core/services/feature-hints.service.ts
@Injectable({ providedIn: 'root' })
export class FeatureHintsService {
  private authService = inject(AuthService);

  // State signals
  readonly dismissedHints = signal<Set<string>>(new Set());
  readonly activeHint = signal<string | null>(null);
  readonly hasSeenSpotlight = signal<boolean>(false);
  readonly hintShownThisSession = signal<boolean>(false);

  // Computed
  readonly canShowHint = computed(() =>
    !this.hintShownThisSession() && this.activeHint() === null
  );

  // Board visit counter for progressive hint triggers
  readonly boardVisitCount = signal<number>(0);

  constructor() {
    // Load from localStorage
    effect(() => {
      const userId = this.authService.currentUser()?.id;
      if (!userId) return;
      const stored = localStorage.getItem(`tf_hints_${userId}`);
      if (stored) {
        const data = JSON.parse(stored);
        this.dismissedHints.set(new Set(data.dismissed ?? []));
        this.hasSeenSpotlight.set(data.spotlightCompleted ?? false);
        this.boardVisitCount.set(data.boardVisitCount ?? 0);
      }
    }, { allowSignalWrites: true });

    // Persist to localStorage
    effect(() => {
      const userId = this.authService.currentUser()?.id;
      if (!userId) return;
      const data = {
        dismissed: Array.from(this.dismissedHints()),
        spotlightCompleted: this.hasSeenSpotlight(),
        boardVisitCount: this.boardVisitCount(),
      };
      localStorage.setItem(`tf_hints_${userId}`, JSON.stringify(data));
    });
  }
}
```

### SpotlightOverlayComponent

```typescript
// Signals for spotlight positioning
readonly currentStepIndex = signal(0);
readonly targetRect = signal<DOMRect | null>(null);

readonly currentStep = computed(() =>
  this.steps[this.currentStepIndex()]
);
readonly isLastStep = computed(() =>
  this.currentStepIndex() === this.steps.length - 1
);

// Spotlight cutout coordinates (with 8px padding)
readonly spotX = computed(() => (this.targetRect()?.x ?? 0) - 8);
readonly spotY = computed(() => (this.targetRect()?.y ?? 0) - 8);
readonly spotW = computed(() => (this.targetRect()?.width ?? 0) + 16);
readonly spotH = computed(() => (this.targetRect()?.height ?? 0) + 16);
```

---

## Contextual Hint Definitions

These are the specific hints to be wired into the board view:

| Hint ID | Target | Message | Shortcut | Trigger Condition |
|---------|--------|---------|----------|-------------------|
| `board-drag` | First task card | "Drag cards between columns to update their status instantly." | -- | boardVisitCount >= 3 AND user hasn't dragged |
| `board-shortcuts` | Shortcuts ? button area | "Press ? to see all keyboard shortcuts. Navigate faster!" | `?` | boardVisitCount >= 2 |
| `board-filters` | Quick filter pills | "Use quick filters to focus on what matters. Try 'My Tasks'." | `F` | boardVisitCount >= 5 AND no filter ever applied |
| `board-cmd-k` | Search input | "Press Ctrl+K to open the command palette for quick actions." | `Ctrl+K` | boardVisitCount >= 4 |

---

## Spotlight Tour Steps

| Step | Target Selector | Title | Description |
|------|----------------|-------|-------------|
| 1 | `.kanban-columns` (board column container) | "Your tasks live in columns" | "Each column represents a status. Drag cards between columns to update progress. You can add, rename, or reorder columns anytime." |
| 2 | `.toolbar-wrapper` (board toolbar) | "Find tasks fast with filters" | "Use the search bar, priority filters, or quick filter pills to narrow down your view. Press F to jump to search." |
| 3 | -- (no specific target, centered) | "You're all set!" | "Press ? anytime to see keyboard shortcuts. Use Ctrl+K for the command palette. We'll show you tips as you explore." |

---

## Success Criteria Checklist

- [ ] **First-run spotlight tour**: Opening a board for the first time triggers a 3-step spotlight walkthrough
- [ ] **Spotlight is skippable**: "Skip" button dismisses the tour at any step; Esc key also works
- [ ] **Spotlight does not repeat**: After completion or skip, the tour never shows again (unless reset from Help page)
- [ ] **Contextual hints appear**: "Did you know?" bubbles appear near target features based on visit count thresholds
- [ ] **Max 1 hint per session**: Only one contextual hint shows per browser session
- [ ] **Hints are permanently dismissible**: Clicking "Got it" permanently hides that hint (persisted in localStorage)
- [ ] **? help icons on toolbar**: Group By, Density, and Filter Presets have small ? icons that open explanation popovers
- [ ] **Empty column micro-copy**: Empty kanban columns show action-oriented text with shortcut hints ("press N to create")
- [ ] **Help page has "Restart Tour"**: Button on /help page resets all hint state and navigates to a board
- [ ] **No forced modals**: All hints/overlays are non-blocking except the spotlight (which has skip)
- [ ] **Accessibility**: Spotlight overlay has `role="dialog"` and `aria-modal="true"`; hint bubbles have proper ARIA labels
- [ ] **Matches comp.md winner pattern**: Non-blocking contextual teaching over linear modal tours
- [ ] **cargo check + tsc + build pass**: All backend and frontend checks pass
- [ ] **No orphaned code**: All new components are imported and used in at least one parent
- [ ] **Files < 800 lines**: All new and modified files stay under 800 lines

---

## Key Patterns

### SVG Spotlight Mask (CSS-only alternative to canvas)
```html
<svg class="fixed inset-0 w-full h-full pointer-events-none">
  <defs>
    <mask id="spotlight-mask">
      <rect width="100%" height="100%" fill="white"/>
      <rect x="..." y="..." width="..." height="..." rx="8" fill="black"/>
    </mask>
  </defs>
  <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)"
        mask="url(#spotlight-mask)" pointer-events="all"/>
</svg>
```

### CDK Connected Overlay for Hint Positioning
```typescript
import { Overlay, OverlayRef, FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

// Position hint below target with fallback to above
const positionStrategy = this.overlay.position()
  .flexibleConnectedTo(targetElement)
  .withPositions([
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
  ]);
```

### Progressive Hint Triggers
```typescript
// In BoardViewComponent.ngOnInit()
const hintsService = inject(FeatureHintsService);
hintsService.incrementBoardVisit();

effect(() => {
  const visits = hintsService.boardVisitCount();
  if (visits >= 3 && hintsService.canShowHint()) {
    hintsService.showHint('board-drag');
  }
});
```

---

## Dependencies

No new npm packages required. Uses only:
- `@angular/cdk` (existing) -- Overlay, Portal, A11y
- `primeng` (existing) -- Tooltip (already used)
- Tailwind CSS 4 (existing) -- all styling

---

*Plan created: 2026-03-02 | Target: Phase 1 frontend-only, Phase 2 backend persistence*
