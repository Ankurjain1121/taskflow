# Section 02: Top Navigation Bar

> Project: TaskFlow World-Class Upgrade
> Batch: 1 | Tasks: 6 | Risk: GREEN
> PRD Features: P0 - Top Navigation Bar

---

## Overview

The current TaskFlow layout has only a sidebar and minimal header. This section adds a persistent top navigation bar that becomes the primary action hub. The top bar contains: global search trigger, notification bell (moved from current position), quick-create button, user menu, and breadcrumbs showing current location.

The sidebar stays but becomes narrower - focused only on workspace/board navigation. The top bar handles everything "action-oriented."

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | GREEN |
| Summary | Layout restructure with existing components |

### Risk Factors
- Complexity: 2 (layout restructure affects all pages)
- Novelty: 1 (standard navigation pattern)
- Dependencies: 1 (no dependencies)
- Integration: 1 (internal only)
- Data sensitivity: 1 (no new data)
- **Total: 6 → GREEN**

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| None | - | No dependencies |
| Blocks | Section 08 | Feature discovery tooltips attach to top bar items |
| Blocks | Section 09 | Visual polish refines top bar styling |

**Batch:** 1
**Parallel siblings:** Section 01, 03, 04

---

## TDD Test Stubs

1. `TopNavBarComponent should render search trigger, notifications, quick-create, and user menu`
2. `TopNavBarComponent should show breadcrumbs reflecting current route (Workspace > Board > Task)`
3. `TopNavBarComponent should open command palette when search trigger is clicked`
4. `TopNavBarComponent should show notification count badge from NotificationService`
5. `QuickCreateComponent should open a task creation dialog when clicked`
6. `LayoutComponent should render top nav bar above main content area`

---

## Files Touched

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/app/shared/components/top-nav/top-nav.component.ts` | CREATE | New top navigation bar component |
| `frontend/src/app/shared/components/top-nav/breadcrumbs.component.ts` | CREATE | Breadcrumb trail component |
| `frontend/src/app/shared/components/top-nav/quick-create.component.ts` | CREATE | Quick task creation button + dialog trigger |
| `frontend/src/app/shared/components/layout/layout.component.ts` | MODIFY | Add top nav bar to layout, adjust grid |
| `frontend/src/app/shared/components/sidebar/sidebar.component.ts` | MODIFY | Slim down, remove items moved to top bar |

---

## Tasks

### Task 1: Create Top Nav Bar Component
**Files:** `top-nav.component.ts`
**Steps:**
1. Create standalone component with Tailwind styling
2. Layout: left (breadcrumbs) | center (search trigger) | right (quick-create, notifications, user avatar)
3. Fixed position at top, full width, z-index above content
4. Height: 48-56px, subtle bottom border
**Done when:** Component renders with placeholder content

### Task 2: Implement Breadcrumbs
**Files:** `breadcrumbs.component.ts`
**Steps:**
1. Inject Angular Router, listen to route changes
2. Build breadcrumb trail from route data: Workspace Name > Board Name > (Task Title)
3. Each breadcrumb is a clickable link
4. Truncate long names with ellipsis
**Done when:** Breadcrumbs update correctly when navigating between pages

### Task 3: Implement Quick Create Button
**Files:** `quick-create.component.ts`
**Steps:**
1. "+" button that opens existing CreateTaskDialog
2. Pre-selects current board if user is on a board page
3. Keyboard shortcut "N" triggers quick create (when not in an input field)
**Done when:** Clicking "+" opens task creation dialog with current board context

### Task 4: Move Notification Bell to Top Bar
**Files:** `top-nav.component.ts`, `layout.component.ts`
**Steps:**
1. Import existing `NotificationBellComponent` into top nav bar
2. Remove it from its current position in layout header
3. Verify real-time notification count still works
**Done when:** Notification bell appears in top bar with live unread count

### Task 5: Add User Menu to Top Bar
**Files:** `top-nav.component.ts`
**Steps:**
1. User avatar (from auth service) as trigger
2. PrimeNG Menu dropdown: Profile, Settings, Theme Toggle, Sign Out
3. Show user name + workspace name on hover
**Done when:** Clicking avatar opens menu with working navigation links

### Task 6: Update Layout Grid
**Files:** `layout.component.ts`, `sidebar.component.ts`
**Steps:**
1. Layout becomes: top-nav (fixed top) + sidebar (fixed left) + content (scrollable)
2. Content area accounts for both top bar height and sidebar width
3. Sidebar removes items now in top bar (notification bell, user profile section)
4. Sidebar becomes narrower, focused on workspace/board navigation
5. Mobile: sidebar collapses, top bar stays visible
**Done when:** Layout renders correctly with both top bar and slimmed sidebar on all pages

---

## Section Completion Criteria

- [ ] Top navigation bar renders on all authenticated pages
- [ ] Breadcrumbs show correct path and are clickable
- [ ] Quick-create opens task dialog with board context
- [ ] Notification bell works in new position with live count
- [ ] User menu provides navigation to profile, settings, sign out
- [ ] Layout grid is correct (no overlap, proper spacing)
- [ ] Mobile viewport: sidebar hidden, top bar visible

---

## Notes

### Recommended Paradigm
**Primary:** Declarative - Angular template-driven layout composition
**Secondary:** Reactive - Signal-based breadcrumb state from Router events
**Rationale:** Layout components are declarative templates. Breadcrumbs use reactive signals from router.

### Design Reference
The top bar should follow the "Clean & Friendly" mood:
- White/light background (or dark in dark mode)
- Subtle bottom shadow (not harsh border)
- Rounded button shapes
- Warm accent color for the quick-create button
- Generous horizontal padding (px-4 to px-6)
