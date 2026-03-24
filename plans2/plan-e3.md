# E3: Bundle Size / Load Time — Implementation Plan

## Overview

E3 targets measurable reductions in initial bundle size and time-to-interactive for TaskBolt's Angular 19 frontend. The app already uses route-level lazy loading for every route. The remaining wins are: (1) eliminating eagerly-loaded PrimeNG modules that live in the initial chunk, (2) adding `@defer` blocks for below-fold and tab-switched heavy components in board-view, and (3) correcting the preloading strategy so route prefetch happens intelligently rather than eagerly preloading every lazy chunk.

---

## Requirements

### In Scope

- **PrimeNG tree-shaking audit** — verify every PrimeNG module is imported at component level (not in a shared barrel), identify any modules imported into components that are loaded eagerly (app shell).
- **`@defer` blocks for below-fold and alt-view components** — GanttView, ReportsView, TimeReport, CalendarView, and ListViewComponent inside `board-view.component.ts` (rendered only when the user switches view mode).
- **`@defer` blocks for dashboard widgets** — all chart-heavy dashboard widgets (ChartModule consumers) that are below the fold.
- **Preloading strategy** — switch from `PreloadAllModules` (eager, preloads everything) to `QuicklinkStrategy` or a custom hover-based prefetch, or at minimum to `NoPreloading` with explicit prefetch hints.
- **Bundle budget enforcement** — tighten `angular.json` budgets to reflect the target sizes and catch regressions.
- **Baseline + post measurement** — run `ng build --stats-json` before and after to document improvement.
- **chart.js / PrimeNG ChartModule isolation** — these are the largest third-party chunks; ensure they only load with dashboard analytics widgets, not at app startup.

### Out of Scope

- **Server-Side Rendering (SSR) / Angular Universal** — would require infrastructure changes, separate initiative.
- **Service Worker / PWA caching** — separate initiative, different risk profile.
- **Replacing PrimeNG components with custom ones** — too large a change for a performance sprint.
- **Image optimization / CDN** — infra concern, not bundle concern.
- **New build tools** — esbuild is already the builder (`@angular-devkit/build-angular:application`); no change needed.
- **Webpack Bundle Analyzer** — not installed; `ng build --stats-json` + `source-map-explorer` is the measurement approach.

---

## Competitor Benchmark

| Tool | Strategy |
|------|----------|
| Linear | Route-level code splitting + prefetch on hover (no eager preload) |
| Notion | Chunked bundles, `@defer` for infrequently-accessed panels (settings, export) |
| Jira | Heavy views (Roadmap, Reports) load only when the view tab is clicked |

**Winner pattern:** Lazy routes (already done) + `@defer` for view-switched content + smart prefetch (hover/idle, not preload-all).

**Biggest single win:** `@defer` on the four alternate view components inside `board-view.component.ts`. Right now `GanttViewComponent`, `ReportsViewComponent`, `TimeReportComponent`, and `CalendarViewComponent` are all statically imported and included in the board-view chunk, even though a user who opens kanban view never sees them. Deferring these reduces the board-view chunk significantly.

The second largest win is the dashboard widget `ChartModule` (chart.js). Three widgets — `TasksByStatusComponent`, `TasksByPriorityComponent`, `CompletionTrendComponent` — import `ChartModule` from `primeng/chart`, which bundles chart.js (~200 KB gzipped). These are below the fold on the dashboard. Deferring them means chart.js does not load at all on first paint.

---

## What Already Exists

### Routes — Already Lazy-Loaded

Every route in `app.routes.ts` uses `loadComponent` / `loadChildren`. The `admin` module uses `loadChildren` with a child routes file. All feature routes are lazy.

**Critical gap:** `app.config.ts` uses `withPreloading(PreloadAllModules)`. This means Angular eagerly preloads every lazy chunk as soon as the app boots — effectively negating most of the route-level laziness for users with fast connections. The split still helps with initial parse time but not network transfer.

### `@defer` — Already Used in board-settings.component.ts

`board-settings.component.ts` already uses `@defer` for the Automations, Custom Fields, Milestones, Share Settings, and Webhooks tabs. This is the correct pattern. It is **not yet applied** to:

- `board-view.component.ts` — alternate view components (Gantt, Reports, Time Report, Calendar, List)
- `dashboard.component.ts` — below-fold chart widgets
- `task-detail.component.ts` — secondary tabs (activity, time tracking, recurring)

### PrimeNG Import Audit — Findings

All PrimeNG imports are at **component level** (within each standalone component's `imports: []` array). There are **no global PrimeNG imports** via a shared module or `providers` barrel. This is correct and means esbuild tree-shaking is already working at the component boundary.

**Exception — app.component.ts (initial chunk):** `ToastModule` from `primeng/toast` is imported directly in `AppComponent`. `ToastModule` pulls in the full Toast overlay infrastructure. This is in the initial chunk because `AppComponent` is eagerly loaded.

**Exception — app.config.ts (initial chunk):** `providePrimeNG` + `MessageService` from `primeng/api` are in the app config. These are necessary and small; not a problem.

**Exception — WorkspaceSettingsDialogComponent in app.component.ts:** `WorkspaceSettingsDialogComponent` is imported directly into `AppComponent`'s `imports` array. If that dialog has heavy PrimeNG imports (Tabs, TabList, etc.), they land in the initial chunk.

**Heavy modules by use-site:**

| Module | Where Used | Bundle Risk |
|--------|------------|-------------|
| `ChartModule` (primeng/chart → chart.js) | `TasksByStatusComponent`, `TasksByPriorityComponent`, `CompletionTrendComponent` | HIGH — chart.js ~200 KB gz |
| `TableModule` (primeng/table) | `ListViewComponent`, `OverdueTasksTableComponent`, `notification-preferences` | MEDIUM |
| `MultiSelect` (primeng/multiselect) | `board-toolbar`, `create-task-dialog` | MEDIUM |
| `DatePicker` (primeng/datepicker) | Multiple task detail/form components | LOW-MEDIUM |
| `Tabs` / `TabList` / `TabPanel` (primeng/tabs) | `board-settings`, `task-detail`, `workspace-settings-dialog` | LOW |
| `Accordion` (primeng/accordion) | `webhook-settings.component.ts` | LOW |

### Existing Bundle Budgets (angular.json)

```json
"budgets": [
  { "type": "initial", "maximumWarning": "1MB", "maximumError": "1.50MB" },
  { "type": "anyComponentStyle", "maximumWarning": "6kB", "maximumError": "10kB" }
]
```

These are loose. The `1MB` warning threshold is high enough to allow significant bloat without alerting. Post-optimization the target should be `500kB` warning, `800kB` error for the initial chunk.

### No Bundle Analysis Tool Installed

`webpack-bundle-analyzer` or `source-map-explorer` are not in devDependencies. The plan uses `ng build --stats-json` and `source-map-explorer` (installable as a one-off devDependency) for before/after comparison.

---

## Backend Changes

**No backend changes required.** E3 is a pure frontend bundle optimization.

---

## Frontend Changes

### 1. Preloading Strategy — app.config.ts

**Current:** `withPreloading(PreloadAllModules)` — eagerly preloads every lazy chunk after app boot.

**Target:** Switch to `NoPreloading` (simplest safe change) or implement a custom `QuicklinkPreloadingStrategy` that only prefetches routes visible in the viewport (links in the sidebar). The simplest approach that's safe without adding a new library is `NoPreloading`. Angular will still load each chunk on demand — users pay the chunk download cost at first navigation to that route, which is acceptable because all routes are already split.

**Alternative (preferred if sidebar links are in viewport on boot):** Install `ngx-quicklink` or implement a lightweight custom preloading strategy that triggers prefetch on `mouseenter` of sidebar `<a>` elements. This mirrors Linear's behavior.

**File:** `frontend/src/app/app.config.ts`
- Remove `withPreloading(PreloadAllModules)`
- Add `withPreloading(NoPreloading)` from `@angular/router` OR implement custom hover-prefetch strategy

### 2. `@defer` Blocks in board-view.component.ts

`board-view.component.ts` statically imports and renders `GanttViewComponent`, `ReportsViewComponent`, `TimeReportComponent`, and `CalendarViewComponent`. These are only shown when the user switches the view mode from kanban. They should use `@defer (on interaction)` or `@defer (when viewMode() === 'gantt')`.

**Pattern to apply:**

```html
<!-- BEFORE -->
} @else if (viewMode() === 'gantt') {
  <div class="flex-1 overflow-hidden">
    <app-gantt-view [tasks]="..." ...></app-gantt-view>
  </div>
}

<!-- AFTER -->
} @else if (viewMode() === 'gantt') {
  <div class="flex-1 overflow-hidden">
    @defer (when viewMode() === 'gantt') {
      <app-gantt-view [tasks]="..." ...></app-gantt-view>
    } @placeholder {
      <div class="flex items-center justify-center flex-1 py-12">
        <svg class="animate-spin h-6 w-6 text-primary" ...></svg>
      </div>
    }
  </div>
}
```

Apply the same pattern for: `list`, `calendar`, `reports`, `time-report` view modes.

**File:** `frontend/src/app/features/board/board-view/board-view.component.ts`
- Wrap each `@else if (viewMode() === '...')` branch's heavy component in a `@defer (when ...)` block.
- Remove the static imports for those components from the `imports: []` array (Angular will handle the dynamic import automatically when using `@defer` with standalone components).

> **Note on `@defer` with inputs:** The `when` trigger evaluates a signal expression. Inputs to the deferred component still work normally once loaded. There is no issue passing `[boardId]`, `[tasks]` etc. through `@defer`.

### 3. `@defer` Blocks in dashboard.component.ts

The dashboard loads all 7 widget components statically. The analytics section (charts) is below the fold on most screens. Apply `@defer (on viewport)` to the analytics grid and below-fold widgets.

**File:** `frontend/src/app/features/dashboard/dashboard.component.ts`

Wrap the "Analytics Section" `<div>` (currently around line 333 in the template) in a `@defer (on viewport)` block:

```html
<!-- Analytics Section -->
<div class="animate-fade-in-up stagger-6 mb-6">
  @defer (on viewport) {
    <div class="mb-4">
      <h2 class="widget-title text-sm">Analytics & Insights</h2>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <app-completion-trend .../>
      <app-tasks-by-status .../>
      <app-tasks-by-priority .../>
      <app-upcoming-deadlines .../>
      <app-team-workload .../>
      <app-overdue-tasks-table .../>
    </div>
  } @placeholder {
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      @for (i of [1,2,3,4]; track i) {
        <div class="widget-card p-5 min-h-[360px]">
          <div class="skeleton skeleton-text w-32 mb-4"></div>
          <div class="skeleton w-full h-64 rounded-lg"></div>
        </div>
      }
    </div>
  }
</div>
```

This ensures `ChartModule` (chart.js) only loads when the user scrolls down to the analytics section.

### 4. `@defer` Blocks in task-detail.component.ts (board feature)

`task-detail.component.ts` imports `TaskTimeTrackingSectionComponent`, `TaskRecurringSectionComponent`, `TaskDependenciesSectionComponent`, `TaskCustomFieldsSectionComponent` — all secondary/advanced tabs. These load `DatePicker`, `Select`, `InputTextModule`, etc.

These tab panels should use `@defer (when activeTab === N)` similar to the pattern already in `board-settings.component.ts`.

**File:** `frontend/src/app/features/board/task-detail/task-detail.component.ts`

### 5. `@defer` for WorkspaceSettingsDialogComponent in app.component.ts

`WorkspaceSettingsDialogComponent` is imported directly into `AppComponent`. This dialog uses `Tabs`, `TabList`, `TabPanel` from primeng/tabs and loads workspace-specific content. Since it only opens on demand (user clicks workspace settings), it can be deferred.

**Option A (preferred):** Convert to a dynamic dialog that loads via a service rather than being statically in the app shell template.

**Option B (simpler):** Wrap the `<app-workspace-settings-dialog>` in the app template with `@defer (when settingsOpen())` where `settingsOpen` is a signal that becomes true when the user clicks the gear icon.

**File:** `frontend/src/app/app.component.ts` and `app.component.html`

### 6. Replace ToastModule in app.component.ts

`app.component.ts` imports `ToastModule` from `primeng/toast`. The app actually uses a custom `ToastContainerComponent` for its own toast display. Check whether the PrimeNG `ToastModule` (the `<p-toast />` element in the app template) is still needed or if it can be replaced by the custom `ToastContainerComponent` already present.

If the `<p-toast />` tag can be removed from `app.component.html` and all toast notifications go through the custom service, remove `ToastModule` from `app.component.ts` imports entirely.

**File:** `frontend/src/app/app.component.ts`

### 7. Bundle Budgets — angular.json

After implementing the above, tighten budgets:

```json
"budgets": [
  { "type": "initial", "maximumWarning": "500kB", "maximumError": "800kB" },
  { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
]
```

**File:** `frontend/angular.json`

### 8. Measurement Setup

Add `source-map-explorer` as a devDependency and a measurement script:

```json
// package.json devDependencies
"source-map-explorer": "^2.5.3"

// package.json scripts
"analyze": "ng build --source-map && npx source-map-explorer 'dist/frontend/browser/*.js' --html dist/report.html"
```

**File:** `frontend/package.json`

---

## Phased Implementation

### Phase 1 — Quick Wins (2–3 hours, no behaviour change)

**Goal:** Reduce board-view chunk and eliminate chart.js from initial/dashboard-initial loads.

1. **Measure baseline** — run `ng build --stats-json`, record chunk sizes. Note the size of: `main.js`, `chunk-board-view.js`, `chunk-dashboard.js`.

2. **`@defer` in board-view.component.ts** — wrap Gantt, Reports, TimeReport, Calendar, and List view branches. This is the single largest win. Remove those 5 components from `imports: []` in BoardViewComponent (they will be resolved dynamically by the `@defer` block).

3. **`@defer` for dashboard analytics** — wrap the full analytics grid section in `dashboard.component.ts` with `@defer (on viewport)`. This pulls chart.js out of the dashboard initial load.

4. **Re-measure** — run `ng build --stats-json` again, compare chunk sizes. Confirm board-view chunk shrank and chart.js no longer appears in main/dashboard chunks.

5. **Build verification** — `ng build --configuration=production` must pass with zero budget errors.

**Expected outcome:** Board-view chunk reduced by ~30–40% (Gantt + Reports + TimeReport + Calendar are no longer statically compiled into it). Dashboard avoids loading chart.js (~200 KB gzipped) until scroll.

---

### Phase 2 — Preloading Strategy + App Shell Cleanup (1–2 hours)

**Goal:** Stop eagerly preloading all lazy chunks; clean app shell's initial chunk.

1. **Switch preloading strategy** — in `app.config.ts`, replace `withPreloading(PreloadAllModules)` with `withPreloading(NoPreloading)`. Verify that navigation still works (it will — chunks load on demand).

2. **WorkspaceSettingsDialog deferral** — wrap `<app-workspace-settings-dialog>` in app component template with `@defer (when workspaceSettingsOpen())`.

3. **ToastModule audit** — check if `<p-toast />` in `app.component.html` is actually rendered and whether it duplicates the custom `ToastContainerComponent`. If redundant, remove `ToastModule` import and the `<p-toast />` tag from `AppComponent`.

4. **`@defer` for task-detail secondary tabs** — in `task-detail.component.ts`, defer `TaskTimeTrackingSectionComponent`, `TaskRecurringSectionComponent`, `TaskDependenciesSectionComponent`, `TaskCustomFieldsSectionComponent` using `when activeTab === N` pattern (same as board-settings).

5. **Run full build + verify** — `ng build --configuration=production`, check budgets pass.

**Expected outcome:** Initial JS chunk smaller (workspace settings dialog and PrimeNG Tabs no longer in it). 15+ lazy chunks no longer preloaded eagerly after boot.

---

### Phase 3 — Hover Prefetch + Budget Tightening (1 hour)

**Goal:** Implement Linear-style hover prefetch; tighten budgets to lock in gains.

1. **Custom preloading strategy** — implement `HoverPreloadStrategy` service that listens for `mouseenter` on `routerLink` elements and calls Angular's preloading infrastructure for that route. Alternatively, use the `ngx-quicklink` package.

   ```typescript
   // hover-preload.strategy.ts (new file)
   @Injectable({ providedIn: 'root' })
   export class HoverPreloadStrategy implements PreloadingStrategy {
     preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
       // Only preload routes that have data.preload === true
       // or that the user hovered over (tracked via a service)
       return route.data?.['preload'] ? load() : EMPTY;
     }
   }
   ```

   For full hover-on-link behavior, a dedicated `RouterLinkPreloadDirective` is needed, or use `ngx-quicklink`.

2. **Tighten angular.json budgets** — set `maximumWarning: "500kB"`, `maximumError: "800kB"` for initial chunk. Fix any warnings that appear.

3. **Add `source-map-explorer` script** to `package.json` for ongoing analysis.

4. **Final measurement** — run analyze script, document final bundle sizes in TASK.md progress log.

---

## File Change List

| File | Change |
|------|--------|
| `frontend/src/app/app.config.ts` | Replace `withPreloading(PreloadAllModules)` with `NoPreloading` or custom strategy |
| `frontend/src/app/app.component.ts` | Remove `ToastModule` if redundant; wrap `WorkspaceSettingsDialogComponent` with defer |
| `frontend/src/app/app.component.html` | Remove `<p-toast />` if redundant; add `@defer` wrapper for workspace settings dialog |
| `frontend/src/app/features/board/board-view/board-view.component.ts` | Add `@defer` blocks for Gantt/Reports/TimeReport/Calendar/List views; remove those 5 from `imports: []` |
| `frontend/src/app/features/dashboard/dashboard.component.ts` | Add `@defer (on viewport)` around analytics widgets section |
| `frontend/src/app/features/board/task-detail/task-detail.component.ts` | Add `@defer` for secondary tab components (time-tracking, recurring, dependencies, custom-fields) |
| `frontend/angular.json` | Tighten bundle budgets (500kB warning, 800kB error for initial) |
| `frontend/package.json` | Add `source-map-explorer` devDependency + `analyze` script |
| `frontend/src/app/core/strategies/hover-preload.strategy.ts` | NEW — custom preloading strategy (Phase 3 only) |

**No backend files touched.**

---

## Implementation Notes and Gotchas

### `@defer` with Component Inputs

When a component inside `@defer` receives `@Input()` / `input()` signals, the inputs are passed as usual in the template. Angular handles the deferred load transparently. Example:

```html
@defer (when viewMode() === 'gantt') {
  <app-gantt-view
    [tasks]="state.ganttTasks()"
    [dependencies]="state.boardDependencies()"
    (taskClicked)="onListTaskClicked($event)"
  ></app-gantt-view>
} @placeholder {
  <div class="flex-1 flex items-center justify-center py-12 text-[var(--muted-foreground)]">
    Loading Gantt view...
  </div>
}
```

### Removing Components from `imports: []`

When switching a component from a static import to `@defer`, you **must** also remove it from the parent component's `imports: []` array. If you leave it there, Angular will still bundle it statically. The `@defer` block resolves the component reference on its own via the dynamic import mechanism.

### PreloadAllModules Tradeoff

Removing `PreloadAllModules` means users on slow connections will see a loading state when first navigating to a new route. The board view already shows a skeleton loader, as do most other views. This is acceptable. For users on fast connections (most VPS-hosted SaaS), the chunk download at navigation time is imperceptible (<100ms for a small lazy chunk).

### chart.js Size

`ChartModule` from `primeng/chart` wraps `chart.js`. chart.js is approximately 200 KB gzipped. Currently it loads as part of the dashboard route chunk. With `@defer (on viewport)`, it loads only when the user scrolls to the analytics section — which many users never do if they just glance at the summary numbers and recent activity.

### `@defer (when ...)` vs `@defer (on viewport)`

- Use `@defer (when someSignal())` for components that render based on application state (view mode toggle, tab selection).
- Use `@defer (on viewport)` for components that are structurally below the fold regardless of state (dashboard analytics grid, workspace panel in dashboard).

---

## Success Criteria Checklist

- [ ] **Baseline measured** — `ng build --stats-json` run before any changes; chunk sizes recorded (initial chunk, board-view chunk, dashboard chunk).
- [ ] **`@defer` applied to board-view alternate views** — Gantt, Reports, TimeReport, Calendar, and List view components are deferred; they no longer appear in the board-view static chunk.
- [ ] **`@defer` applied to dashboard analytics** — completion-trend, tasks-by-status, tasks-by-priority, upcoming-deadlines, team-workload, overdue-tasks-table are deferred on viewport; chart.js no longer present in dashboard initial load.
- [ ] **PreloadAllModules removed** — `app.config.ts` uses `NoPreloading` or a custom strategy; confirmed in Network tab that lazy chunks are not eagerly fetched after boot.
- [ ] **Workspace settings dialog deferred** — `WorkspaceSettingsDialogComponent` does not appear in initial chunk.
- [ ] **ToastModule audited** — either removed from `AppComponent` (if redundant) or confirmed necessary with explanation.
- [ ] **Post-optimization measurement** — `ng build --stats-json` run after all changes; initial chunk reduced by measurable amount (target: at least 20% smaller than baseline).
- [ ] **Board-view chunk reduced** — confirmed smaller than baseline (target: at least 30% smaller).
- [ ] **Production build passes** — `ng build --configuration=production` exits 0 with no budget errors under tightened budgets (500kB warning, 800kB error).
- [ ] **App functions correctly** — manual smoke test: switch all board view modes (kanban, list, calendar, gantt, reports, time-report); dashboard analytics load on scroll; workspace settings dialog opens; board settings tabs load.
- [ ] **No regressions in existing tests** — `ng test` passes.

---

## Progress Log

_To be updated during implementation._

| Date | Step | Result |
|------|------|--------|
| — | Baseline measurement | Pending |
| — | Phase 1 complete | Pending |
| — | Phase 2 complete | Pending |
| — | Phase 3 complete | Pending |
