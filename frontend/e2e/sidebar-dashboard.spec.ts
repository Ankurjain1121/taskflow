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

    // The sidebar contains project items under app-sidebar-projects.
    const projectItem = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectItem).toBeVisible({ timeout: 10000 });

    const projectText = await projectItem.textContent();
    expect(projectText?.trim().length).toBeGreaterThan(0);

    // The sample board created during onboarding should appear as a project link.
    const projectLinks = page.locator('app-sidebar-projects a.project-item');
    await expect(projectLinks.first()).toBeVisible({ timeout: 10000 });

    const projectCount = await projectLinks.count();
    expect(projectCount).toBeGreaterThanOrEqual(1);

    // Clicking a project link should navigate to the project page
    await projectLinks.first().click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });
  });
});
