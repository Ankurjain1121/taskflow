import { test, expect, Page } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { navigateToFirstBoard, createTaskViaUI } from './helpers/data-factory';

/**
 * E2E Tests: Kanban Board Interactions
 *
 * Critical user flows:
 * - View board with columns and tasks
 * - Create task from quick-add button
 * - Switch between view modes (Kanban, List)
 * - Column headers and structure
 * - Board toolbar interactions
 * - Card density toggle
 */

test.describe('Kanban Board - View & Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Kanban WS');
    await navigateToFirstBoard(page);
  });

  test('board loads with default columns', async ({ page }) => {
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

  test('kanban columns contain app-kanban-column components', async ({
    page,
  }) => {
    const columns = page.locator('app-kanban-column');
    const count = await columns.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('create task via New Task button and verify in column', async ({
    page,
  }) => {
    const taskTitle = `Kanban Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Task card should appear in one of the columns
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 15000,
    });
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

  test('list view shows tasks in tabular format', async ({ page }) => {
    // Create a task first
    const taskTitle = `List View Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Switch to list view
    await page.locator('button[title="List View"]').click();
    await expect(page.locator('app-list-view')).toBeVisible({
      timeout: 10000,
    });

    // Task should be visible in list view
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 10000,
    });
  });

  test('clicking task card opens detail panel', async ({ page }) => {
    const taskTitle = `Detail Click ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Click the task card
    await page.locator(`text=${taskTitle}`).first().click();

    // Detail panel should slide in (has backdrop overlay)
    const backdrop = page.locator('.fixed.inset-0').first();
    await expect(backdrop).toBeVisible({ timeout: 10000 });

    // Task title should appear in the detail panel
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

  test('board URL contains workspace and board IDs', async ({ page }) => {
    await expect(page).toHaveURL(
      /\/workspace\/[a-f0-9-]+\/board\/[a-f0-9-]+/,
    );
  });

  test('create task dialog has title input and submit button', async ({
    page,
  }) => {
    await page.locator('button:has-text("New Task")').click();

    const dialog = page.locator('.p-dialog-title:has-text("Create New Task")');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Title input
    const titleInput = page.locator('input[placeholder="Enter task title"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });

    // Submit button
    const submitBtn = page
      .locator(
        '.p-dialog-footer button:has-text("Create Task"), .p-dialog button:has-text("Create Task")',
      )
      .first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });

    // Close dialog
    await page.keyboard.press('Escape');
  });

  test('create task dialog has Use Template toggle', async ({ page }) => {
    await page.locator('button:has-text("New Task")').click();

    await page
      .locator('input[placeholder="Enter task title"]')
      .waitFor({ timeout: 5000 });

    // Use Template toggle should be visible
    await expect(page.locator('text=Use Template')).toBeVisible({
      timeout: 5000,
    });

    await page.keyboard.press('Escape');
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
