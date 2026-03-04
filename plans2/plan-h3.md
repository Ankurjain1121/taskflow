# Plan: H3 - Onboarding Checklist

> Feature: Sticky side-panel "Getting Started" checklist with 5 steps, progress bar, dismiss + re-open toggle, skip-tutorial option
> Status: PLANNED | Date: 2026-03-02

---

## Requirements

**H3 — Onboarding Checklist** provides a dismissible side-panel checklist that guides new users through 5 high-impact first actions in TaskFlow. It appears automatically for users who have not yet completed key setup tasks, shows a progress bar, and can be dismissed and re-opened at any time.

### Sub-Features IN SCOPE

1. **Checklist Panel** — Floating/docked side-panel on dashboard with 5 action items
2. **Progress Bar** — Visual progress indicator (0/5 to 5/5) with percentage
3. **Action Items** — Each item has: title, description, completion state, CTA button
4. **Auto-Detection** — Some items auto-complete when the user performs the action elsewhere
5. **Manual Completion** — Items that cannot be auto-detected have a "Mark done" button
6. **Dismiss + Re-Open** — Collapse to a small floating button; re-open from button or Help page
7. **Skip Tutorial** — "Skip all" option that marks checklist as permanently dismissed
8. **localStorage Persistence** — Checklist state persists across page reloads (Phase 1)
9. **Backend Persistence** — Checklist state synced to `user_preferences` table (Phase 2)

### Sub-Features OUT OF SCOPE (with reason)

- **Guided product tours (Shepherd.js style)** — That is H4, a separate feature
- **Keyboard shortcut modal** — That is H5, already built as part of B7
- **Empty state illustrations** — That is H1, a separate feature
- **Sample data seeding** — That is H2, already partially exists in onboarding flow
- **Gamification / badges** — Out of scope for MVP; can be added later
- **Email drip sequence** — No email infra for onboarding nurture

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> Monday.com's dismissible side-panel checklist with 4-6 high-impact actions: Create first task -> Invite teammate -> Set a deadline -> Try drag-reorder -> Explore keyboard shortcuts -> Mark a task done. Progress bar. Re-openable after dismiss.

### Key Competitors

| Product | Approach | Key Pattern |
|---------|----------|-------------|
| Monday.com | Dismissible action cards on dashboard; sticky until completed | Sticky until completed, dismissible |
| Notion | Checklist embedded in demo content | Checklist IS the demo |
| Asana | "Complete these 8 tasks" action-driven flow | Action-not-modal |
| Slack | Running checklist in sidebar; progressive setup | Progressive sidebar tips |
| Airtable | Micro-tasks + 14-day followup email sequence | Nurture sequence |

### Most Important Gap

TaskFlow has zero onboarding guidance after the initial signup wizard. New users land on the dashboard with no direction on what to do next. The checklist bridges the gap between "account created" and "productive user."

---

## What Already Exists

| File | What It Does | Relevance to H3 |
|------|-------------|------------------|
| `frontend/src/app/features/onboarding/onboarding.component.ts` | Multi-step signup wizard (workspace, invite, sample board) | Separate flow; H3 is POST-signup guidance |
| `frontend/src/app/core/services/onboarding.service.ts` | API calls for onboarding steps | May add `getChecklistState()`/`saveChecklistState()` methods |
| `frontend/src/app/features/help/help.component.ts` | Static "Getting Started" steps + features list | Will add "Restart Onboarding Checklist" button |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Main landing page after login | Will embed `<app-onboarding-checklist>` here |
| `frontend/src/app/shared/components/sidebar/sidebar.component.ts` | Navigation sidebar with Help link at bottom | No change needed (Help link already exists) |
| `frontend/src/app/core/services/auth.service.ts` | User model with `onboarding_completed` boolean | Used to determine if checklist should show |
| `backend/crates/db/src/models/user_preferences.rs` | User preferences model | Phase 2: add `onboarding_checklist` JSON column |
| `backend/crates/db/src/queries/user_preferences.rs` | User preferences CRUD | Phase 2: add checklist field to upsert |
| `backend/crates/api/src/routes/user_preferences.rs` | User preferences API | Phase 2: add checklist field to request/response |

---

## Backend Changes

### Phase 1: No Backend Changes Required

Phase 1 is entirely frontend-only. Checklist state is stored in `localStorage` keyed by user ID.

### Phase 2: Backend Persistence (optional enhancement)

**Migration:** `YYYYMMDDHHMMSS_add_onboarding_checklist.sql`

```sql
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT NULL;

COMMENT ON COLUMN user_preferences.onboarding_checklist IS
  'JSON object tracking onboarding checklist state: {items: {key: boolean}, dismissed: boolean, skipped: boolean}';
```

**Model change:** `backend/crates/db/src/models/user_preferences.rs`
- Add `pub onboarding_checklist: Option<serde_json::Value>` field

**Query change:** `backend/crates/db/src/queries/user_preferences.rs`
- Add `onboarding_checklist` to SELECT, INSERT, and UPDATE queries
- Add to `upsert()` function parameters

**Route change:** `backend/crates/api/src/routes/user_preferences.rs`
- Add `onboarding_checklist` to request/response DTOs
- Validate JSON structure server-side

---

## Frontend Changes

### New Components

#### 1. `OnboardingChecklistService` (CREATE)

**File:** `frontend/src/app/core/services/onboarding-checklist.service.ts`
**Selector:** N/A (injectable service)

**Signal Architecture:**
```typescript
// Checklist item definition
interface ChecklistItem {
  id: string;           // e.g., 'create_task', 'invite_teammate'
  title: string;        // "Create your first task"
  description: string;  // "Add a task to any board to get started"
  completed: boolean;
  icon: string;         // PrimeNG icon class e.g., 'pi-plus'
  ctaLabel: string;     // "Create Task"
  ctaRoute?: string;    // Router link (optional)
  ctaAction?: string;   // Named action for programmatic handling
}

// State shape stored in localStorage
interface ChecklistState {
  items: Record<string, boolean>;  // { create_task: true, ... }
  dismissed: boolean;
  skipped: boolean;
  lastUpdated: string;             // ISO timestamp
}

// Signals
readonly items = signal<ChecklistItem[]>([...]);
readonly isVisible = signal<boolean>(true);
readonly isDismissed = signal<boolean>(false);
readonly isSkipped = signal<boolean>(false);

// Computed
readonly completedCount = computed(() => this.items().filter(i => i.completed).length);
readonly totalCount = computed(() => this.items().length);
readonly progress = computed(() => Math.round((this.completedCount() / this.totalCount()) * 100));
readonly allComplete = computed(() => this.completedCount() === this.totalCount());
readonly shouldShow = computed(() => !this.isSkipped() && !this.allComplete());
```

**5 Checklist Items:**

| # | ID | Title | Description | CTA | Detection |
|---|-----|-------|-------------|-----|-----------|
| 1 | `create_task` | Create your first task | Add a task to any board to start tracking work | Go to Board | Auto: check if user has created any task (API call on init) |
| 2 | `set_due_date` | Set a due date | Deadlines help keep your team on track | Open a Task | Auto: check if any task has a due_date set |
| 3 | `try_drag_drop` | Drag a task between columns | Move tasks across your board to update status | Go to Board | Manual: flag set when user performs cdkDragDrop on board |
| 4 | `explore_shortcuts` | Try keyboard shortcuts | Press ? on any board to see all shortcuts | View Shortcuts | Manual: flag set when user opens shortcut modal |
| 5 | `invite_teammate` | Invite a teammate | Collaboration makes everything better | Invite Team | Auto: check if workspace has >1 member |

**Key Methods:**
- `initialize(userId: string)` — Load state from localStorage, auto-detect completed items
- `markComplete(itemId: string)` — Mark item as done, persist to localStorage
- `dismiss()` — Set dismissed=true, hide panel
- `reopen()` — Set dismissed=false, show panel
- `skipAll()` — Set skipped=true, permanently hide
- `resetChecklist()` — Reset all items to incomplete (for Help page re-trigger)

**Persistence via effect():**
```typescript
constructor() {
  effect(() => {
    const state: ChecklistState = {
      items: Object.fromEntries(this.items().map(i => [i.id, i.completed])),
      dismissed: this.isDismissed(),
      skipped: this.isSkipped(),
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(`tf_checklist_${this.userId}`, JSON.stringify(state));
  });
}
```

#### 2. `OnboardingChecklistComponent` (CREATE)

**File:** `frontend/src/app/shared/components/onboarding-checklist/onboarding-checklist.component.ts`
**Selector:** `app-onboarding-checklist`

**Template Sketch:**
```
+------------------------------------------+
| Getting Started              [X] Dismiss  |
|                                           |
| [=========------] 3/5 complete (60%)     |
|                                           |
| [v] Create your first task               |
|     Add a task to any board...            |
|                                           |
| [v] Set a due date                       |
|     Deadlines help keep your team...      |
|                                           |
| [v] Drag a task between columns          |
|     Move tasks across your board...       |
|                                           |
| [ ] Try keyboard shortcuts       [Try >] |
|     Press ? on any board to see all...    |
|                                           |
| [ ] Invite a teammate           [Invite] |
|     Collaboration makes everything...     |
|                                           |
| [Skip tutorial]                           |
+------------------------------------------+
```

**Design Details:**
- Fixed-position panel, bottom-right corner of viewport (not inside dashboard scroll)
- Width: 360px on desktop, full-width on mobile
- White card with shadow, rounded corners (matches existing `widget-card` class)
- Progress bar: blue gradient fill, rounded, 6px height
- Completed items: green checkmark icon, muted text with strikethrough
- Incomplete items: empty circle, full text, CTA button on right
- Dismiss (X): collapse to floating "Getting Started" pill button
- Skip tutorial: text link at bottom, triggers confirmation (simple inline "Are you sure? Yes / No")
- Celebration: when all 5 complete, show confetti-like message "You're all set!" with a close button

**Collapsed State (Floating Button):**
```
[Checklist icon] Getting Started (3/5)
```
- Small pill button, bottom-right, same position as collapsed state
- Click to re-expand

**Signals consumed:**
- `checklistService.items()` — render list
- `checklistService.progress()` — progress bar width
- `checklistService.completedCount()` — "N/5 complete"
- `checklistService.isDismissed()` — show panel vs floating button
- `checklistService.shouldShow()` — whether to render at all

**Animations:**
- Panel slide-in from right on first render (Tailwind `animate-slide-in-right` or CSS transition)
- Item completion: brief green flash + check icon animation
- Progress bar: smooth width transition (`transition-all duration-500`)

### Modified Components

#### 3. `DashboardComponent` (MODIFY)

**File:** `frontend/src/app/features/dashboard/dashboard.component.ts`
**Changes:**
- Import `OnboardingChecklistComponent`
- Add `<app-onboarding-checklist />` to template (after main content, fixed position handles itself)
- No signal changes needed in dashboard — checklist is self-contained

#### 4. `HelpComponent` (MODIFY)

**File:** `frontend/src/app/features/help/help.component.ts`
**Changes:**
- Import `OnboardingChecklistService`
- Add "Restart Getting Started Checklist" button in the Getting Started section
- Button calls `checklistService.resetChecklist()` and navigates to dashboard
- Only show button if checklist is completed or skipped

#### 5. Board View Integration — Drag-Drop Detection (MODIFY)

**File:** `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts`
**Changes:**
- Inject `OnboardingChecklistService`
- After a successful drag-drop operation, call `checklistService.markComplete('try_drag_drop')`
- Single line addition inside existing drop handler

#### 6. Keyboard Shortcuts Modal — Detection (MODIFY)

**File:** `frontend/src/app/features/board/board-view/board-shortcuts.service.ts` (or wherever the ? shortcut modal opens)
**Changes:**
- Inject `OnboardingChecklistService`
- When shortcuts modal opens, call `checklistService.markComplete('explore_shortcuts')`
- Single line addition

### New/Modified Services

#### 7. `OnboardingChecklistService` — API Integration (Phase 2)

**File:** `frontend/src/app/core/services/onboarding-checklist.service.ts`
**Phase 2 additions:**
- `loadFromServer()` — GET `/api/user-preferences` and read `onboarding_checklist` field
- `syncToServer()` — PUT `/api/user-preferences` with updated `onboarding_checklist` JSON
- Merge strategy: server state wins on load, then client state wins on changes

---

## Phased Implementation

### Phase 1 — Frontend-Only (No Backend Changes)

**Goal:** Ship the checklist with localStorage persistence. Fastest path to user value.

| Step | What | Files | Effort |
|------|------|-------|--------|
| 1.1 | Create `OnboardingChecklistService` | `core/services/onboarding-checklist.service.ts` (CREATE) | Medium |
| 1.2 | Create `OnboardingChecklistComponent` | `shared/components/onboarding-checklist/onboarding-checklist.component.ts` (CREATE) | Medium |
| 1.3 | Embed in `DashboardComponent` | `features/dashboard/dashboard.component.ts` (MODIFY) | Small |
| 1.4 | Wire drag-drop detection | `features/board/board-view/board-drag-drop.handler.ts` (MODIFY) | Tiny |
| 1.5 | Wire shortcuts detection | `features/board/board-view/board-shortcuts.service.ts` (MODIFY) | Tiny |
| 1.6 | Add "Restart Checklist" to Help page | `features/help/help.component.ts` (MODIFY) | Small |
| 1.7 | Auto-detect completed items on init | Inside `OnboardingChecklistService.initialize()` | Medium |

**Auto-detection logic (Phase 1):**
- `create_task`: Call `/api/tasks?limit=1` or check if dashboard stats `total_tasks > 0`
- `set_due_date`: Check if any task in dashboard has a due date (from My Tasks Today widget data)
- `invite_teammate`: Check workspace member count from `WorkspaceStateService`
- `try_drag_drop`: localStorage flag only
- `explore_shortcuts`: localStorage flag only

### Phase 2 — Backend Persistence (Optional)

**Goal:** Persist checklist state server-side so it survives browser clears and works across devices.

| Step | What | Files | Effort |
|------|------|-------|--------|
| 2.1 | SQL migration | `backend/crates/db/src/migrations/YYYYMMDDHHMMSS_add_onboarding_checklist.sql` (CREATE) | Small |
| 2.2 | Update model | `backend/crates/db/src/models/user_preferences.rs` (MODIFY) | Small |
| 2.3 | Update queries | `backend/crates/db/src/queries/user_preferences.rs` (MODIFY) | Small |
| 2.4 | Update API route | `backend/crates/api/src/routes/user_preferences.rs` (MODIFY) | Small |
| 2.5 | Frontend sync | `core/services/onboarding-checklist.service.ts` (MODIFY) | Medium |

### Phase 3 — Enhancements (Optional, Post-MVP)

| Step | What | Effort |
|------|------|--------|
| 3.1 | Celebration animation when all 5 complete (confetti CSS or Lottie) | Small |
| 3.2 | Show checklist on board view too (not just dashboard) | Small |
| 3.3 | Analytics tracking: which steps users skip, average completion time | Medium |
| 3.4 | A/B test: 5 items vs 3 items checklist | Medium |

---

## File Change List

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 1 | `frontend/src/app/core/services/onboarding-checklist.service.ts` | CREATE | Service managing checklist items, completion state, localStorage persistence, auto-detection |
| 2 | `frontend/src/app/shared/components/onboarding-checklist/onboarding-checklist.component.ts` | CREATE | Floating side-panel UI: progress bar, item list, dismiss/skip controls, collapsed pill button |
| 3 | `frontend/src/app/features/dashboard/dashboard.component.ts` | MODIFY | Import and embed `<app-onboarding-checklist />` in template |
| 4 | `frontend/src/app/features/help/help.component.ts` | MODIFY | Add "Restart Getting Started Checklist" button in Getting Started section |
| 5 | `frontend/src/app/features/board/board-view/board-drag-drop.handler.ts` | MODIFY | After successful drop, call `checklistService.markComplete('try_drag_drop')` |
| 6 | `frontend/src/app/features/board/board-view/board-shortcuts.service.ts` | MODIFY | When shortcut modal opens, call `checklistService.markComplete('explore_shortcuts')` |

**Phase 2 additional files (if implemented):**

| # | File Path | Action | Description |
|---|-----------|--------|-------------|
| 7 | `backend/crates/db/src/migrations/YYYYMMDDHHMMSS_add_onboarding_checklist.sql` | CREATE | Add `onboarding_checklist JSONB` column to `user_preferences` |
| 8 | `backend/crates/db/src/models/user_preferences.rs` | MODIFY | Add `onboarding_checklist: Option<serde_json::Value>` field |
| 9 | `backend/crates/db/src/queries/user_preferences.rs` | MODIFY | Add checklist field to all queries and upsert function |
| 10 | `backend/crates/api/src/routes/user_preferences.rs` | MODIFY | Add checklist field to request/response DTOs |

---

## Success Criteria Checklist

### Functional

- [ ] Checklist panel appears on dashboard for users who have not completed all 5 items
- [ ] Progress bar shows correct completion percentage (0%, 20%, 40%, 60%, 80%, 100%)
- [ ] Each completed item shows green checkmark and muted/strikethrough text
- [ ] Each incomplete item shows CTA button that navigates to the relevant feature
- [ ] "Create your first task" auto-detects when user has any tasks
- [ ] "Set a due date" auto-detects when any task has a due date
- [ ] "Invite a teammate" auto-detects when workspace has >1 member
- [ ] "Drag a task between columns" marks complete when user performs drag-drop on board
- [ ] "Try keyboard shortcuts" marks complete when user opens shortcut modal (?)
- [ ] Dismiss button collapses panel to small floating "Getting Started (N/5)" pill
- [ ] Clicking collapsed pill re-opens the full panel
- [ ] "Skip tutorial" permanently hides the checklist
- [ ] Help page shows "Restart Getting Started Checklist" button when checklist is done/skipped
- [ ] Clicking "Restart" resets all items and shows the checklist on dashboard
- [ ] Checklist state persists across page reloads (localStorage)
- [ ] When all 5 items are complete, panel shows "You're all set!" message

### Visual / UX

- [ ] Panel is fixed position, bottom-right, 360px wide on desktop
- [ ] Panel is full-width on mobile (< 640px)
- [ ] Panel has smooth slide-in animation on first render
- [ ] Progress bar has smooth width transition on item completion
- [ ] Design matches existing TaskFlow card style (var(--card), var(--border), etc.)
- [ ] Dark mode works correctly (all colors use CSS variables)
- [ ] Panel does not overlap sidebar or top nav

### Technical

- [ ] All TypeScript compiles: `npx tsc --noEmit` passes
- [ ] Production build succeeds: `npm run build -- --configuration=production`
- [ ] `cargo check --workspace --all-targets` passes (if Phase 2)
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` passes (if Phase 2)
- [ ] No `console.log` statements in production code
- [ ] No hardcoded secrets or credentials
- [ ] All new files < 800 lines
- [ ] Service uses Angular signals (no RxJS Subjects for state)
- [ ] Component uses `ChangeDetectionStrategy.OnPush`
- [ ] Component is standalone (no NgModule)
- [ ] No new npm dependencies required

### Matches or Exceeds Winner Pattern

- [ ] Dismissible panel (Monday.com pattern) -- implemented
- [ ] Progress bar (Monday.com pattern) -- implemented
- [ ] Re-openable after dismiss (Monday.com pattern) -- implemented
- [ ] 5 action items (Monday.com uses 4-6) -- implemented with 5
- [ ] Skip option (Monday.com allows skip) -- implemented
- [ ] Auto-detection of some items (exceeds Monday.com which requires manual) -- implemented for 3/5 items
