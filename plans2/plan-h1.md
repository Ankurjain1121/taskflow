# Plan H1: Empty State Design

> Feature: Onboarding & Feature Discovery > H1: Empty State Design
> Status: Planning
> Stack: Angular 19, TypeScript 5.7, Tailwind CSS 4, PrimeNG 19
> Backend changes: None required

---

## Requirements

### What H1 Means

Transform every blank/empty view in TaskBolt from a dead-end into a teaching moment. Empty states should (1) explain why the screen is blank, (2) guide the user to the single most useful next action, and (3) optionally teach a shortcut or feature they may not know about.

**Winner pattern (from comp.md):** Notion's double-duty empty state that doubles as a demo checklist (educational + functional), combined with Airtable's philosophy of eliminating blank states entirely via pre-populated content. Both approaches cut time-to-value by 40%+.

### Sub-Features IN SCOPE

1. **Enhanced EmptyStateComponent** -- data-driven variant system with ~18 variants covering every empty view in the app
2. **Contextual micro-copy** -- action-oriented copy that teaches ("Drag tasks here or press N to create") instead of stating the obvious ("No tasks")
3. **Keyboard shortcut hints** -- optional shortcut badge on relevant empty states (e.g., "Press N" on empty column)
4. **Secondary actions** -- support for a second action link below the primary CTA
5. **Compact mode** -- smaller inline variant for constrained spaces (column empty state, notification dropdown, sidebar sections)
6. **Consistent visual language** -- SVG illustrations with semantic color backgrounds matching the variant's domain
7. **Replace all ad-hoc empty states** -- swap ~15 scattered inline empty-state HTML blocks with the shared component

### Sub-Features OUT OF SCOPE (with reason)

- **H2 Sample Data on Signup** -- separate feature, requires backend changes to onboarding flow
- **H3 Onboarding Checklist** -- separate feature, requires new UI framework (side-panel checklist, progress tracking)
- **H4 Product Tours / Contextual Tooltips** -- separate feature, requires tour framework + tooltip tracking
- **H5 Keyboard Shortcut Discovery Modal** -- already implemented in B7 (shortcut help modal)

---

## Competitor Benchmark

### Winner Pattern (from comp.md)

> Notion's double-duty: empty state is a demo checklist users interact with to learn.
> OR Airtable's: never show blank -- auto-populate with sample data.
> Both cut time-to-value by 40%+.

| Product | Approach | Key Takeaway |
|---------|----------|-------------|
| Notion | Empty state = educational checklist | Removes blank-page anxiety |
| Airtable | Pre-populated templates, zero blank states | Zero-friction start |
| Asana | Personality copy + "Start building in 2 minutes" | Action-framed, warm |
| Linear | Monochrome illustration + focused CTA | Minimal, brand-aligned |
| Monday.com | Template suggestions on empty workspace | Prevents blank canvas |

### Most Important Gap

TaskBolt has ~15 empty states scattered across the app using inconsistent ad-hoc inline HTML. The existing `EmptyStateComponent` (7 variants) is defined in `shared/components/empty-state/` but is **not used anywhere in production code** -- only referenced in its own spec file. Every real empty state is hand-written inline markup with inconsistent styling, copy, and behavior.

---

## What Already Exists

### EmptyStateComponent (unused in production)

**File:** `frontend/src/app/shared/components/empty-state/empty-state.component.ts`

- 7 variants: `board`, `column`, `search`, `tasks`, `workspace`, `my-tasks-done`, `generic`
- Inputs: `variant`, `title` (required), `description`, `subtitle`, `ctaLabel`
- Output: `ctaClicked`
- SVG illustration per variant via `@switch` block
- **Problem:** Not imported/used in any production component

### Ad-Hoc Inline Empty States (to be replaced)

| Location | Current Copy | File |
|----------|-------------|------|
| Kanban column | "No tasks" + `pi-inbox` icon | `kanban-column.component.ts:247-254` |
| Dashboard (no workspace) | "Your workspace awaits" + Create Workspace CTA | `dashboard.component.ts:382-415` |
| Workspace (no boards) | "Create your first board" + Create Board CTA | `workspace.component.ts:140-169` |
| Favorites | "No favorites yet" + star SVG | `favorites.component.ts:70-90` |
| Notification bell | "No notifications yet" (text only) | `notification-bell.component.ts:104` |
| Sidebar (no boards) | "No boards" (text only) | `workspace-item.component.ts:169` |
| Sidebar (no workspaces) | "No workspaces yet" (text only) | `sidebar.component.ts:376` |
| Teams list | "No teams yet" | `teams-list.component.ts:108` |
| Labels | "No labels yet. Create your first label above." | `workspace-labels.component.ts:114` |
| Milestones | "No milestones yet. Create one to track project progress." | `milestone-list.component.ts:160` |
| Time Report | "No time tracked yet" | `time-report.component.ts:96` |
| Custom Fields | "No custom fields yet." | `custom-fields-manager.component.ts:166` |
| API Keys | "No API keys yet. Generate one to get started." | `workspace-api-keys-tab.component.ts:174` |
| Comments | "No comments yet. Be the first to comment!" | `comment-list.component.ts:101` |
| Activity | "No activity recorded yet." | `activity-timeline.component.ts:42` |
| List view (filtered) | "No tasks match your filters" | `list-view.component.ts:124` |
| Gantt view | "No tasks with dates to display." | `gantt-view.component.ts:85` |
| Swimlane container | "No tasks to group" | `swimlane-container.component.ts:78` |

---

## Backend Changes

**No backend changes required.** H1 is purely a frontend redesign of empty state presentation. All data sources and APIs already exist.

---

## Frontend Changes

### 1. New File: `empty-state-config.ts` (data-driven variant config)

**Path:** `frontend/src/app/shared/components/empty-state/empty-state-config.ts`

Centralized configuration map for all empty state variants. Each variant defines:
- `icon`: PrimeNG icon class (e.g., `pi pi-inbox`)
- `colorScheme`: semantic color key (`primary`, `success`, `warning`, `muted`)
- `defaultTitle`: fallback title if none provided
- `defaultDescription`: fallback description
- `defaultCtaLabel`: fallback CTA text
- `shortcutHint`: optional keyboard shortcut (e.g., `N` for new task)

```typescript
export type EmptyStateVariant =
  | 'board'
  | 'column'
  | 'column-filtered'
  | 'search'
  | 'tasks'
  | 'workspace'
  | 'my-tasks-done'
  | 'favorites'
  | 'notifications'
  | 'comments'
  | 'activity'
  | 'milestones'
  | 'time-tracking'
  | 'custom-fields'
  | 'api-keys'
  | 'teams'
  | 'labels'
  | 'generic';

export interface EmptyStateConfig {
  icon: string;            // PrimeNG icon class
  colorScheme: 'primary' | 'success' | 'warning' | 'info' | 'muted';
  defaultTitle: string;
  defaultDescription: string;
  defaultCtaLabel: string;
  shortcutHint?: string;   // e.g., 'N' for "Press N to create"
}

export const EMPTY_STATE_CONFIGS: Record<EmptyStateVariant, EmptyStateConfig> = {
  board: {
    icon: 'pi pi-objects-column',
    colorScheme: 'primary',
    defaultTitle: 'Create your first board',
    defaultDescription: 'Boards help you organize tasks into columns and track progress visually.',
    defaultCtaLabel: 'Create Board',
  },
  column: {
    icon: 'pi pi-inbox',
    colorScheme: 'primary',
    defaultTitle: 'No tasks yet',
    defaultDescription: 'Drag tasks here or create a new one to get started.',
    defaultCtaLabel: 'Add Task',
    shortcutHint: 'N',
  },
  'column-filtered': {
    icon: 'pi pi-filter-slash',
    colorScheme: 'muted',
    defaultTitle: 'No matching tasks',
    defaultDescription: 'Try adjusting your filters to see tasks in this column.',
    defaultCtaLabel: 'Clear Filters',
    shortcutHint: 'C',
  },
  search: {
    icon: 'pi pi-search',
    colorScheme: 'muted',
    defaultTitle: 'No results found',
    defaultDescription: 'Try different keywords or check your spelling.',
    defaultCtaLabel: '',
  },
  tasks: {
    icon: 'pi pi-check-circle',
    colorScheme: 'success',
    defaultTitle: 'All caught up',
    defaultDescription: 'No tasks assigned to you right now. Enjoy the calm!',
    defaultCtaLabel: '',
  },
  workspace: {
    icon: 'pi pi-building',
    colorScheme: 'primary',
    defaultTitle: 'Your workspace awaits',
    defaultDescription: 'Create your first workspace and start organizing your projects.',
    defaultCtaLabel: 'Create Workspace',
  },
  'my-tasks-done': {
    icon: 'pi pi-star',
    colorScheme: 'success',
    defaultTitle: 'All done!',
    defaultDescription: 'You have completed all your tasks. Great work!',
    defaultCtaLabel: '',
  },
  favorites: {
    icon: 'pi pi-star',
    colorScheme: 'warning',
    defaultTitle: 'No favorites yet',
    defaultDescription: 'Star tasks and boards to pin them here for quick access.',
    defaultCtaLabel: '',
  },
  notifications: {
    icon: 'pi pi-bell',
    colorScheme: 'muted',
    defaultTitle: 'No notifications',
    defaultDescription: 'You are all caught up! New updates will appear here.',
    defaultCtaLabel: '',
  },
  comments: {
    icon: 'pi pi-comments',
    colorScheme: 'info',
    defaultTitle: 'No comments yet',
    defaultDescription: 'Start the conversation -- share an update or ask a question.',
    defaultCtaLabel: '',
  },
  activity: {
    icon: 'pi pi-history',
    colorScheme: 'muted',
    defaultTitle: 'No activity yet',
    defaultDescription: 'Changes to this item will appear here as they happen.',
    defaultCtaLabel: '',
  },
  milestones: {
    icon: 'pi pi-flag',
    colorScheme: 'primary',
    defaultTitle: 'No milestones yet',
    defaultDescription: 'Create milestones to track major project checkpoints and deadlines.',
    defaultCtaLabel: 'Create Milestone',
  },
  'time-tracking': {
    icon: 'pi pi-clock',
    colorScheme: 'info',
    defaultTitle: 'No time tracked',
    defaultDescription: 'Start a timer on any task to track how long work takes.',
    defaultCtaLabel: '',
  },
  'custom-fields': {
    icon: 'pi pi-sliders-h',
    colorScheme: 'primary',
    defaultTitle: 'No custom fields yet',
    defaultDescription: 'Add extra data to your tasks -- effort estimates, URLs, dropdowns, and more.',
    defaultCtaLabel: 'Create Field',
  },
  'api-keys': {
    icon: 'pi pi-key',
    colorScheme: 'warning',
    defaultTitle: 'No API keys yet',
    defaultDescription: 'Generate an API key to integrate TaskBolt with other tools.',
    defaultCtaLabel: 'Generate Key',
  },
  teams: {
    icon: 'pi pi-users',
    colorScheme: 'primary',
    defaultTitle: 'No teams yet',
    defaultDescription: 'Organize workspace members into teams for better collaboration.',
    defaultCtaLabel: 'Create Team',
  },
  labels: {
    icon: 'pi pi-tag',
    colorScheme: 'primary',
    defaultTitle: 'No labels yet',
    defaultDescription: 'Create labels to categorize and filter your tasks.',
    defaultCtaLabel: 'Create Label',
  },
  generic: {
    icon: 'pi pi-inbox',
    colorScheme: 'muted',
    defaultTitle: 'Nothing here yet',
    defaultDescription: '',
    defaultCtaLabel: '',
  },
};
```

### 2. Enhanced EmptyStateComponent

**Path:** `frontend/src/app/shared/components/empty-state/empty-state.component.ts` (MODIFY)

Changes:
- Import variant configs from `empty-state-config.ts`
- Replace hardcoded `@switch` SVG block with data-driven PrimeNG icon from config
- Add new inputs:
  - `size: 'compact' | 'default'` -- compact for inline contexts (column, dropdown)
  - `shortcutHint: string` -- keyboard shortcut badge (e.g., "N")
  - `secondaryCtaLabel: string` -- secondary link text
- Add new output:
  - `secondaryCtaClicked: EventEmitter<void>`
- Use config defaults as fallbacks when title/description/ctaLabel not provided
- Compact mode: smaller icon (w-12 h-12), reduced padding (py-6), smaller text

**Template sketch (pseudo-HTML):**
```html
<div class="flex flex-col items-center justify-center text-center"
     [class]="size() === 'compact' ? 'py-6 px-4' : 'py-12 px-8'">

  <!-- Icon Circle -->
  <div class="rounded-full flex items-center justify-center"
       [class]="size() === 'compact' ? 'w-12 h-12 mb-3' : 'w-20 h-20 mb-5'"
       [style.background]="getIconBg()">
    <i [class]="getIconClass()"
       [class]="size() === 'compact' ? 'text-lg' : 'text-3xl'"
       [style.color]="getIconColor()"></i>
  </div>

  <!-- Title -->
  <h3 [class]="size() === 'compact' ? 'text-sm font-medium' : 'text-lg font-semibold'">
    {{ resolvedTitle() }}
  </h3>

  <!-- Description -->
  @if (resolvedDescription()) {
    <p class="text-sm mt-1.5 max-w-sm" style="color: var(--muted-foreground)">
      {{ resolvedDescription() }}
    </p>
  }

  <!-- Shortcut Hint -->
  @if (resolvedShortcutHint() && size() !== 'compact') {
    <div class="mt-2 flex items-center gap-1.5 text-xs" style="color: var(--muted-foreground)">
      <kbd class="px-1.5 py-0.5 rounded border text-[10px] font-mono"
           style="border-color: var(--border); background: var(--muted)">
        {{ resolvedShortcutHint() }}
      </kbd>
      <span>to create</span>
    </div>
  }

  <!-- Primary CTA -->
  @if (resolvedCtaLabel()) {
    <button class="mt-5 px-5 py-2.5 rounded-lg font-medium text-sm"
            style="background: var(--primary); color: var(--primary-foreground)"
            (click)="ctaClicked.emit()">
      {{ resolvedCtaLabel() }}
    </button>
  }

  <!-- Secondary CTA -->
  @if (secondaryCtaLabel()) {
    <button class="mt-2 text-sm underline"
            style="color: var(--muted-foreground)"
            (click)="secondaryCtaClicked.emit()">
      {{ secondaryCtaLabel() }}
    </button>
  }
</div>
```

**Signal architecture:**
```typescript
// Computed signals that resolve config defaults vs explicit inputs
readonly resolvedTitle = computed(() =>
  this.title() || this.config()?.defaultTitle || ''
);
readonly resolvedDescription = computed(() =>
  this.description() || this.config()?.defaultDescription || ''
);
readonly resolvedCtaLabel = computed(() =>
  this.ctaLabel() || this.config()?.defaultCtaLabel || ''
);
readonly resolvedShortcutHint = computed(() =>
  this.shortcutHint() || this.config()?.shortcutHint || ''
);

private readonly config = computed(() =>
  EMPTY_STATE_CONFIGS[this.variant()]
);
```

### 3. Consumer Component Changes (15 files)

Each file below replaces inline ad-hoc empty state HTML with `<app-empty-state>`.

**Priority order** (highest-impact first):

#### 3a. Kanban Column (most visible empty state)
**File:** `frontend/src/app/features/board/kanban-column/kanban-column.component.ts`
- Import `EmptyStateComponent`
- Replace lines 247-254 (bare "No tasks" block) with:
```html
<app-empty-state
  [variant]="hasActiveFilters() ? 'column-filtered' : 'column'"
  size="compact"
  (ctaClicked)="onAddTask()"
/>
```
- Add `hasActiveFilters` input signal to detect filtered-empty vs truly-empty

#### 3b. Dashboard (no workspaces)
**File:** `frontend/src/app/features/dashboard/dashboard.component.ts`
- Import `EmptyStateComponent`
- Replace lines 382-415 (inline workspace-awaits block) with:
```html
<app-empty-state
  variant="workspace"
  title="Your workspace awaits"
  description="Create your first workspace and start organizing your projects. It only takes a few seconds."
  ctaLabel="Create Workspace"
  (ctaClicked)="navigateToOnboarding()"
/>
```

#### 3c. Workspace (no boards)
**File:** `frontend/src/app/features/workspace/workspace.component.ts`
- Import `EmptyStateComponent`
- Replace lines 140-169 (inline create-board block) with:
```html
<app-empty-state
  variant="board"
  (ctaClicked)="openCreateBoardDialog()"
/>
```

#### 3d. Favorites
**File:** `frontend/src/app/features/favorites/favorites.component.ts`
- Import `EmptyStateComponent`
- Replace lines 60-90 (inline star SVG block) with:
```html
<app-empty-state variant="favorites" />
```

#### 3e. Notification Bell
**File:** `frontend/src/app/shared/components/notification-bell/notification-bell.component.ts`
- Import `EmptyStateComponent`
- Replace line 104 (bare text) with:
```html
<app-empty-state variant="notifications" size="compact" />
```

#### 3f. List View (filtered empty)
**File:** `frontend/src/app/features/board/list-view/list-view.component.ts`
- Import `EmptyStateComponent`
- Replace line 124 with:
```html
<app-empty-state
  variant="column-filtered"
  title="No tasks match your filters"
  description="Try adjusting your filters or clear them to see all tasks."
  ctaLabel="Clear Filters"
  (ctaClicked)="clearFilters()"
/>
```

#### 3g. Gantt View (no dated tasks)
**File:** `frontend/src/app/features/board/gantt-view/gantt-view.component.ts`
- Import `EmptyStateComponent`
- Replace line 85 area with:
```html
<app-empty-state
  variant="generic"
  title="No tasks with dates"
  description="Set start or due dates on tasks to see them on the timeline."
/>
```

#### 3h. Swimlane Container
**File:** `frontend/src/app/features/board/swimlane-container/swimlane-container.component.ts`
- Import `EmptyStateComponent`
- Replace line 78 with:
```html
<app-empty-state
  variant="column"
  size="compact"
  title="No tasks to group"
  description="Create tasks or adjust your group-by setting."
/>
```

#### 3i. Milestone List
**File:** `frontend/src/app/features/board/milestone-list/milestone-list.component.ts`
- Import `EmptyStateComponent`
- Replace line 160 area with:
```html
<app-empty-state variant="milestones" (ctaClicked)="openCreateDialog()" />
```

#### 3j. Time Report
**File:** `frontend/src/app/features/board/time-report/time-report.component.ts`
- Import `EmptyStateComponent`
- Replace line 96 area with:
```html
<app-empty-state variant="time-tracking" />
```

#### 3k. Custom Fields Manager
**File:** `frontend/src/app/features/board/custom-fields/custom-fields-manager.component.ts`
- Import `EmptyStateComponent`
- Replace line 166 area with:
```html
<app-empty-state variant="custom-fields" (ctaClicked)="addField()" />
```

#### 3l. Workspace Labels
**File:** `frontend/src/app/features/workspace/labels/workspace-labels.component.ts`
- Import `EmptyStateComponent`
- Replace line 114 with:
```html
<app-empty-state variant="labels" size="compact" (ctaClicked)="focusNewLabelInput()" />
```

#### 3m. Teams List
**File:** `frontend/src/app/features/workspace/teams/teams-list.component.ts`
- Import `EmptyStateComponent`
- Replace line 108 area with:
```html
<app-empty-state variant="teams" (ctaClicked)="openCreateTeamDialog()" />
```

#### 3n. API Keys Tab
**File:** `frontend/src/app/features/workspace/workspace-settings/workspace-api-keys-tab.component.ts`
- Import `EmptyStateComponent`
- Replace line 174 area with:
```html
<app-empty-state variant="api-keys" (ctaClicked)="generateKey()" />
```

#### 3o. Comment List
**File:** `frontend/src/app/features/tasks/components/comment-list/comment-list.component.ts`
- Import `EmptyStateComponent`
- Replace line 101 with:
```html
<app-empty-state variant="comments" size="compact" />
```

#### 3p. Activity Timeline
**File:** `frontend/src/app/features/tasks/components/activity-timeline/activity-timeline.component.ts`
- Import `EmptyStateComponent`
- Replace line 42 with:
```html
<app-empty-state variant="activity" size="compact" />
```

---

## Phased Implementation

### Phase 1 -- Core Component + High-Impact Locations (Frontend only)

**Estimated effort:** 2-3 hours

1. Create `empty-state-config.ts` with all 18 variant configurations
2. Enhance `EmptyStateComponent`: data-driven icons, size input, shortcut hints, secondary CTA, computed signal defaults
3. Update `EmptyStateComponent` spec to cover new inputs/variants
4. Replace empty states in the 5 highest-impact locations:
   - Kanban column (most visible)
   - Dashboard (first thing users see)
   - Workspace page (no boards)
   - Favorites page
   - Notification bell dropdown

### Phase 2 -- Remaining Locations (Frontend only)

**Estimated effort:** 1-2 hours

5. Replace empty states in board sub-views:
   - List view (filtered)
   - Gantt view
   - Swimlane container
   - Milestone list
   - Time report
   - Custom fields manager
6. Replace empty states in workspace settings:
   - Labels
   - Teams
   - API keys
7. Replace empty states in task detail sub-sections:
   - Comment list
   - Activity timeline

### Phase 3 -- Polish & Edge Cases (Frontend only)

**Estimated effort:** 1 hour

8. Add animation: `animate-fade-in-up` on all empty states (already defined in styles.css)
9. Verify compact mode renders correctly in constrained containers (column, dropdown, sidebar)
10. Visual QA: check all 18 variants in both light and dark mode
11. Verify keyboard shortcut hints are accurate (N = new task, C = clear filters)
12. Run `npx tsc --noEmit && npm run build -- --configuration=production` and fix any issues

---

## File Change List

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `frontend/src/app/shared/components/empty-state/empty-state-config.ts` | CREATE | Data-driven variant config map (18 variants with icon, color, defaults, shortcut hints) |
| 2 | `frontend/src/app/shared/components/empty-state/empty-state.component.ts` | MODIFY | Data-driven rendering, size input, shortcut hint, secondary CTA, computed defaults |
| 3 | `frontend/src/app/shared/components/empty-state/empty-state.component.spec.ts` | MODIFY | Add tests for new inputs, compact mode, shortcut hints, secondary CTA |
| 4 | `frontend/src/app/features/board/kanban-column/kanban-column.component.ts` | MODIFY | Replace inline "No tasks" with `<app-empty-state variant="column" size="compact">` |
| 5 | `frontend/src/app/features/dashboard/dashboard.component.ts` | MODIFY | Replace inline "Your workspace awaits" block with `<app-empty-state variant="workspace">` |
| 6 | `frontend/src/app/features/workspace/workspace.component.ts` | MODIFY | Replace inline "Create your first board" block with `<app-empty-state variant="board">` |
| 7 | `frontend/src/app/features/favorites/favorites.component.ts` | MODIFY | Replace inline star+text block with `<app-empty-state variant="favorites">` |
| 8 | `frontend/src/app/shared/components/notification-bell/notification-bell.component.ts` | MODIFY | Replace bare text with `<app-empty-state variant="notifications" size="compact">` |
| 9 | `frontend/src/app/features/board/list-view/list-view.component.ts` | MODIFY | Replace "No tasks match" text with `<app-empty-state variant="column-filtered">` |
| 10 | `frontend/src/app/features/board/gantt-view/gantt-view.component.ts` | MODIFY | Replace inline text with `<app-empty-state>` for no-dated-tasks state |
| 11 | `frontend/src/app/features/board/swimlane-container/swimlane-container.component.ts` | MODIFY | Replace "No tasks to group" with `<app-empty-state variant="column" size="compact">` |
| 12 | `frontend/src/app/features/board/milestone-list/milestone-list.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="milestones">` |
| 13 | `frontend/src/app/features/board/time-report/time-report.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="time-tracking">` |
| 14 | `frontend/src/app/features/board/custom-fields/custom-fields-manager.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="custom-fields">` |
| 15 | `frontend/src/app/features/workspace/labels/workspace-labels.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="labels" size="compact">` |
| 16 | `frontend/src/app/features/workspace/teams/teams-list.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="teams">` |
| 17 | `frontend/src/app/features/workspace/workspace-settings/workspace-api-keys-tab.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="api-keys">` |
| 18 | `frontend/src/app/features/tasks/components/comment-list/comment-list.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="comments" size="compact">` |
| 19 | `frontend/src/app/features/tasks/components/activity-timeline/activity-timeline.component.ts` | MODIFY | Replace inline text with `<app-empty-state variant="activity" size="compact">` |

**Total: 1 new file, 18 modified files**

---

## Success Criteria Checklist

- [ ] `EmptyStateComponent` supports all 18 variants with data-driven config (no hardcoded @switch per variant)
- [ ] Every variant renders an icon circle, title, and description without passing explicit props (defaults from config)
- [ ] `size="compact"` renders a smaller version suitable for columns, dropdowns, and inline contexts
- [ ] Keyboard shortcut hints display on column empty state ("Press N to create") and filtered empty state ("Press C to clear")
- [ ] Secondary CTA link renders below primary button when `secondaryCtaLabel` is provided
- [ ] Kanban column empty state says "No tasks yet -- Drag tasks here or create a new one" with N shortcut badge
- [ ] Kanban column filtered-empty state says "No matching tasks" with "Clear Filters" CTA
- [ ] Dashboard no-workspace empty state matches current design quality with EmptyStateComponent
- [ ] Workspace no-boards empty state uses EmptyStateComponent with "Create Board" CTA
- [ ] Favorites, Notifications, Comments, Activity, Milestones, Time Report, Custom Fields, Labels, Teams, API Keys all use EmptyStateComponent
- [ ] All empty states render correctly in both light mode and dark mode
- [ ] Compact mode empty states fit within kanban column width (272px) without overflow
- [ ] No ad-hoc inline empty state HTML remains in the codebase (all migrated to component)
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build -- --configuration=production` succeeds
- [ ] No orphaned code -- EmptyStateComponent is the single source of truth for all empty views
- [ ] `animate-fade-in-up` animation plays on empty state mount
- [ ] Matches or exceeds the comp.md winner pattern: contextual, educational, action-oriented empty states

---

## Micro-Copy Reference

| Variant | Title | Description | CTA | Shortcut |
|---------|-------|-------------|-----|----------|
| board | Create your first board | Boards help you organize tasks into columns and track progress visually. | Create Board | -- |
| column | No tasks yet | Drag tasks here or create a new one to get started. | Add Task | N |
| column-filtered | No matching tasks | Try adjusting your filters to see tasks in this column. | Clear Filters | C |
| search | No results found | Try different keywords or check your spelling. | -- | -- |
| tasks | All caught up | No tasks assigned to you right now. Enjoy the calm! | -- | -- |
| workspace | Your workspace awaits | Create your first workspace and start organizing your projects. | Create Workspace | -- |
| my-tasks-done | All done! | You have completed all your tasks. Great work! | -- | -- |
| favorites | No favorites yet | Star tasks and boards to pin them here for quick access. | -- | -- |
| notifications | No notifications | You are all caught up! New updates will appear here. | -- | -- |
| comments | No comments yet | Start the conversation -- share an update or ask a question. | -- | -- |
| activity | No activity yet | Changes to this item will appear here as they happen. | -- | -- |
| milestones | No milestones yet | Create milestones to track major project checkpoints and deadlines. | Create Milestone | -- |
| time-tracking | No time tracked | Start a timer on any task to track how long work takes. | -- | -- |
| custom-fields | No custom fields yet | Add extra data to your tasks -- effort estimates, URLs, dropdowns, and more. | Create Field | -- |
| api-keys | No API keys yet | Generate an API key to integrate TaskBolt with other tools. | Generate Key | -- |
| teams | No teams yet | Organize workspace members into teams for better collaboration. | Create Team | -- |
| labels | No labels yet | Create labels to categorize and filter your tasks. | Create Label | -- |
| generic | Nothing here yet | (empty) | -- | -- |

---

*Plan created: 2026-03-02*
