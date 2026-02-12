import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';

test.describe('Cross-Cutting Features', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Cross-Cut WS');
  });

  test('sidebar shows Home nav item', async ({ page }) => {
    const homeLink = page.locator('a[routerLink="/dashboard"]', { hasText: 'Home' });
    await expect(homeLink).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows My Work nav item', async ({ page }) => {
    const myWorkLink = page.locator('a[routerLink="/my-tasks"]', { hasText: 'My Work' });
    await expect(myWorkLink).toBeVisible({ timeout: 10000 });
  });

  test('sidebar shows workspace section with workspace name', async ({ page }) => {
    // The workspace section header
    const workspacesHeader = page.locator('text=Workspaces');
    await expect(workspacesHeader).toBeVisible({ timeout: 10000 });

    // The workspace created during onboarding should be listed
    const workspaceLink = page.locator('.workspace-item').first();
    await expect(workspaceLink).toBeVisible({ timeout: 10000 });
  });

  test('sidebar Favorites link navigates to /favorites', async ({ page }) => {
    const favoritesLink = page.locator('a[routerLink="/favorites"]', { hasText: 'Favorites' });
    await expect(favoritesLink).toBeVisible({ timeout: 10000 });

    await favoritesLink.click();
    await expect(page).toHaveURL(/\/favorites/, { timeout: 15000 });
  });

  test('sidebar Archive link navigates to /archive', async ({ page }) => {
    const archiveLink = page.locator('a[routerLink="/archive"]', { hasText: 'Archive' });
    await expect(archiveLink).toBeVisible({ timeout: 10000 });

    await archiveLink.click();
    await expect(page).toHaveURL(/\/archive/, { timeout: 15000 });
  });

  test('sidebar Team link navigates to /team', async ({ page }) => {
    const teamLink = page.locator('a[routerLink="/team"]', { hasText: 'Team' });
    await expect(teamLink).toBeVisible({ timeout: 10000 });

    await teamLink.click();
    await expect(page).toHaveURL(/\/team/, { timeout: 15000 });
  });

  test('sidebar Help link navigates to /help', async ({ page }) => {
    const helpLink = page.locator('a[routerLink="/help"]', { hasText: 'Help' });
    await expect(helpLink).toBeVisible({ timeout: 10000 });

    await helpLink.click();
    await expect(page).toHaveURL(/\/help/, { timeout: 15000 });
  });

  test('global search opens with Ctrl+K', async ({ page }) => {
    // Trigger global search shortcut
    await page.keyboard.press('Control+k');

    // A search dialog, overlay, or input should appear
    const searchOverlay = page.locator('[role="dialog"], .cdk-overlay-container, mat-dialog-container').first();
    await expect(searchOverlay).toBeVisible({ timeout: 10000 });
  });

  test('sign out from sidebar removes session and redirects to sign-in', async ({ page }) => {
    // The sign out button is in the user section at the bottom of the sidebar
    const signOutButton = page.locator('button[title="Sign out"]');
    await expect(signOutButton).toBeVisible({ timeout: 10000 });

    await signOutButton.click();

    // Should redirect to sign-in page
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
  });

  test('after sign out, visiting dashboard redirects to sign-in', async ({ page }) => {
    // Sign out first
    const signOutButton = page.locator('button[title="Sign out"]');
    await expect(signOutButton).toBeVisible({ timeout: 10000 });
    await signOutButton.click();

    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });

    // Try to navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
  });

  test('unknown route redirects to dashboard or shows not-found', async ({ page }) => {
    await page.goto('/unknown-xyz-test-route');

    // Should either redirect to dashboard or show a 404 page
    // Wait for navigation to settle
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const isDashboard = /\/dashboard/.test(url);
    const isNotFound = await page.locator('text=/not found|404|page not found/i').isVisible().catch(() => false);

    expect(isDashboard || isNotFound).toBeTruthy();
  });

  test('browser back button works across page navigations', async ({ page }) => {
    // Navigate to My Tasks
    const myWorkLink = page.locator('a[routerLink="/my-tasks"]', { hasText: 'My Work' });
    await myWorkLink.click();
    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });

    // Navigate to Favorites
    const favoritesLink = page.locator('a[routerLink="/favorites"]', { hasText: 'Favorites' });
    await favoritesLink.click();
    await expect(page).toHaveURL(/\/favorites/, { timeout: 15000 });

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });
  });
});
