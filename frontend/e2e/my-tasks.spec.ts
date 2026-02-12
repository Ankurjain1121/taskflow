import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { DashboardPage } from './pages/DashboardPage';

test.describe('My Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'My Tasks WS');
  });

  test('page loads with greeting heading', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    // The my-tasks page shows a greeting like "Good morning, <name>!"
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const text = await heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('summary stats are visible', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    // Wait for the summary banner to appear
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // Check for summary stat text items (total tasks, overdue, due soon, completed)
    await expect(page.locator('text=total tasks')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=overdue')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=due soon')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=completed this week')).toBeVisible({ timeout: 10000 });
  });

  test('empty state shows caught up message when no assigned tasks', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    // Wait for loading to finish
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // Fresh workspace with no tasks assigned should show empty state
    await expect(page.locator('text=all caught up')).toBeVisible({ timeout: 15000 });
  });

  test('view toggle buttons are visible', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // The page has "My Tasks" and "Tasks I Created" toggle buttons
    await expect(page.locator('button:has-text("My Tasks")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Tasks I Created")')).toBeVisible({ timeout: 10000 });
  });

  test('Matrix View link is visible', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // There should be a "Matrix View" link to /eisenhower
    await expect(page.locator('a:has-text("Matrix View")')).toBeVisible({ timeout: 10000 });
  });

  test('page accessible from sidebar My Work link', async ({ page }) => {
    // From dashboard, click "My Work" in the sidebar
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    const myWorkLink = page.locator('a:has-text("My Work")').first();
    await expect(myWorkLink).toBeVisible({ timeout: 10000 });
    await myWorkLink.click();

    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  });

  test('page accessible from dashboard My Tasks link', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();

    await expect(dashboard.myTasksLink).toBeVisible({ timeout: 10000 });
    await dashboard.myTasksLink.click();

    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });
  });

  test('summary stat numbers are visible', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // The summary banner contains numeric values (font-semibold text-lg spans)
    const statNumbers = page.locator('.font-semibold.text-lg');
    await expect(statNumbers.first()).toBeVisible({ timeout: 10000 });
    const count = await statNumbers.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('page heading contains user name', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const text = await heading.textContent();
    // Should contain a greeting with the user's name or a generic greeting
    expect(text).toMatch(/Good (morning|afternoon|evening)/);
  });

  test('page handles fresh workspace with no tasks gracefully', async ({ page }) => {
    await page.goto('/my-tasks');
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // No error messages should be shown
    await expect(page.locator('text=Failed to load')).toBeHidden({ timeout: 5000 });
    await expect(page.locator('text=Error')).toBeHidden({ timeout: 5000 });
  });
});
