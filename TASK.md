# TASK: Command Center — Teams + Settings Unified Hub

## Objective
Merge the 6-tab Teams page and workspace settings modal into a unified Command Center at `/workspace/:id/manage` with 4 clean tabs (People, Roles, Config, Activity) + people-forward hero section. Visually refresh personal Settings.

## Key Decisions (from eng + design reviews)
- Fresh ~300-line shell component, reuse existing child components
- People-forward hero with avatar stack (not stat cards)
- RBAC: Members see People + Activity only; Managers/Owners see all 4
- Personal settings stays global at `/settings/*`
- Old `/team-page` and `/team` routes redirect to `/manage`
- Sidebar icon: pi-users, label: "Manage"

## Implementation Plan

### Phase 1: Command Center Shell + Tests (TDD)
- [x] Write unit tests for ManageComponent (20 tests)
- [x] Create `features/manage/manage.component.ts` (~280 lines)
- [x] Hero section with avatar stack, stats, CTAs
- [x] 4 tabs with @defer, RBAC tab filtering
- [x] Loading/error/empty states
- [x] All 20 tests passing

### Phase 2: Route + Navigation Updates
- [x] Add `/workspace/:id/manage` route
- [x] Add redirects: `/team-page` → `manage`, `/team` → `manage`
- [x] Sidebar: "Team" → "Manage" with pi-users icon
- [x] Workspace menu: "Manage Workspace" link (replaced Team Overview + Settings modal)

### Phase 3: Settings Visual Refresh
- [x] Updated sidebar-title font-weight to 700
- [x] Add "Manage Workspace →" link in settings sidebar (with workspace context)

### Phase 4: Verify & Deploy
- [x] `npx tsc --noEmit` clean
- [x] `npm run build -- --configuration=production` clean
- [x] Deploy — frontend container rebuilt and running (healthy)

## Progress Log
- 2026-03-19: Design doc approved, eng + design reviews CLEARED
- 2026-03-19: Phase 1-3 complete. ManageComponent (280 lines), 20 tests passing, routes updated, sidebar/workspace menu updated, settings link added. tsc + ng build clean.
- 2026-03-19: Phase 4 complete. Docker image built, frontend container redeployed and healthy.
