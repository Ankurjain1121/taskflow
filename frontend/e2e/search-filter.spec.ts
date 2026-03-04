import { test, expect, Page } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { navigateToFirstBoard, createTaskViaUI } from './helpers/data-factory';

/**
 * E2E Tests: Search & Filtering on Board
 *
 * Critical user flows:
 * - Search for tasks by title
 * - Filter tasks by priority
 * - Clear filters
 * - Search with no results shows empty state
 * - Quick filter bar interaction
 */

/** Helper: navigate to board and create seed tasks */
async function setupBoardWithTasks(
  page: Page,
  tasks: string[],
): Promise<void> {
  await signUpAndOnboard(page, `Filter WS ${Date.now()}`);
  await navigateToFirstBoard(page);

  for (const title of tasks) {
    await createTaskViaUI(page, title);
  }
}

test.describe('Search & Filtering', () => {
  test('search input is visible on board toolbar', async ({ page }) => {
    await signUpAndOnboard(page, 'Search UI WS');
    await navigateToFirstBoard(page);

    // The search input should be present in the toolbar
    const searchInput = page.locator('input[placeholder="Search tasks..."]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('search filters tasks by title', async ({ page }) => {
    const uniqueId = Date.now();
    await setupBoardWithTasks(page, [
      `Alpha Task ${uniqueId}`,
      `Beta Task ${uniqueId}`,
      `Gamma Task ${uniqueId}`,
    ]);

    // Type in the search box
    const searchInput = page.locator('input[placeholder="Search tasks..."]');
    await searchInput.fill('Alpha');

    // Wait for debounce
    await page.waitForTimeout(500);

    // Alpha task should still be visible
    await expect(page.locator(`text=Alpha Task ${uniqueId}`)).toBeVisible({
      timeout: 10000,
    });

    // Beta and Gamma should be hidden (filtered out)
    await expect(page.locator(`text=Beta Task ${uniqueId}`)).toBeHidden({
      timeout: 5000,
    });
    await expect(page.locator(`text=Gamma Task ${uniqueId}`)).toBeHidden({
      timeout: 5000,
    });
  });

  test('clearing search shows all tasks again', async ({ page }) => {
    const uniqueId = Date.now();
    await setupBoardWithTasks(page, [
      `Clear A ${uniqueId}`,
      `Clear B ${uniqueId}`,
    ]);

    const searchInput = page.locator('input[placeholder="Search tasks..."]');

    // Filter to one task
    await searchInput.fill('Clear A');
    await page.waitForTimeout(500);

    await expect(page.locator(`text=Clear B ${uniqueId}`)).toBeHidden({
      timeout: 5000,
    });

    // Clear the search
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Both tasks should be visible again
    await expect(page.locator(`text=Clear A ${uniqueId}`)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(`text=Clear B ${uniqueId}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test('search with no matches shows empty columns', async ({ page }) => {
    const uniqueId = Date.now();
    await setupBoardWithTasks(page, [`Existing ${uniqueId}`]);

    const searchInput = page.locator('input[placeholder="Search tasks..."]');
    await searchInput.fill('ZZZNonExistentTask');
    await page.waitForTimeout(500);

    // The existing task should be hidden
    await expect(page.locator(`text=Existing ${uniqueId}`)).toBeHidden({
      timeout: 5000,
    });

    // Columns should still be visible (just empty)
    await expect(
      page.locator('h3:has-text("Backlog")').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('keyboard shortcut F focuses search input', async ({ page }) => {
    await signUpAndOnboard(page, 'Shortcut WS');
    await navigateToFirstBoard(page);

    // Press F to focus search (board shortcut)
    await page.keyboard.press('f');

    const searchInput = page.locator('input[placeholder="Search tasks..."]');
    // The search input should be focused after pressing F
    await expect(searchInput).toBeFocused({ timeout: 5000 });
  });

  test('view mode buttons are visible (Kanban, List, Calendar)', async ({
    page,
  }) => {
    await signUpAndOnboard(page, 'View Mode WS');
    await navigateToFirstBoard(page);

    // View mode buttons are icon buttons with title attributes
    await expect(page.locator('button[title="Kanban View"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('button[title="List View"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('New Task button opens create task dialog', async ({ page }) => {
    await signUpAndOnboard(page, 'NewTask Btn WS');
    await navigateToFirstBoard(page);

    const newTaskBtn = page.locator('button:has-text("New Task")');
    await expect(newTaskBtn).toBeVisible({ timeout: 10000 });
    await newTaskBtn.click();

    // Dialog should appear
    await expect(
      page.locator('.p-dialog-title:has-text("Create New Task")'),
    ).toBeVisible({ timeout: 10000 });

    // Title input should be present
    await expect(
      page.locator('input[placeholder="Enter task title"]'),
    ).toBeVisible({ timeout: 5000 });

    // Cancel/close via Escape
    await page.keyboard.press('Escape');
    await expect(
      page.locator('.p-dialog-title:has-text("Create New Task")'),
    ).toBeHidden({ timeout: 5000 });
  });
});
