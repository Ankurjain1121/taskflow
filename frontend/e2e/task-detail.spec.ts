import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { navigateToFirstBoard, createTaskViaUI } from './helpers/data-factory';

test.describe('Task Detail', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Task Detail WS');
    // Navigate to the board so we can create and interact with tasks
    await navigateToFirstBoard(page);
  });

  test('task detail panel opens when clicking task card', async ({ page }) => {
    await createTaskViaUI(page, 'Detail Panel Test Task');

    // Click the task card to open detail panel
    await page.locator('text=Detail Panel Test Task').first().click();

    // The task detail slide-over panel should appear with the backdrop
    const backdrop = page.locator('.fixed.inset-0').first();
    await expect(backdrop).toBeVisible({ timeout: 10000 });

    // The task title should still be visible in the panel
    await expect(page.locator('text=Detail Panel Test Task')).toBeVisible({
      timeout: 10000,
    });
  });

  test('task title is displayed in detail panel', async ({ page }) => {
    await createTaskViaUI(page, 'Title Display Task');
    await page.locator('text=Title Display Task').first().click();

    // Wait for panel to load - look for "Created" text in panel footer
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // The title should be visible in the panel input
    await expect(page.locator('text=Title Display Task')).toBeVisible({
      timeout: 10000,
    });
  });

  test('task description section is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Description Section Task');
    await page.locator('text=Description Section Task').first().click();

    // Wait for panel
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // There should be a textarea for description
    const descriptionArea = page.locator('textarea').first();
    await expect(descriptionArea).toBeVisible({ timeout: 10000 });
  });

  test('edit description and save', async ({ page }) => {
    await createTaskViaUI(page, 'Edit Description Task');
    await page.locator('text=Edit Description Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Type in the description area
    const descriptionArea = page.locator('textarea').first();
    await expect(descriptionArea).toBeVisible({ timeout: 10000 });
    await descriptionArea.fill('This is a test description for the task.');

    // Blur to trigger save
    await descriptionArea.blur();
    await page.waitForTimeout(1000);

    // Verify the description persists
    await expect(descriptionArea).toHaveValue(
      'This is a test description for the task.',
    );
  });

  test('priority chip is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Priority Test Task');
    await page.locator('text=Priority Test Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Find the priority label and chip button
    await expect(page.locator('text=Priority').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('due date chip is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Due Date Test Task');
    await page.locator('text=Due Date Test Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Find the due date label and button (shows "Set date" or the date)
    await expect(page.locator('text=/Due date/i').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('subtask section is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Subtask Section Task');
    await page.locator('text=Subtask Section Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // The subtask component should be rendered
    const subtaskSection = page.locator('app-subtask-list').first();
    await expect(subtaskSection).toBeVisible({ timeout: 10000 });
  });

  test('comments section shows placeholder', async ({ page }) => {
    await createTaskViaUI(page, 'Comments Placeholder Task');
    await page.locator('text=Comments Placeholder Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Comments section heading should be visible in the panel
    await expect(
      page.getByRole('heading', { name: 'Comments', exact: true }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('delete button is visible in task detail', async ({ page }) => {
    await createTaskViaUI(page, 'Delete Button Task');
    await page.locator('text=Delete Button Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Delete button is in the footer with text "Delete"
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
  });

  test('created date is shown in task detail', async ({ page }) => {
    await createTaskViaUI(page, 'Created Date Task');
    await page.locator('text=Created Date Task').first().click();

    // The panel footer shows "Created" text with date
    await expect(page.getByText(/Created \w+ \d/)).toBeVisible({
      timeout: 10000,
    });
  });

  test('close task detail panel', async ({ page }) => {
    await createTaskViaUI(page, 'Close Panel Task');
    await page.locator('text=Close Panel Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Close the panel by clicking the backdrop overlay
    await page.locator('.fixed.inset-0.bg-black').first().click();

    // The backdrop should disappear
    await expect(page.locator('.fixed.inset-0').first()).toBeHidden({
      timeout: 10000,
    });
  });

  test('title input is editable', async ({ page }) => {
    await createTaskViaUI(page, 'Editable Title Task');
    await page.locator('text=Editable Title Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // The title should be an editable input with placeholder "Task title"
    const titleInput = page.locator('input[placeholder="Task title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await expect(titleInput).toHaveValue('Editable Title Task');
  });

  test('can create and view multiple tasks', async ({ page }) => {
    await createTaskViaUI(page, 'Multi Task A');
    await createTaskViaUI(page, 'Multi Task B');

    // Both tasks should be visible on the board
    await expect(page.locator('text=Multi Task A')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text=Multi Task B')).toBeVisible({
      timeout: 10000,
    });
  });

  test('task detail panel shows backdrop', async ({ page }) => {
    await createTaskViaUI(page, 'Backdrop Test Task');
    await page.locator('text=Backdrop Test Task').first().click();

    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // The backdrop overlay should be present (.fixed.inset-0 with bg-black/40)
    const backdrop = page.locator('.fixed.inset-0').first();
    await expect(backdrop).toBeVisible({ timeout: 10000 });
  });
});
