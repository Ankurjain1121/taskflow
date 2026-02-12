import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { signUpAndOnboard } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Create a fully onboarded user so we land on the dashboard
    await signUpAndOnboard(page, 'Dashboard Test WS');
  });

  test('dashboard loads with welcome heading', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
    await expect(dashboard.subtitle).toBeVisible();
  });

  test('dashboard shows stats cards', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
    await dashboard.expectStatsVisible();
  });

  test('dashboard shows the workspace created during onboarding', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // The workspace section should be visible
    await dashboard.expectWorkspacesVisible();

    // There should be at least one workspace card
    const count = await dashboard.getWorkspaceCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('My Tasks link is visible and clickable', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    await expect(dashboard.myTasksLink).toBeVisible();
    await dashboard.myTasksLink.click();
    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 10000 });
  });

  test('unauthenticated user is redirected to sign-in', async ({ browser }) => {
    // Use a fresh context with no auth state
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto('https://taskflow.paraslace.in/dashboard');

    // Should be redirected to sign-in
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
    await context.close();
  });

  // NEW: Stats show 0 or valid numbers for fresh workspace
  test('stats show zero or valid numbers for fresh workspace', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
    await dashboard.expectStatsVisible();

    // Each stat card should contain a number (0 or more)
    const statValues = page.locator('.grid .rounded-xl.shadow-sm .text-2xl, .grid .rounded-xl.shadow-sm .text-3xl, .grid .rounded-xl.shadow-sm .font-bold');
    const count = await statValues.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const text = await statValues.nth(i).textContent();
        // The value should be a number (possibly with formatting)
        expect(text?.trim()).toMatch(/^\d+/);
      }
    }
  });

  // NEW: Sidebar visible with navigation items
  test('sidebar is visible with navigation items', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // Look for sidebar or navigation elements
    const sidebar = page.locator('nav, aside, [role="navigation"], .sidebar, .sidenav');
    const sidebarVisible = await sidebar.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (sidebarVisible) {
      // Sidebar should contain navigation links
      const navLinks = sidebar.first().locator('a, button');
      const linkCount = await navLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    } else {
      // Check for mat-sidenav or Angular Material sidebar
      const matSidenav = page.locator('mat-sidenav, mat-drawer');
      const matVisible = await matSidenav.first().isVisible({ timeout: 3000 }).catch(() => false);
      // Either regular sidebar or mat-sidenav should exist
      expect(sidebarVisible || matVisible).toBeTruthy();
    }
  });

  // NEW: Click workspace card navigates to workspace page
  test('click workspace card navigates to workspace page', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
    await dashboard.expectWorkspacesVisible();

    // Click the first workspace
    await dashboard.clickFirstWorkspace();

    // Should navigate to a workspace URL
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });
  });

  // NEW: Overdue tasks section renders
  test('overdue tasks section renders on dashboard', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // Look for overdue section or stat
    const overdueSection = page.locator('text=Overdue');
    await expect(overdueSection.first()).toBeVisible({ timeout: 10000 });
  });

  // NEW: Upcoming deadlines section renders
  test('upcoming deadlines or due today section renders', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // Look for due today or upcoming section
    const dueSection = page.locator('text=Due Today');
    await expect(dueSection.first()).toBeVisible({ timeout: 10000 });
  });

  // NEW: Completed tasks section renders
  test('completed tasks section renders', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // Look for completed stat card
    const completedSection = page.locator('text=Completed This Week');
    await expect(completedSection.first()).toBeVisible({ timeout: 10000 });
  });

  // NEW: Page loads within reasonable time
  test('dashboard loads within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    const loadTime = Date.now() - startTime;

    // Page should load within 15 seconds (generous for live VPS)
    expect(loadTime).toBeLessThan(15000);
  });
});
