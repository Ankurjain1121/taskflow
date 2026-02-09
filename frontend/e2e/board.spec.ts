import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';

test.describe('Board Management', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up and onboard so we have a workspace with a sample board
    await signUpAndOnboard(page, 'Board Test WS');
  });

  test('can navigate to a board via workspace page', async ({ page }) => {
    // Dashboard should show workspace(s)
    await expect(page.locator('text=Your Workspaces')).toBeVisible({ timeout: 15000 });

    // Click "Open Workspace" to go to the workspace page
    const openLink = page.locator('a:has-text("Open Workspace")').first();
    await expect(openLink).toBeVisible({ timeout: 10000 });
    await openLink.click();

    // Verify we are on the workspace page
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    // Wait for workspace page to load (spinner gone, "Boards" heading visible)
    await expect(page.locator('h2:has-text("Boards")')).toBeVisible({ timeout: 15000 });

    // The sample board created during onboarding should appear as a link
    const boardCard = page.locator('a[href*="/board/"]').first();
    await expect(boardCard).toBeVisible({ timeout: 10000 });
    await boardCard.click();

    // Verify we are on a board page
    await expect(page).toHaveURL(/\/workspace\/.*\/board\//, { timeout: 15000 });

    // The board view should show a board name header (not "Loading...")
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('board view loads with board name', async ({ page }) => {
    // Navigate: Dashboard -> Workspace -> Board
    await expect(page.locator('text=Your Workspaces')).toBeVisible({ timeout: 15000 });
    await page.locator('a:has-text("Open Workspace")').first().click();
    await expect(page.locator('h2:has-text("Boards")')).toBeVisible({ timeout: 15000 });

    const boardCard = page.locator('a[href*="/board/"]').first();
    await expect(boardCard).toBeVisible({ timeout: 10000 });
    await boardCard.click();

    await expect(page).toHaveURL(/\/workspace\/.*\/board\//, { timeout: 15000 });

    // Wait for the board to fully load
    await page.waitForLoadState('networkidle');

    // The heading should contain the board name, not "Loading..."
    const boardHeading = page.locator('h1').first();
    await expect(boardHeading).toBeVisible({ timeout: 10000 });
    await expect(boardHeading).not.toHaveText('Loading...');
  });

  test('workspace page is accessible and shows boards heading', async ({ page }) => {
    // Click "Open Workspace" link
    await expect(page.locator('text=Your Workspaces')).toBeVisible({ timeout: 15000 });
    const openLink = page.locator('a:has-text("Open Workspace")').first();
    await expect(openLink).toBeVisible({ timeout: 10000 });
    await openLink.click();

    // Verify we navigated to a workspace page
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    // Verify the "Boards" section heading appears
    await expect(page.locator('h2:has-text("Boards")')).toBeVisible({ timeout: 15000 });
  });
});
