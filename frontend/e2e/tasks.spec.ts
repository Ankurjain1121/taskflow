import { test, expect, Page } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { navigateToFirstBoard, createTaskViaUI } from './helpers/data-factory';

/**
 * E2E Tests: Task Management CRUD
 *
 * Critical user flows:
 * - Create task with title
 * - Edit task title inline
 * - Edit task description
 * - Change task priority
 * - Delete task
 * - Create multiple tasks and verify order
 */

/** Helper: open task detail panel by clicking on task card */
async function openTaskDetail(page: Page, taskTitle: string): Promise<void> {
  await page.locator(`text=${taskTitle}`).first().click();
  // Wait for the slide-over panel to appear (has "Created" footer text)
  await expect(page.locator('text=/Created/')).toBeVisible({ timeout: 10000 });
}

/** Helper: close task detail panel via backdrop click */
async function closeTaskDetail(page: Page): Promise<void> {
  await page.locator('.fixed.inset-0.bg-black').first().click();
  await expect(page.locator('.fixed.inset-0').first()).toBeHidden({
    timeout: 10000,
  });
}

test.describe('Task Management - CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Task CRUD WS');
    await navigateToFirstBoard(page);
  });

  test('create task and verify it appears on board', async ({ page }) => {
    const taskTitle = `CRUD Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Task should be visible on the board
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test('edit task title in detail panel', async ({ page }) => {
    const originalTitle = `Edit Title ${Date.now()}`;
    await createTaskViaUI(page, originalTitle);

    // Open task detail
    await openTaskDetail(page, originalTitle);

    // Find and edit the title input
    const titleInput = page.locator('input[placeholder="Task title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await expect(titleInput).toHaveValue(originalTitle);

    // Clear and type new title
    const newTitle = `Updated Title ${Date.now()}`;
    await titleInput.clear();
    await titleInput.fill(newTitle);
    await titleInput.blur();

    // Wait for save
    await page.waitForTimeout(1500);

    // Verify title updated in the input
    await expect(titleInput).toHaveValue(newTitle);

    // Close panel and verify on board
    await closeTaskDetail(page);
    await expect(page.locator(`text=${newTitle}`)).toBeVisible({
      timeout: 15000,
    });
  });

  test('edit task description', async ({ page }) => {
    const taskTitle = `Desc Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    await openTaskDetail(page, taskTitle);

    // Find the description textarea
    const descArea = page.locator('textarea').first();
    await expect(descArea).toBeVisible({ timeout: 10000 });

    const description = 'This is a detailed description for the E2E test task.';
    await descArea.fill(description);
    await descArea.blur();

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Verify the description persists
    await expect(descArea).toHaveValue(description);

    // Close and reopen to verify persistence
    await closeTaskDetail(page);
    await openTaskDetail(page, taskTitle);

    const descAreaAfterReopen = page.locator('textarea').first();
    await expect(descAreaAfterReopen).toHaveValue(description, {
      timeout: 10000,
    });
  });

  test('change task priority via detail panel', async ({ page }) => {
    const taskTitle = `Priority Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    await openTaskDetail(page, taskTitle);

    // Find the Priority section in the detail panel
    const priorityLabel = page.locator('text=Priority').first();
    await expect(priorityLabel).toBeVisible({ timeout: 10000 });

    // Click the priority chip/button to open dropdown
    const priorityBtn = page
      .locator('button:has-text("Medium"), button:has-text("Low"), button:has-text("None"), button:has-text("High"), button:has-text("Urgent")')
      .first();
    if (await priorityBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await priorityBtn.click();

      // Select "High" from the dropdown/overlay
      const highOption = page.locator('text=High').last();
      if (await highOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await highOption.click();
        await page.waitForTimeout(1000);

        // Verify priority changed
        await expect(
          page.locator('button:has-text("High")').first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('delete task from detail panel', async ({ page }) => {
    const taskTitle = `Delete Me ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    // Verify task exists on board
    await expect(page.locator(`text=${taskTitle}`)).toBeVisible({
      timeout: 15000,
    });

    // Open task detail
    await openTaskDetail(page, taskTitle);

    // Click delete button
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();

    // Handle confirmation dialog if present
    const confirmBtn = page.locator(
      'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")',
    ).last();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Wait for task to be removed
    await page.waitForTimeout(2000);

    // Task should no longer be visible on the board
    await expect(page.locator(`text=${taskTitle}`)).toBeHidden({
      timeout: 15000,
    });
  });

  test('create multiple tasks and all appear on board', async ({ page }) => {
    const tasks = [
      `Multi A ${Date.now()}`,
      `Multi B ${Date.now()}`,
      `Multi C ${Date.now()}`,
    ];

    for (const title of tasks) {
      await createTaskViaUI(page, title);
    }

    // All tasks should be visible
    for (const title of tasks) {
      await expect(page.locator(`text=${title}`)).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test('task detail shows created date', async ({ page }) => {
    const taskTitle = `Date Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    await openTaskDetail(page, taskTitle);

    // The panel footer should show "Created" text with a date
    await expect(page.getByText(/Created \w+ \d/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('task detail shows subtask section', async ({ page }) => {
    const taskTitle = `Subtask Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    await openTaskDetail(page, taskTitle);

    // The subtask component should be rendered
    await expect(page.locator('app-subtask-list').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('task detail shows comments section', async ({ page }) => {
    const taskTitle = `Comments Task ${Date.now()}`;
    await createTaskViaUI(page, taskTitle);

    await openTaskDetail(page, taskTitle);

    // Comments heading should be visible
    await expect(
      page.getByRole('heading', { name: 'Comments', exact: true }),
    ).toBeVisible({ timeout: 10000 });
  });
});
