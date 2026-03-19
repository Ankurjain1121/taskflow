import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';

let testEmail: string;

test.describe('Eisenhower Matrix', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    const page = await browser.newPage();
    testEmail = await signUpAndOnboard(page, 'Eisenhower WS');
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
  });

  test('page loads successfully', async ({ page }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    // The page heading should be visible
    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });
  });

  test('page has quadrant labels', async ({ page }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });

    // Check for the four quadrant titles
    await expect(page.locator('h2:has-text("Do First")')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('h2:has-text("Schedule")')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('h2:has-text("Delegate")')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('h2:has-text("Eliminate")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('empty quadrants show when no tasks', async ({ page }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });

    // With a fresh workspace, quadrants should show "No tasks in this quadrant"
    const emptyMessages = page.locator('text=No tasks in this quadrant');
    await expect(emptyMessages.first()).toBeVisible({ timeout: 10000 });
    const count = await emptyMessages.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('quadrant subtitles describe urgency/importance', async ({ page }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });

    // Each quadrant has a subtitle with urgency/importance description (use exact text to avoid substring matches)
    await expect(page.locator('text="Urgent & Important"')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text="Not Urgent & Important"')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text="Urgent & Not Important"')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text="Not Urgent & Not Important"')).toBeVisible(
      { timeout: 10000 },
    );
  });

  test('page heading is correct', async ({ page }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1:has-text("Eisenhower Matrix")');
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(heading).toHaveText('Eisenhower Matrix');
  });

  test('page accessible from my-tasks Matrix View link', async ({ page }) => {
    // Go to my-tasks first
    await page.goto('/my-tasks');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the page to fully render (summary or view toggle)
    await expect(page.locator('text=My Tasks').first()).toBeVisible({
      timeout: 15000,
    });

    // Click Matrix View link (it's an anchor with routerLink="/eisenhower")
    const matrixLink = page.locator('a[href="/eisenhower"]');
    await expect(matrixLink).toBeVisible({ timeout: 10000 });
    await matrixLink.click();

    await expect(page).toHaveURL(/\/eisenhower/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });
  });

  test('loading state shows then resolves', async ({ page }) => {
    await page.goto('/eisenhower');

    // The page should eventually load and show the heading (loading resolves)
    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });

    // After loading, the quadrant grid should be visible
    await expect(page.locator('h2:has-text("Do First")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('matrix grid layout renders with 4 sections', async ({ page }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });

    // The grid should have 4 quadrant sections (each with an h2)
    const quadrantHeadings = page.locator('h2');
    const count = await quadrantHeadings.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('page handles fresh workspace with no prioritized tasks', async ({
    page,
  }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    // Page should load without errors
    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });

    // No error messages
    await expect(page.locator('text=Failed to load')).toBeHidden({
      timeout: 5000,
    });
  });

  test('quadrant sections have distinct visual styling', async ({ page }) => {
    await page.goto('/eisenhower');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1:has-text("Eisenhower Matrix")')).toBeVisible({
      timeout: 15000,
    });

    // Each quadrant has a distinct border color class (use div to avoid matching the Auto-Sort button)
    await expect(page.locator('div.border-red-300')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('div.border-yellow-300')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('div.border-orange-300')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('div.border-gray-300')).toBeVisible({
      timeout: 10000,
    });
  });
});
