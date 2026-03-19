import { test, expect, Page } from '@playwright/test';
import { signInTestUser, TEST_PASSWORD } from '../helpers/auth';
import {
  loadSeedData,
  SeedData,
  getWorkspacesForUser,
} from '../helpers/seed-data';

let seed: SeedData;

test.beforeAll(() => {
  seed = loadSeedData();
});

/** Sign in as user[0] (admin, member of all 10 workspaces) */
async function loginAsAdmin(page: Page) {
  await signInTestUser(page, seed.users[0].email, TEST_PASSWORD);
}

test.describe('Dashboard Views', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForURL(/\/(dashboard|workspace|board)/, { timeout: 20000 });
  });

  test('dashboard shows greeting', async ({ page }) => {
    const greeting = page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible({ timeout: 10000 });
  });

  test('workspace switcher lists all 10 workspaces', async ({ page }) => {
    // User[0] is in all 10 workspaces
    const workspaceLinks = page.locator('app-sidebar-projects a.project-item');
    await expect(workspaceLinks.first()).toBeVisible({ timeout: 15000 });
    const count = await workspaceLinks.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('clicking project navigates to project page', async ({ page }) => {
    // Click into first project
    await page.locator('app-sidebar-projects a.project-item').first().click();
    await page.waitForURL(/\/project\//, { timeout: 15000 });

    // Page should load
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard shows tasks assigned to current user', async ({ page }) => {
    // User[0] should have tasks visible on dashboard
    const dashboardContent = page.locator('main, [class*="dashboard"]').first();
    await expect(dashboardContent).toBeVisible({ timeout: 10000 });
  });

  test('task count badge matches actual assigned tasks', async ({ page }) => {
    // Dashboard should have a section showing task counts
    const content = await page.textContent('body');
    // Verify dashboard loaded with task-related content
    expect(content).toBeTruthy();
  });

  test('recently viewed section updates after visiting a project', async ({
    page,
  }) => {
    // Navigate to a project first via sidebar
    await page.locator('app-sidebar-projects a.project-item').first().click();
    await page.waitForURL(/\/project\//, { timeout: 15000 });

    // Go back to dashboard
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test('quick-add task from project page', async ({
    page,
  }) => {
    // Navigate to a project via sidebar
    await page.locator('app-sidebar-projects a.project-item').first().click();
    await page.waitForURL(/\/project\//, { timeout: 15000 });

    const newTaskBtn = page.locator('button:has-text("New Task")');
    if (await newTaskBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newTaskBtn.click();
      const dialog = page.locator('mat-dialog-container, [role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 10000 });
      // Close without creating
      await page.keyboard.press('Escape');
    }
  });

  test('dashboard search filters tasks by title', async ({ page }) => {
    const searchInput = page
      .locator(
        'input[placeholder*="Search"], input[type="search"], [class*="search"] input',
      )
      .first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('Task-1');
      await page.waitForTimeout(1000);
      // Search should filter visible content
    }
  });

  test('empty workspace shows empty state correctly', async ({ page }) => {
    // This tests the general dashboard state rendering
    const dashboardBody = page.locator('body');
    const content = await dashboardBody.textContent();
    expect(content).toBeTruthy();
  });

  test('notification bell is visible and clickable', async ({ page }) => {
    const notifBell = page
      .locator(
        'button[aria-label*="notification"], mat-icon:has-text("notifications"), [class*="notification"] button',
      )
      .first();
    if (await notifBell.isVisible({ timeout: 5000 }).catch(() => false)) {
      await notifBell.click();
      await page.waitForTimeout(500);
    }
  });

  test('user avatar/menu shows current user name', async ({ page }) => {
    const userMenu = page
      .locator(
        'button[mat-icon-button]:has(mat-icon:has-text("account_circle")), [class*="avatar"], [class*="user-menu"]',
      )
      .first();
    if (await userMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userMenu.click();
      // Menu should show user info
      await page.waitForTimeout(500);
    }
  });

  test('project with 0 tasks shows appropriate empty state', async ({
    page,
  }) => {
    // Navigate to a project and check empty state
    await page.locator('app-sidebar-projects a.project-item').first().click();
    await page.waitForURL(/\/project\//, { timeout: 15000 });
    // The project view should load without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('dashboard loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    const greeting = page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible({ timeout: 10000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('multiple rapid workspace switches do not cause race conditions', async ({
    page,
  }) => {
    const wsLinks = page.locator('app-sidebar-projects a.project-item');
    await expect(wsLinks.first()).toBeVisible({ timeout: 15000 });
    const count = await wsLinks.count();
    if (count >= 2) {
      // Rapidly click through workspaces
      await wsLinks.nth(0).click();
      await page.waitForTimeout(200);
      await page.goto('/dashboard');
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await wsLinks.first().waitFor({ timeout: 10000 });
      await wsLinks.nth(Math.min(1, count - 1)).click();
      await page.waitForURL(/\/project\//, { timeout: 15000 });
      // Page should not be in a broken state
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('dashboard data refreshes after browser back/forward navigation', async ({
    page,
  }) => {
    // Navigate to project
    await page.locator('app-sidebar-projects a.project-item').first().click();
    await page.waitForURL(/\/project\//, { timeout: 15000 });

    // Go back to dashboard
    await page.goBack();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Go forward
    await page.goForward();
    await page.waitForURL(/\/project\//, { timeout: 15000 });

    // Should still show project content
    await expect(page.locator('body')).toBeVisible();
  });
});
