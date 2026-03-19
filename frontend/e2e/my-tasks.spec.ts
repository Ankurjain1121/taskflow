import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';
import { DashboardPage } from './pages/DashboardPage';

/** Wait for the My Tasks page to fully load (greeting banner visible) */
async function waitForMyTasksPage(page: import('@playwright/test').Page) {
  await page.goto('/my-tasks');
  await page.waitForLoadState('domcontentloaded');

  // Wait for the view toggle buttons (always rendered regardless of API state)
  const myTasksBtn = page.locator('button:has-text("My Tasks")').first();
  await expect(myTasksBtn).toBeVisible({ timeout: 20000 });
}

let testEmail: string;

test.describe('My Tasks', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    const page = await browser.newPage();
    testEmail = await signUpAndOnboard(page, 'My Tasks WS');
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('page loads with view toggle and content', async ({ page }) => {
    await waitForMyTasksPage(page);

    // The page always shows the toggle buttons and content area
    await expect(
      page.locator('button:has-text("My Tasks")').first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button:has-text("Tasks I Created")'),
    ).toBeVisible({ timeout: 10000 });

    // Either the Overdue group header or the empty state should be visible
    const content = page
      .locator('h2:has-text("Overdue")')
      .or(page.locator('h3:has-text("all caught up")'));
    await expect(content.first()).toBeVisible({ timeout: 20000 });
  });

  test('view toggle buttons are visible', async ({ page }) => {
    await waitForMyTasksPage(page);

    // The page has view toggle buttons: "My Tasks" and "Tasks I Created"
    await expect(
      page.locator('button:has-text("My Tasks")').first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button:has-text("Tasks I Created")'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('empty state shows caught up message when no assigned tasks', async ({
    page,
  }) => {
    await waitForMyTasksPage(page);

    // Wait for loading to finish - either empty state or timeline groups appear
    // Fresh workspace with no tasks assigned should show "You're all caught up!"
    const emptyMessage = page.locator('h3:has-text("all caught up")');
    await expect(emptyMessage).toBeVisible({ timeout: 20000 });
  });

  test('My Tasks toggle is active by default', async ({ page }) => {
    await waitForMyTasksPage(page);

    // The "My Tasks" button should have the active/highlighted style (bg-indigo-600)
    const myTasksBtn = page.locator('button:has-text("My Tasks")').first();
    await expect(myTasksBtn).toBeVisible({ timeout: 10000 });
    // Active button has indigo-600 class applied via [class] binding
    await expect(myTasksBtn).toHaveClass(/indigo/, { timeout: 10000 });
  });

  test('clicking Tasks I Created toggle works', async ({ page }) => {
    await waitForMyTasksPage(page);

    // Click the "Tasks I Created" toggle
    const createdBtn = page
      .locator('button:has-text("Tasks I Created")')
      .first();
    await createdBtn.click();

    // After clicking, the "Tasks I Created" button should now be active
    await expect(createdBtn).toHaveClass(/indigo/, { timeout: 10000 });
  });

  test('page accessible from sidebar My Work link', async ({ page }) => {
    // From dashboard, click "My Work" in the sidebar
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    const myWorkLink = page.locator('a:has-text("My Work")').first();
    await expect(myWorkLink).toBeVisible({ timeout: 10000 });
    await myWorkLink.click();

    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });

    // View toggle buttons should appear
    await expect(
      page.locator('button:has-text("My Tasks")').first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('page accessible from dashboard My Tasks link', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    // The "My Tasks" link/button on the dashboard
    const myTasksLink = page.locator('a[href="/my-tasks"]').first();
    await expect(myTasksLink).toBeVisible({ timeout: 10000 });
    await myTasksLink.click();

    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });
  });

  test('page handles fresh workspace with no tasks gracefully', async ({
    page,
  }) => {
    await waitForMyTasksPage(page);

    // Wait for loading to complete (skeleton elements should disappear)
    await expect(page.locator('.skeleton').first())
      .toBeHidden({ timeout: 20000 })
      .catch(() => {});

    // No error messages should be shown
    await expect(page.locator('text=Failed to load')).toBeHidden({
      timeout: 5000,
    });
  });

  test('Matrix View link is visible', async ({ page }) => {
    await waitForMyTasksPage(page);

    // Matrix View link navigates to /eisenhower
    const matrixLink = page.locator('a[href="/eisenhower"]');
    await expect(matrixLink).toBeVisible({ timeout: 10000 });
  });

  test('overdue group shows task count badge', async ({ page }) => {
    await waitForMyTasksPage(page);

    // Wait for loading to finish
    const overdueHeader = page.locator('h2:has-text("Overdue")');
    await expect(overdueHeader).toBeVisible({ timeout: 20000 });

    // The Overdue group header has a count badge (even if 0)
    const countBadge = page.locator('span.rounded-full').first();
    await expect(countBadge).toBeVisible({ timeout: 10000 });
  });
});
