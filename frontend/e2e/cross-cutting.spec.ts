import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';

test.describe('Cross-Cutting Features', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    testEmail = await signUpAndOnboard(page, 'Cross-Cut WS');
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
  });

  test('sidebar shows Home nav item', async ({ page }) => {
    const homeLink = page.locator('a[href="/dashboard"]').first();
    await expect(homeLink).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows My Work nav item', async ({ page }) => {
    const myWorkLink = page.locator('a[href="/my-tasks"]').first();
    await expect(myWorkLink).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows workspace section', async ({ page }) => {
    // The sidebar should show projects - look for a project link in the sidebar
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
  });

  test('sidebar Favorites link navigates to /favorites', async ({ page }) => {
    const favoritesLink = page.locator('a[href="/favorites"]').first();
    await expect(favoritesLink).toBeVisible({ timeout: 10000 });

    await favoritesLink.click();
    await expect(page).toHaveURL(/\/favorites/, { timeout: 15000 });
  });

  test('sidebar Archive link navigates to /archive', async ({ page }) => {
    const archiveLink = page.locator('a[href="/archive"]').first();
    await expect(archiveLink).toBeVisible({ timeout: 10000 });

    await archiveLink.click();
    await expect(page).toHaveURL(/\/archive/, { timeout: 15000 });
  });

  test('sidebar Team link navigates to /team', async ({ page }) => {
    const teamLink = page.locator('a[href="/team"]').first();
    await expect(teamLink).toBeVisible({ timeout: 10000 });

    await teamLink.click();
    await expect(page).toHaveURL(/\/team/, { timeout: 15000 });
  });

  test('sidebar Help link navigates to /help', async ({ page }) => {
    const helpLink = page.locator('a[href="/help"]').first();
    await expect(helpLink).toBeVisible({ timeout: 10000 });

    await helpLink.click();
    await expect(page).toHaveURL(/\/help/, { timeout: 15000 });
  });

  test('sign out from sidebar removes session and redirects to sign-in', async ({
    page,
  }) => {
    // Open profile popup first, then click Sign Out
    await page.locator('app-sidebar-footer button .pi-chevron-up').first().click();
    const signOutButton = page.locator('button:has-text("Sign Out")');
    await expect(signOutButton).toBeVisible({ timeout: 10000 });

    await signOutButton.click();

    // Should redirect to sign-in page
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
  });

  test('after sign out, visiting dashboard redirects to sign-in', async ({
    page,
  }) => {
    // Sign out first
    await page.locator('app-sidebar-footer button .pi-chevron-up').first().click();
    const signOutButton = page.locator('button:has-text("Sign Out")');
    await expect(signOutButton).toBeVisible({ timeout: 10000 });
    await signOutButton.click();

    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });

    // Try to navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
  });

  test('unknown route redirects to dashboard or shows not-found', async ({
    page,
  }) => {
    await page.goto('/unknown-xyz-test-route');

    // The wildcard route redirects to /dashboard - wait for Angular router
    await page.waitForLoadState('domcontentloaded');

    // Wait for the redirect to complete (Angular router handles ** -> /dashboard)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test('browser back button works across page navigations', async ({
    page,
  }) => {
    // Navigate to My Tasks
    const myWorkLink = page.locator('a[href="/my-tasks"]').first();
    await myWorkLink.click();
    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });

    // Navigate to Favorites
    const favoritesLink = page.locator('a[href="/favorites"]').first();
    await favoritesLink.click();
    await expect(page).toHaveURL(/\/favorites/, { timeout: 15000 });

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });
  });

  test('sidebar Settings link navigates to /settings/profile', async ({
    page,
  }) => {
    const settingsLink = page.locator('a[href="/settings/profile"]').first();
    await expect(settingsLink).toBeVisible({ timeout: 10000 });

    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings\/profile/, { timeout: 15000 });
  });
});
