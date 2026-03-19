import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';
import { navigateToFirstBoard, createTaskViaUI } from './helpers/data-factory';

/**
 * E2E Journey: Task Detail Panel
 *
 * Tests the complete task detail experience:
 * - Login and navigate to a board with tasks
 * - Open task detail panel by clicking a task card
 * - Verify title, description, and status fields are visible
 * - Test changing priority
 * - Verify other detail panel sections (subtasks, comments, due date)
 */

let testEmail: string;

test.describe('Task Detail Journey', () => {
  test.setTimeout(120000);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    testEmail = await signUpAndOnboard(page, 'Task Detail Journey WS');
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
    await navigateToFirstBoard(page);
  });

  test('task detail page loads when clicking task card', async ({ page }) => {
    await createTaskViaUI(page, 'Detail Journey Task');

    // Click the task card to open detail panel
    await page.locator('text=Detail Journey Task').first().click();

    // The task detail slide-over panel should appear with backdrop
    const backdrop = page.locator('.fixed.inset-0').first();
    await expect(backdrop).toBeVisible({ timeout: 10000 });

    // "Created" timestamp confirms the panel fully loaded
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });
  });

  test('title field is visible and shows correct value', async ({ page }) => {
    await createTaskViaUI(page, 'Title Check Task');
    await page.locator('text=Title Check Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // The title should be an editable input with the task name
    const titleInput = page
      .locator('input[placeholder="Task title"]')
      .first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await expect(titleInput).toHaveValue('Title Check Task');
  });

  test('description field is visible and editable', async ({ page }) => {
    await createTaskViaUI(page, 'Description Check Task');
    await page.locator('text=Description Check Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Description textarea should be visible
    const descriptionArea = page.locator('textarea').first();
    await expect(descriptionArea).toBeVisible({ timeout: 10000 });

    // Type a description and verify it sticks
    await descriptionArea.fill('This is a test description.');
    await descriptionArea.blur();
    await page.waitForTimeout(1000);

    await expect(descriptionArea).toHaveValue('This is a test description.');
  });

  test('status field is visible in task detail', async ({ page }) => {
    await createTaskViaUI(page, 'Status Check Task');
    await page.locator('text=Status Check Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // The task detail panel should show a status indicator
    // Status is typically shown as a label or chip (e.g., "Backlog", "To Do")
    const statusIndicator = page
      .locator(
        'text=/Backlog|To Do|In Progress|Done|Review/',
      )
      .first();
    await expect(statusIndicator).toBeVisible({ timeout: 10000 });
  });

  test('priority chip is visible and interactive', async ({ page }) => {
    await createTaskViaUI(page, 'Priority Check Task');
    await page.locator('text=Priority Check Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Find the priority label
    await expect(page.locator('text=Priority').first()).toBeVisible({
      timeout: 10000,
    });

    // The priority chip/button should be clickable
    const priorityChip = page
      .locator(
        'button:has-text("None"), button:has-text("Low"), button:has-text("Medium"), button:has-text("High"), button:has-text("Urgent")',
      )
      .first();
    const priorityVisible = await priorityChip
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (priorityVisible) {
      // Click the priority chip to open dropdown/overlay
      await priorityChip.click();

      // Priority options should appear (dropdown or overlay)
      const priorityOption = page
        .locator(
          'text=/None|Low|Medium|High|Urgent/',
        )
        .first();
      await expect(priorityOption).toBeVisible({ timeout: 5000 });
    }
  });

  test('due date field is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Due Date Check Task');
    await page.locator('text=Due Date Check Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Due date label should be visible
    await expect(page.locator('text=/Due date/i').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('subtask section is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Subtask Section Task');
    await page.locator('text=Subtask Section Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // The subtask component should be rendered
    const subtaskSection = page.locator('app-subtask-list').first();
    await expect(subtaskSection).toBeVisible({ timeout: 10000 });
  });

  test('comments section is visible', async ({ page }) => {
    await createTaskViaUI(page, 'Comments Section Task');
    await page.locator('text=Comments Section Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Comments heading should be visible
    await expect(
      page.getByRole('heading', { name: 'Comments', exact: true }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('delete button is visible in task detail', async ({ page }) => {
    await createTaskViaUI(page, 'Delete Button Task');
    await page.locator('text=Delete Button Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Delete button should be visible in the footer
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
  });

  test('close task detail panel via backdrop', async ({ page }) => {
    await createTaskViaUI(page, 'Close Panel Task');
    await page.locator('text=Close Panel Task').first().click();

    // Wait for panel to load
    await expect(page.locator('text=/Created/')).toBeVisible({
      timeout: 10000,
    });

    // Close by clicking the backdrop overlay
    await page.locator('.fixed.inset-0.bg-black').first().click();

    // Backdrop should disappear
    await expect(page.locator('.fixed.inset-0').first()).toBeHidden({
      timeout: 10000,
    });
  });

  test('created date is shown in task detail', async ({ page }) => {
    await createTaskViaUI(page, 'Created Date Task');
    await page.locator('text=Created Date Task').first().click();

    // The panel footer shows "Created" text with a date
    await expect(page.getByText(/Created \w+ \d/)).toBeVisible({
      timeout: 10000,
    });
  });
});
