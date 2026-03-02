# Section 05: List Performance & Virtual Scrolling

> Project: TaskFlow World-Class Upgrade
> Batch: 2 | Tasks: 5 | Risk: YELLOW
> PRD Features: P0 - Read-Only Virtual Scrolling

---

## Overview

Add Angular CDK virtual scrolling to all read-only long lists: My Tasks timeline, notification dropdown, activity feeds, and list view. These lists can grow to hundreds of items. Virtual scrolling renders only visible items, keeping scroll performance smooth.

**IMPORTANT:** Virtual scrolling is ONLY for read-only lists. It CANNOT be combined with CDK drag-and-drop (kanban columns use pagination from Section 04 instead).

---

## Risk

| Aspect | Value |
|--------|-------|
| Color | YELLOW |
| Summary | CDK virtual scroll needs fixed item heights and careful integration |

### Risk Factors
- Complexity: 2 (virtual scroll viewport setup)
- Novelty: 2 (first virtual scroll in this codebase)
- Dependencies: 1 (Section 04 pagination pattern)
- Integration: 1 (internal CDK)
- Data sensitivity: 1 (read-only)
- **Total: 7** bumped to YELLOW due to **first-time usage** and fixed-height requirement

### Mitigation
- Start with My Tasks (simplest, most consistent item heights)
- Use `autosize` strategy if items have variable heights
- Profile before/after with Angular DevTools

---

## Dependencies

| Type | Section | Description |
|------|---------|-------------|
| Soft depends on | Section 04 | Pagination pattern established |

**Batch:** 2

---

## TDD Test Stubs

1. `MyTasksListComponent should use CdkVirtualScrollViewport for task list rendering`
2. `MyTasksListComponent should render only visible tasks (not all 500)`
3. `NotificationListComponent should use virtual scroll for long notification lists`
4. `ActivityFeedComponent should use virtual scroll for activity entries`
5. `Virtual scroll should maintain scroll position when data updates`

---

## Tasks

### Task 1: Add Virtual Scrolling to My Tasks
**Files:** `features/my-tasks/` components
**Steps:**
1. Import `ScrollingModule` from `@angular/cdk/scrolling`
2. Wrap task list in `<cdk-virtual-scroll-viewport>`
3. Use `*cdkVirtualFor` instead of `@for` for task items
4. Set `itemSize` to task row height (estimate ~64px)
5. Set viewport height to fill available space
**Done when:** My Tasks with 500+ items scrolls smoothly with only ~20 DOM elements

### Task 2: Add Virtual Scrolling to Notification List
**Files:** `notification-bell.component.ts` or notification panel
**Steps:**
1. Wrap notification list in virtual scroll viewport
2. Set `itemSize` to notification item height (~72px)
3. Handle "mark as read" action within virtual scroll context
**Done when:** Notification list with 100+ items scrolls smoothly

### Task 3: Add Virtual Scrolling to Activity Feeds
**Files:** `task-detail-activity.component.ts`
**Steps:**
1. Wrap activity log in virtual scroll viewport
2. Handle variable-height items (some activities have more text)
3. Use `autosize` scroll strategy if needed
**Done when:** Activity feed with 200+ entries scrolls smoothly

### Task 4: Add Virtual Scrolling to Board List View
**Files:** Board list view component
**Steps:**
1. Apply virtual scroll to the table/list rendering
2. Maintain sorting and filtering compatibility
3. Keep inline editing functional within virtual scroll
**Done when:** List view with 200+ tasks scrolls smoothly

### Task 5: Performance Validation
**Steps:**
1. Create test data: 500 tasks in My Tasks, 200 notifications, 300 activity entries
2. Measure DOM node count before/after virtual scrolling
3. Measure scroll FPS using Chrome DevTools Performance tab
4. Target: <30 DOM nodes visible, 60fps scroll
**Done when:** All virtual scroll implementations meet performance targets

---

## Section Completion Criteria

- [ ] My Tasks uses virtual scrolling
- [ ] Notifications use virtual scrolling
- [ ] Activity feeds use virtual scrolling
- [ ] Board list view uses virtual scrolling
- [ ] All virtual scroll lists maintain 60fps scroll performance
- [ ] DOM node count stays under 30 for visible items
- [ ] Existing functionality (filters, actions, navigation) still works
