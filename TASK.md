# TASK: Feature-by-Feature UI/UX Improvement Workflow

## Objective
Systematically improve every TaskFlow feature — starting with foundational layout/navigation,
then moving through Kanban, search, performance, real-time, notifications, and visual polish.

## Current Phase: A — Navigation & Layout (Foundational)

### Feature Queue
| # | Feature | Status |
|---|---------|--------|
| A1 | Top Navigation Bar | ✅ Done |
| A2 | Sidebar Redesign | ✅ Done |
| A3 | Breadcrumbs | ✅ Done |
| A4 | Layout Grid | ✅ Done |
| B1-B8 | Kanban Board | Pending |
| C1-C9 | Board Settings & Orphaned Features | Pending |
| D1-D4 | Search & Discovery | Pending |
| E1-E3 | Performance | Pending |
| F1-F3 | Real-Time Collaboration | Pending |
| G1-G3 | Notifications & Feedback | Pending |
| H1-H5 | Onboarding & Feature Discovery | Pending |
| I1-I5 | Visual Polish | Pending |

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

## Success Criteria
- Each feature: matches or exceeds competitor implementations in UX quality
- All checks pass (cargo check, tsc, build)
- No orphaned code (backend + frontend always paired)
