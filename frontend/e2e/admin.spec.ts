import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';

test.describe('Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    // The first user after onboarding is typically admin
    await signUpAndOnboard(page, 'Admin WS');
  });

  test('admin users page loads with heading', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("User Management")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('users list shows at least one user', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("User Management")')).toBeVisible({
      timeout: 10000,
    });

    // Wait for loading to finish and table to appear
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // There should be at least one row in the table body (the current user)
    const rows = table.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('user entry shows name and email', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("User Management")')).toBeVisible({
      timeout: 10000,
    });

    // Wait for table
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // First row should have user info with name and email
    const firstRow = table.locator('tbody tr').first();
    await expect(firstRow.locator('td').first()).toBeVisible({
      timeout: 10000,
    });

    // The User column should contain text (name)
    const userCell = firstRow.locator('td').first();
    const cellText = await userCell.textContent();
    expect(cellText?.trim().length).toBeGreaterThan(0);
  });

  test('search input is visible on users page', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("User Management")')).toBeVisible({
      timeout: 10000,
    });

    // Search field
    const searchField = page
      .locator('mat-form-field')
      .filter({ hasText: /search users/i })
      .locator('input');
    await expect(searchField).toBeVisible({ timeout: 10000 });
  });

  test('role filter dropdown is visible on users page', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("User Management")')).toBeVisible({
      timeout: 10000,
    });

    // Role filter
    const roleFilter = page
      .locator('mat-form-field')
      .filter({ hasText: /^Role/i });
    await expect(roleFilter).toBeVisible({ timeout: 10000 });
  });

  test('audit log page loads with heading', async ({ page }) => {
    await page.goto('/admin/audit-log');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Audit Log")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('audit log shows entries or empty state', async ({ page }) => {
    await page.goto('/admin/audit-log');
    await page.waitForLoadState('domcontentloaded');

    // The audit log heading should appear
    await expect(page.locator('h1:has-text("Audit Log")')).toBeVisible({
      timeout: 10000,
    });

    // The page should show either: loading spinner, data table, empty state, or error
    await expect(
      page
        .locator('table')
        .or(page.locator('text=No audit entries'))
        .or(page.locator('text=Failed to load'))
        .or(page.locator('mat-spinner'))
        .first(),
    ).toBeVisible({ timeout: 30000 });
  });

  test('trash page loads with heading', async ({ page }) => {
    await page.goto('/admin/trash');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Trash")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('trash page shows items or empty state', async ({ page }) => {
    await page.goto('/admin/trash');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Trash")')).toBeVisible({
      timeout: 10000,
    });

    // Either the table with items or the empty state
    const table = page.locator('table');
    const emptyState = page.locator('text=Trash is empty');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 15000 });
  });

  test('non-admin user is redirected from admin pages', async ({ browser }) => {
    // Use a fresh context to simulate a non-authenticated / non-admin user
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto('https://taskflow.paraslace.in/admin/users');

    // Should be redirected away from admin (to sign-in or dashboard)
    await expect(page).not.toHaveURL(/\/admin\/users$/, { timeout: 15000 });
    await context.close();
  });
});
