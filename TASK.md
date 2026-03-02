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
| B1 | Rich Task Cards | Pending | [stateless-weaving-orbit](.claude/plans/stateless-weaving-orbit.md) · [RESEARCH.md](RESEARCH.md) | [comp.md#b1](comp.md#b1-rich-task-cards) |
| B2 | Column Pagination | Pending | [RESEARCH.md](RESEARCH.md) | [comp.md#b2](comp.md#b2-column-pagination) |
| B3 | Quick Filter Bar | ✅ Done | [RESEARCH.md](RESEARCH.md) · [plan-b3](plans2/plan-b3.md) | [comp.md#b3](comp.md#b3-quick-filter-bar) |
| B4 | Card Density Toggle | Pending | [RESEARCH.md](RESEARCH.md) | [comp.md#b4](comp.md#b4-card-density-toggle) |
| B5 | Column Customization | Pending | [RESEARCH.md](RESEARCH.md) | [comp.md#b5](comp.md#b5-column-customization) |
| B6 | Swimlanes | Pending | [RESEARCH.md](RESEARCH.md) · [plan-b6](plans2/plan-b6.md) | [comp.md#b6](comp.md#b6-swimlanes) |
| B7 | Board Keyboard Shortcuts | Pending | [RESEARCH.md](RESEARCH.md) | [comp.md#b7](comp.md#b7-board-keyboard-shortcuts) |
| B8 | Card Quick-Edit | Pending | [mutable-zooming-moler](.claude/plans/mutable-zooming-moler.md) · [RESEARCH.md](RESEARCH.md) | [comp.md#b8](comp.md#b8-card-quick-edit) |
| C1-C9 | Board Settings & Orphaned Features | Pending | [section-01-board-settings-overhaul](.ultraplan/sections/section-01-board-settings-overhaul.md) | [comp.md#c](comp.md#board-settings--orphaned-features-c1c9) |
| D1-D4 | Search & Discovery | Pending | [section-03-command-palette](.ultraplan/sections/section-03-command-palette.md) | [comp.md#d](comp.md#search--discovery-d1d4) |
| E1-E3 | Performance | Pending | [section-05-list-performance](.ultraplan/sections/section-05-list-performance.md) · [performance-optimization](.claude/plans/performance-optimization.md) | [comp.md#e](comp.md#performance-e1e3) |
| F1-F3 | Real-Time Collaboration | Pending | [section-06-presence-collaboration](.ultraplan/sections/section-06-presence-collaboration.md) | [comp.md#f](comp.md#real-time-collaboration-f1f3) |
| G1-G3 | Notifications & Feedback | Pending | [section-07-push-notifications](.ultraplan/sections/section-07-push-notifications.md) | [comp.md#g](comp.md#notifications--feedback-g1g3) |
| H1-H5 | Onboarding & Feature Discovery | Pending | [section-08-feature-discovery](.ultraplan/sections/section-08-feature-discovery.md) | [comp.md#h](comp.md#onboarding--feature-discovery-h1h5) |
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
- 2026-03-02: B3 complete — Quick Filter Bar: rounded pill chips (native buttons), Overdue pill (red when active), Clear all link, `overdue` in URL/state/filter logic, `F` keyboard shortcut to focus search

## Success Criteria
- Each feature: matches or exceeds competitor implementations in UX quality
- All checks pass (cargo check, tsc, build)
- No orphaned code (backend + frontend always paired)
