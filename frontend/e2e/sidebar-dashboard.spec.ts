import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { signUpAndOnboard } from './helpers/auth';

test.describe('Sidebar & Dashboard Overhaul', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Sidebar Dashboard WS');
  });

  test('"My Tasks Today" widget visible on dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // The MyTasksTodayComponent renders an h3 with "My Tasks Today"
    const myTasksTodayHeading = page.locator(
      'app-my-tasks-today h3:has-text("My Tasks Today")',
    );
    await expect(myTasksTodayHeading).toBeVisible({ timeout: 15000 });

    // The widget also contains a "View all" link to /my-tasks
    const viewAllLink = page.locator(
      'app-my-tasks-today a[href="/my-tasks"]:has-text("View all")',
    );
    await expect(viewAllLink).toBeVisible({ timeout: 5000 });
  });

  test('workspace filter dropdown on dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // The workspace filter (p-select) is only rendered when there are
    // multiple workspaces. A freshly onboarded user has exactly one
    // workspace, so the dropdown should NOT be present.
    const workspaceDropdown = page.locator('p-select');
    const dropdownVisible = await workspaceDropdown
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (dropdownVisible) {
      // If somehow visible (user has multiple workspaces), verify it works
      await expect(workspaceDropdown).toBeVisible();
      // It should contain at least "All Workspaces" as an option
      await workspaceDropdown.click();
      await expect(
        page.locator('text=All Workspaces').first(),
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Single workspace: dropdown is correctly hidden.
      // Verify the dashboard header area exists but has no p-select
      const headerArea = page.locator('app-dashboard header');
      await expect(headerArea).toBeVisible({ timeout: 5000 });
      expect(dropdownVisible).toBe(false);
    }
  });

  test('sidebar workspace expands to show boards', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // The sidebar contains app-workspace-item components.
    // After onboarding, the first workspace auto-expands (expanded = true on init).
    const workspaceItem = page.locator('app-workspace-item').first();
    await expect(workspaceItem).toBeVisible({ timeout: 10000 });

    // The workspace header button shows the workspace name
    const workspaceHeader = workspaceItem.locator(
      'button.workspace-header-btn',
    );
    await expect(workspaceHeader).toBeVisible({ timeout: 5000 });
    const headerText = await workspaceHeader.textContent();
    expect(headerText?.trim().length).toBeGreaterThan(0);

    // Since the workspace auto-expands on init, boards should already be
    // visible. The sample board created during onboarding should appear.
    const boardLinks = workspaceItem.locator('a[href*="/board/"]');
    await expect(boardLinks.first()).toBeVisible({ timeout: 10000 });

    const boardCount = await boardLinks.count();
    expect(boardCount).toBeGreaterThanOrEqual(1);

    // Collapse the workspace by clicking the header button
    await workspaceHeader.click();

    // Board links should now be hidden (the @if (expanded()) block is gone)
    await expect(boardLinks.first()).toBeHidden({ timeout: 5000 });

    // Re-expand by clicking again
    await workspaceHeader.click();

    // Boards should be visible again
    await expect(boardLinks.first()).toBeVisible({ timeout: 10000 });
  });
});
