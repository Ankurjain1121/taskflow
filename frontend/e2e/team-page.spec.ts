import { test, expect } from '@playwright/test';
import { signUpAndOnboard, TEST_NAME } from './helpers/auth';

test.describe('Team Page', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Team Page WS');
  });

  test('page loads with Team heading', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('workspace section shows workspace name', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // Should show the workspace name as a section heading
    await expect(page.locator('h2:has-text("Team Page WS")')).toBeVisible({
      timeout: 15000,
    });
  });

  test('member card shows current user', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // The current user should appear as a member card with their display name
    await expect(page.locator(`text=${TEST_NAME}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test('member card shows display name', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // Member card should show the full name
    const memberCard = page.locator('p').filter({ hasText: TEST_NAME }).first();
    await expect(memberCard).toBeVisible({ timeout: 15000 });
  });

  test('stats section shows Active, Overdue, Done counts or empty state', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // Either stats labels are visible (when members exist) or empty/no-members state shows
    const statsVisible = page.locator('text=Active').first();
    const emptyState = page.locator('text=No team data');
    const noMembers = page.locator('text=No members');

    await expect(statsVisible.or(emptyState).or(noMembers)).toBeVisible({
      timeout: 15000,
    });
  });

  test('"View details" link is visible', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    const viewDetailsLink = page.locator('a:has-text("View details")').first();
    await expect(viewDetailsLink).toBeVisible({ timeout: 15000 });
  });

  test('"View details" navigates to workspace team page', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    const viewDetailsLink = page.locator('a:has-text("View details")').first();
    await expect(viewDetailsLink).toBeVisible({ timeout: 15000 });
    await viewDetailsLink.click();

    // Should navigate to /workspace/:id/team
    await expect(page).toHaveURL(/\/workspace\/[a-f0-9-]+\/team/, {
      timeout: 15000,
    });
  });

  test('page handles single-member team correctly', async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // With onboarding, there should be exactly one workspace with one member
    const memberCards = page.locator('p').filter({ hasText: TEST_NAME });
    const count = await memberCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('loading state resolves to content', async ({ page }) => {
    await page.goto('/team');

    // The heading should eventually appear (loading resolved)
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // Either workspace data or empty state should appear
    const hasWorkspaces = await page
      .locator('h2')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .locator('text=No team data')
      .isVisible()
      .catch(() => false);
    expect(hasWorkspaces || hasEmptyState).toBeTruthy();
  });

  test('page is accessible from sidebar navigation', async ({ page }) => {
    // From the dashboard, click the Team link in the sidebar
    const teamLink = page.locator('a[href="/team"]:has-text("Team")');
    await expect(teamLink).toBeVisible({ timeout: 10000 });
    await teamLink.click();

    await expect(page).toHaveURL(/\/team/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });
  });
});
