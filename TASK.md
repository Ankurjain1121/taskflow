# TASK: Feature-by-Feature UI/UX Improvement Workflow

## Objective
Systematically improve every TaskFlow feature — starting with foundational layout/navigation,
then moving through Kanban, search, performance, real-time, notifications, and visual polish.

## Current Phase: B — Kanban Board

### Feature Queue
| # | Feature | Status | Plan | Comp |
|---|---------|--------|------|------|
| A1 | Top Navigation Bar | ✅ Done | [section-02-top-navigation-bar](.ultraplan/sections/section-02-top-navigation-bar.md) | [comp.md#a1](comp.md#a1-top-navigation-bar) |
| A2 | Sidebar Redesign | ✅ Done | [mutable-bubbling-parnas](.claude/plans/mutable-bubbling-parnas.md) | [comp.md#a2](comp.md#a2-sidebar-redesign) |
| A3 | Breadcrumbs | ✅ Done | [mutable-bubbling-parnas](.claude/plans/mutable-bubbling-parnas.md) | [comp.md#a3](comp.md#a3-breadcrumbs) |
| A4 | Layout Grid | ✅ Done | [performance-optimization](.claude/plans/performance-optimization.md) | [comp.md#a4](comp.md#a4-layout-grid) |
| B1 | Rich Task Cards | ✅ Done | [stateless-weaving-orbit](.claude/plans/stateless-weaving-orbit.md) · [RESEARCH.md](RESEARCH.md) | [comp.md#b1](comp.md#b1-rich-task-cards) |
| B2 | Column Pagination | ✅ Done | [RESEARCH.md](RESEARCH.md) | [comp.md#b2](comp.md#b2-column-pagination) |
| B3 | Quick Filter Bar | ✅ Done | [RESEARCH.md](RESEARCH.md) · [plan-b3](plans2/plan-b3.md) | [comp.md#b3](comp.md#b3-quick-filter-bar) |
| B4 | Card Density Toggle | ✅ Done | [RESEARCH.md](RESEARCH.md) | [comp.md#b4](comp.md#b4-card-density-toggle) |
| B5 | Column Customization | ✅ Done | [RESEARCH.md](RESEARCH.md) | [comp.md#b5](comp.md#b5-column-customization) |
| B6 | Swimlanes | ✅ Done | [RESEARCH.md](RESEARCH.md) · [plan-b6](plans2/plan-b6.md) | [comp.md#b6](comp.md#b6-swimlanes) |
| B7 | Board Keyboard Shortcuts | ✅ Done | [RESEARCH.md](RESEARCH.md) · [plan-b7](plans2/plan-b7.md) | [comp.md#b7](comp.md#b7-board-keyboard-shortcuts) |
| B8 | Card Quick-Edit | ✅ Done | [mutable-zooming-moler](.claude/plans/mutable-zooming-moler.md) · [RESEARCH.md](RESEARCH.md) · [plan-b8](plans2/plan-b8.md) | [comp.md#b8](comp.md#b8-card-quick-edit) |
| C1-C9 | Board Settings & Orphaned Features | ✅ Done | [section-01-board-settings-overhaul](.ultraplan/sections/section-01-board-settings-overhaul.md) · [plan-c1c9](.claude/plans/reflective-whistling-eclipse.md) | [comp.md#c](comp.md#board-settings--orphaned-features-c1c9) |
| D1-D4 | Search & Discovery | ✅ Done | [section-03-command-palette](.ultraplan/sections/section-03-command-palette.md) · [plan-d1d4](plans2/plan-d1-d4.md) | [comp.md#d](comp.md#search--discovery-d1d4) |
| E1-E3 | Performance | ✅ Done | [section-05-list-performance](.ultraplan/sections/section-05-list-performance.md) · [performance-optimization](.claude/plans/performance-optimization.md) · [plan-e2](plans2/plan-e2.md) · [plan-e3](plans2/plan-e3.md) | [comp.md#e](comp.md#performance-e1e3) |
| F1-F3 | Real-Time Collaboration | ✅ Done | [section-06-presence-collaboration](.ultraplan/sections/section-06-presence-collaboration.md) · [plan-f1](plans2/plan-f1.md) | [comp.md#f](comp.md#real-time-collaboration-f1f3) |
| G1-G3 | Notifications & Feedback | ✅ Done | [section-07-push-notifications](.ultraplan/sections/section-07-push-notifications.md) | [comp.md#g](comp.md#notifications--feedback-g1g3) |
| H1-H5 | Onboarding & Feature Discovery | Pending | [section-08-feature-discovery](.ultraplan/sections/section-08-feature-discovery.md) · [plan-h1](plans2/plan-h1.md) · [plan-h2](plans2/plan-h2.md) · [plan-h3](plans2/plan-h3.md) · [plan-h4](plans2/plan-h4.md) · [plan-h5](plans2/plan-h5.md) | [comp.md#h](comp.md#onboarding--feature-discovery-h1h5) |
| I1-I5 | Visual Polish | Pending | [section-09-visual-polish](.ultraplan/sections/section-09-visual-polish.md) | [comp.md#i](comp.md#visual-polish-i1i5) |

## Per-Feature Workflow
1. Research competitor implementations
2. Ask user for direction
3. Execute approved changes
4. Check + verify
5. Move to next feature

## Progress Log
- 2026-03-02: Plan approved, starting Feature A1 research
- 2026-03-02: A1 complete — TopNavComponent wired into AppComponent, LayoutComponent deleted, sidebar collapse working
- 2026-03-02: A2 complete — sidebar redesigned: user profile footer, notification badge, collapsible sections, board hover actions, bug fixes
- 2026-03-02: A3 complete — breadcrumb board name resolution fixed: BoardService injection + in-memory cache + stale-response guard (activeBoardId)
- 2026-03-02: A4 complete — layout grid: CSS variables (--nav-height, --sidebar-width*), overflow:clip on route-transition-wrapper, board-view h-screen → .board-root with dvh calc
- 2026-03-02: B1-B8 research complete — competitor analysis (10 competitors × 8 features), file breakdowns, 3-phase plan written to RESEARCH.md
- 2026-03-02: comp.md created — unified competitor analysis index for all A–I phases (44 sub-features); TASK.md updated with Comp column linking to comp.md anchors
- 2026-03-02: B4 complete — Compact/Normal/Expanded density toggle in toolbar, persists to localStorage; B5 complete — column icon picker (emoji), WIP limit dialog, Rename, Delete; full-stack (Rust migration + PUT endpoints + Angular dialogs)
- 2026-03-02: B3 complete — Quick Filter Bar: rounded pill chips (native buttons), Overdue pill (red when active), Clear all link, `overdue` in URL/state/filter logic, `F` keyboard shortcut to focus search
- 2026-03-02: B6 complete — Swimlanes / Group By: dropdown in toolbar (Assignee/Priority/Label/None), 2D swimlane grid with sticky row labels + sticky column header, cross-lane drag updates task properties (assignee unassign/reassign, priority patch, label remove/add), optimistic updates with rollback, localStorage persistence, "Group: X" chip with × clear button
- 2026-03-02: B7 complete — Board Keyboard Shortcuts: h/l column navigation, Space drag-simulation (pick-up/move/drop), Esc cancel, c clear filters, d cycle density, e edit title, Delete delete card; shortcut help modal upgraded (2-col grid, search, recently used, ARIA); PrimeNG Tooltip hints on toolbar buttons; pushDisable/popDisable stack for modal-open suppression
- 2026-03-02: B8 complete — Card Quick-Edit Popovers: hover-reveal edit buttons on task cards for priority, assignee, due-date, labels; CDK focus-trap popover with @switch pickers; 4 optimistic board-state methods (assign/unassign user, add/remove label); PrimeNG DatePicker inline with Clear; ARIA role="dialog", cdkTrapFocus
- 2026-03-02: C1-C9 complete — C1: board color picker (16 presets, CSS custom prop on board-view); C2: archive board button in Settings > Advanced, sidebar Archived link; C4: owner role (DB enum, badge in Members tab, permission matrix); C8: duplicate board (deep copy board+columns+tasks, position-based column mapping); C3/C5/C6/C7/C9 verified already working
- 2026-03-02: E2 complete — optimistic updates for board task drawer (onAssign, onUnassign, onRemoveLabel, onMilestoneChange, onClearMilestone) and standalone task page (onAssign, onUnassign, onRemoveLabel); snapshot/rollback pattern with PrimeNG error toast; p-toast + MessageService added to standalone page
- 2026-03-02: E3 complete — @defer(when) on 5 alternate board views (list/calendar/gantt/reports/time-report); @defer(on viewport) on dashboard analytics grid (6 chart widgets); @defer(on idle) on WorkspaceSettingsDialog in AppComponent; PreloadAllModules → NoPreloading in app.config; angular.json budgets tightened (500kB warning / 1.10MB error); initial bundle 1.06MB / 247kB gzipped
- 2026-03-02: E1 complete — my-tasks-timeline limit 1000→200 (biggest win); task-list-item host class='block' for CDK virtual scroll readiness; notification-item migrated @Input/@Output → input()/output() signals (Angular 19 modern API)
- 2026-03-02: D1-D4 complete — Command Palette (Ctrl+K): CommandPaletteComponent with keyboard nav (Up/Down/Enter), 10 quick actions, command mode (> prefix), debounced global search (200ms) with grouped results (tasks/boards/comments), RecentItemsService (localStorage + server-side tracking); Backend: recent_items table + upsert/list API, search filters (assignee/label/status/board_id), SearchResultCounts, recency boost ordering; deployed + API smoke-tested
- 2026-03-02: G1-G3 complete — G1: hover-reveal "×" dismiss button on notification items, soft-archive backend (DELETE /api/notifications/{id} → 204, archived_at column + IS NULL filter); G2: PushNotificationService (Notification API permission signal, notify on new WS msg when tab not focused), Browser Notifications card in Settings > Notifications (status badge + Enable button + guidance); G3: quiet hours enable/disable toggle in Settings > Notifications, wired to backend via existing user_preferences endpoint; archived_at migration applied to DB, sqlx cache updated
- 2026-03-02: F1-F3 complete — F1 Presence: PresenceService (Redis HASH + heartbeat + stale cleanup), WS handler (join/leave/heartbeat/lock/unlock), frontend PresenceService (signals, 15s heartbeat), BoardPresenceComponent (avatar stack), task lock/unlock with amber ring on cards. F2 Save Status: SaveStatusService (idle→saving→saved→idle state machine), SaveStatusIndicatorComponent in top nav, retryTransient RxJS operator. F3 Conflict Resolution: changed_fields/origin_user_name in TaskBroadcast, ConflictNotificationService (field-level toast warnings), OCC version column (migration + WHERE version check), 409 VersionConflict response, ConflictDialogComponent (two-column diff, Keep Mine/Accept Theirs/Cancel), word-level LCS diff for descriptions.
- 2026-03-02: H5 complete — Keyboard shortcut discoverability: ? button in TopNav (opens modal), blue recently-used kbd highlights in ShortcutHelpComponent, "Open Reference" button in HelpComponent, view-mode tooltips now show shortcut keys (1)–(6), new ShortcutDiscoveryBannerComponent (first-visit, 8s auto-dismiss, writes tf_shortcut_modal_opened / tf_shortcut_dismissed_banner to localStorage), banner wired into BoardViewComponent. No backend changes. tsc + build pass.
- 2026-03-03: B1/B2 complete — Column Collapse (already implemented), Configurable Card Fields (CardFields signal in BoardStateService, Fields popover in toolbar with 10 toggles, @if guards on all card fields in task-card, cardFields prop threaded through kanban-column + swimlane-container + swimlane-row), Days-in-Column Indicator (backend: column_entered_at TIMESTAMPTZ migration + model field + CASE WHEN update on column move; frontend: daysInColumn computed + dotsArray, colored dots on normal/expanded cards — gray 1-3d, amber 4-7d, red 8+d). All checks pass.

## Success Criteria
- Each feature: matches or exceeds competitor implementations in UX quality
- All checks pass (cargo check, tsc, build)
- No orphaned code (backend + frontend always paired)
