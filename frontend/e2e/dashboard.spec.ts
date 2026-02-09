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
});
