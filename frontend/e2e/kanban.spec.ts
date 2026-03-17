import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { navigateToFirstBoard, createTaskViaUI } from './helpers/data-factory';

/**
 * E2E Journey: Kanban Board Interactions
 *
 * Tests the complete kanban board experience:
 * - Login and navigate to an existing project/board
 * - Verify kanban columns are visible
 * - Add a task via the "New Task" button
 * - Verify the task card appears on the board
 * - Click task card and verify detail panel opens
 */

test.describe('Kanban Board Journey', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Kanban Journey WS');
    await navigateToFirstBoard(page);
  });

  test('kanban columns are visible on board', async ({ page }) => {
    // Default columns from onboarding should be visible
    const backlog = page.locator('h3:has-text("Backlog")').first();
    const todo = page.locator('h3:has-text("To Do")').first();
    const inProgress = page.locator('h3:has-text("In Progress")').first();
    const done = page.locator('h3:has-text("Done")').first();

    await expect(backlog).toBeVisible({ timeout: 15000 });
    await expect(todo).toBeVisible({ timeout: 10000 });
    await expect(inProgress).toBeVisible({ timeout: 10000 });
    await expect(done).toBeVisible({ timeout: 10000 });
  });

  test('kanban has correct number of column components', async ({ page }) => {
    const columns = page.locator('app-kanban-column');
    const count = await columns.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('click add task button and fill in task title', async ({ page }) => {
    // Click "New Task" button in toolbar
    await page.locator('button:has-text("New Task")').click();

    // Create New Task dialog should appear
    const dialogTitle = page.locator(
      '.p-dialog-title:has-text("Create New Task")',
    );
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Title input should be visible
    const titleInput = page.locator('input[placeholder="Enter task title"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Fill in the task title
    const taskTitle = `Journey Task ${Date.now()}`;
    await titleInput.click();
    await titleInput.fill(taskTitle);

    // Submit button should be enabled
    const submitBtn = page
      .locator(
        '.p-dialog-footer button:has-text("Create Task"), .p-dialog button:has-text("Create Task")',
      )
      .first();
    await expect(submitBtn).toBeEnabled({ timeout: 3000 });
    await submitBtn.click();

    // Dialog should close
    await expect(dialogTitle).toBeHidden({ timeout: 15000 });

    // Wait for task to appear on the board
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("New Task")').waitFor({
      timeout: 15000,
    });

    // Task card should appear in one of the columns
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test('create task and verify card appears on board', async ({ page }) => {
    const taskTitle = `Board Card ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Task card should be visible on the kanban board
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test('click task card opens detail panel', async ({ page }) => {
    const taskTitle = `Detail Panel ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Click the task card
    await page.locator(`text=${taskTitle}`).first().click();

    // Detail panel should slide in with backdrop overlay
    const backdrop = page.locator('.fixed.inset-0').first();
    await expect(backdrop).toBeVisible({ timeout: 10000 });

    // Task title should appear in the detail panel
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 10000,
    });

    // "Created" timestamp should be visible (confirms panel loaded)
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });
  });

  test('board toolbar shows New Task and search', async ({ page }) => {
    // New Task button
    await expect(page.locator('button:has-text("New Task")')).toBeVisible({
      timeout: 10000,
    });

    // Search input
    await expect(
      page.locator('input[placeholder="Search tasks..."]'),
    ).toBeVisible({ timeout: 10000 });
  });

  test('board heading displays board name', async ({ page }) => {
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    const text = await heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
    expect(text?.trim()).not.toBe('Loading...');
  });

  test('switch to list view and back to kanban', async ({ page }) => {
    // Switch to List view
    const listBtn = page.locator('button[title="List View"]');
    await expect(listBtn).toBeVisible({ timeout: 5000 });
    await listBtn.click();

    // List view component should appear
    await expect(page.locator('app-list-view')).toBeVisible({
      timeout: 10000,
    });

    // Switch back to Kanban
    const kanbanBtn = page.locator('button[title="Kanban View"]');
    await kanbanBtn.click();

    // Kanban columns should reappear
    await expect(
      page.locator('h3:has-text("Backlog")').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('task persists after page reload', async ({ page }) => {
    const taskTitle = `Persist Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Verify task is visible
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 15000,
    });

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("New Task")').waitFor({
      timeout: 15000,
    });

    // Task should still be visible after reload
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 15000,
    });
  });
});
