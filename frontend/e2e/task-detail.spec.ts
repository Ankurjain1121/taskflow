import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { navigateToFirstBoard, createTaskViaUI } from './helpers/data-factory';
import { TaskDetailPage } from './pages/TaskDetailPage';

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

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();
    await expect(detail.panel).toBeVisible({ timeout: 10000 });
  });

  test('task title is displayed in detail panel', async ({ page }) => {
    await createTaskViaUI(page, 'Title Display Task');
    await page.locator('text=Title Display Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // The title should be visible somewhere in the panel
    await expect(page.locator('text=Title Display Task')).toBeVisible({ timeout: 10000 });
  });

  test('task description section is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Description Section Task');
    await page.locator('text=Description Section Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // There should be a textarea or description area
    const descriptionArea = page.locator('textarea').first();
    await expect(descriptionArea).toBeVisible({ timeout: 10000 });
  });

  test('edit description and save', async ({ page }) => {
    await createTaskViaUI(page, 'Edit Description Task');
    await page.locator('text=Edit Description Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // Type in the description area
    const descriptionArea = page.locator('textarea').first();
    await expect(descriptionArea).toBeVisible({ timeout: 10000 });
    await descriptionArea.fill('This is a test description for the task.');

    // Blur to trigger save
    await descriptionArea.blur();
    await page.waitForTimeout(1000);

    // Verify the description persists
    await expect(descriptionArea).toHaveValue('This is a test description for the task.');
  });

  test('set priority on task', async ({ page }) => {
    await createTaskViaUI(page, 'Priority Test Task');
    await page.locator('text=Priority Test Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // Find and interact with priority selector
    const prioritySelect = page.locator('select, mat-select').first();
    await expect(prioritySelect).toBeVisible({ timeout: 10000 });

    // Try to set priority - handle both native select and mat-select
    if (await page.locator('select').first().isVisible()) {
      await page.locator('select').first().selectOption({ label: /high/i });
    } else {
      await prioritySelect.click();
      await page.locator('mat-option:has-text("High")').click();
    }

    await page.waitForTimeout(1000);
  });

  test('set due date on task', async ({ page }) => {
    await createTaskViaUI(page, 'Due Date Test Task');
    await page.locator('text=Due Date Test Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // Find the date input
    const dueDateInput = page.locator('input[type="date"]').first();
    await expect(dueDateInput).toBeVisible({ timeout: 10000 });

    // Set a due date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await dueDateInput.fill(dateStr);
    await dueDateInput.blur();
    await page.waitForTimeout(1000);

    await expect(dueDateInput).toHaveValue(dateStr);
  });

  test('add first comment on task', async ({ page }) => {
    await createTaskViaUI(page, 'Comment Test Task');
    await page.locator('text=Comment Test Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // Find comment input
    const commentInput = page.locator('textarea[placeholder*="comment"], input[placeholder*="comment"]').first();
    await expect(commentInput).toBeVisible({ timeout: 10000 });
    await commentInput.fill('This is the first comment');

    // Submit the comment (look for a send/submit button nearby)
    const submitBtn = page.locator('button:has-text("Add"), button:has-text("Send"), button:has-text("Comment"), button[type="submit"]').last();
    await submitBtn.click();
    await page.waitForTimeout(1500);
  });

  test('comment shows text after adding', async ({ page }) => {
    await createTaskViaUI(page, 'Comment Visible Task');
    await page.locator('text=Comment Visible Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    const commentInput = page.locator('textarea[placeholder*="comment"], input[placeholder*="comment"]').first();
    await expect(commentInput).toBeVisible({ timeout: 10000 });
    await commentInput.fill('Visible comment text here');

    const submitBtn = page.locator('button:has-text("Add"), button:has-text("Send"), button:has-text("Comment"), button[type="submit"]').last();
    await submitBtn.click();
    await page.waitForTimeout(1500);

    // The comment text should appear in the panel
    await expect(page.locator('text=Visible comment text here')).toBeVisible({ timeout: 10000 });
  });

  test('add second comment on task', async ({ page }) => {
    await createTaskViaUI(page, 'Multi Comment Task');
    await page.locator('text=Multi Comment Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    const commentInput = page.locator('textarea[placeholder*="comment"], input[placeholder*="comment"]').first();
    await expect(commentInput).toBeVisible({ timeout: 10000 });

    // Add first comment
    await commentInput.fill('First comment');
    await page.locator('button:has-text("Add"), button:has-text("Send"), button:has-text("Comment"), button[type="submit"]').last().click();
    await page.waitForTimeout(1500);

    // Add second comment
    await commentInput.fill('Second comment');
    await page.locator('button:has-text("Add"), button:has-text("Send"), button:has-text("Comment"), button[type="submit"]').last().click();
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Second comment')).toBeVisible({ timeout: 10000 });
  });

  test('add third comment on task', async ({ page }) => {
    await createTaskViaUI(page, 'Three Comments Task');
    await page.locator('text=Three Comments Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    const commentInput = page.locator('textarea[placeholder*="comment"], input[placeholder*="comment"]').first();
    await expect(commentInput).toBeVisible({ timeout: 10000 });

    for (const text of ['Comment one', 'Comment two', 'Comment three']) {
      await commentInput.fill(text);
      await page.locator('button:has-text("Add"), button:has-text("Send"), button:has-text("Comment"), button[type="submit"]').last().click();
      await page.waitForTimeout(1500);
    }

    await expect(page.locator('text=Comment three')).toBeVisible({ timeout: 10000 });
  });

  test('add first subtask', async ({ page }) => {
    await createTaskViaUI(page, 'Subtask Test Task');
    await page.locator('text=Subtask Test Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    const subtaskInput = page.locator('input[placeholder*="subtask"], input[placeholder*="Subtask"]').first();
    await expect(subtaskInput).toBeVisible({ timeout: 10000 });
    await subtaskInput.fill('First subtask item');
    await subtaskInput.press('Enter');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=First subtask item')).toBeVisible({ timeout: 10000 });
  });

  test('add second subtask', async ({ page }) => {
    await createTaskViaUI(page, 'Two Subtasks Task');
    await page.locator('text=Two Subtasks Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    const subtaskInput = page.locator('input[placeholder*="subtask"], input[placeholder*="Subtask"]').first();
    await expect(subtaskInput).toBeVisible({ timeout: 10000 });

    await subtaskInput.fill('Subtask A');
    await subtaskInput.press('Enter');
    await page.waitForTimeout(1000);

    await subtaskInput.fill('Subtask B');
    await subtaskInput.press('Enter');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Subtask B')).toBeVisible({ timeout: 10000 });
  });

  test('toggle subtask completion', async ({ page }) => {
    await createTaskViaUI(page, 'Toggle Subtask Task');
    await page.locator('text=Toggle Subtask Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    const subtaskInput = page.locator('input[placeholder*="subtask"], input[placeholder*="Subtask"]').first();
    await expect(subtaskInput).toBeVisible({ timeout: 10000 });
    await subtaskInput.fill('Toggleable subtask');
    await subtaskInput.press('Enter');
    await page.waitForTimeout(1000);

    // Find the checkbox for the subtask
    const checkbox = page.locator('input[type="checkbox"]').last();
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await checkbox.click();
    await page.waitForTimeout(1000);

    // Checkbox should now be checked
    await expect(checkbox).toBeChecked();
  });

  test('subtask section shows subtasks', async ({ page }) => {
    await createTaskViaUI(page, 'Subtask Section Task');
    await page.locator('text=Subtask Section Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // The subtask input should be visible, indicating the section exists
    const subtaskInput = page.locator('input[placeholder*="subtask"], input[placeholder*="Subtask"]').first();
    await expect(subtaskInput).toBeVisible({ timeout: 10000 });

    // Add a subtask to verify the section works
    await subtaskInput.fill('Section test subtask');
    await subtaskInput.press('Enter');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Section test subtask')).toBeVisible({ timeout: 10000 });
  });

  test('close task detail panel', async ({ page }) => {
    await createTaskViaUI(page, 'Close Panel Task');
    await page.locator('text=Close Panel Task').first().click();

    const detail = new TaskDetailPage(page);
    await detail.expectOpen();

    // Close the panel
    await detail.close();

    // The "Created" text that indicates the panel is open should no longer be visible
    await expect(page.locator('text=Created').first()).toBeHidden({ timeout: 10000 });
  });
});
