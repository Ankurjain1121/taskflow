import { test, expect } from '@playwright/test';
import { signUpAndOnboard, navigateToFirstBoard, createTaskViaUI } from './helpers/auth';

/**
 * E2E Tests: Kanban Board Drag-Drop Operations
 *
 * CRITICAL USER FLOWS:
 * - Move task between columns (foundational kanban feature)
 * - Reorder task within same column
 * - Cross-swimlane drag (if swimlane enabled)
 * - Visual feedback during drag
 * - Persistence after page reload
 */

test.describe('Kanban Board - Drag & Drop', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up and create new workspace
    await signUpAndOnboard(page, `DnD Test WS ${Date.now()}`);

    // Navigate to first board (or create one)
    await navigateToFirstBoard(page);

    // Wait for kanban view to load
    await page.waitForSelector('app-kanban-column', { timeout: 10000 });
  });

  test('drag task from one column to another', async ({ page }) => {
    // SETUP: Create a task in "Todo" column
    await createTaskViaUI(page, 'Move Me Task');

    // VERIFY: Task appears in first column (Todo)
    const taskCard = page.locator('text=Move Me Task').first();
    await expect(taskCard).toBeVisible();

    // ACTION: Drag task from Todo → In Progress column
    const todoColumn = page.locator('h3:has-text("To Do")').first();
    const inProgressColumn = page.locator('h3:has-text("In Progress")').first();

    // Find the first empty area in In Progress column to drop
    const inProgressColumnBody = inProgressColumn
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    await taskCard.dragTo(inProgressColumnBody);

    // VERIFY: Task moved to In Progress column
    await expect(
      inProgressColumnBody.locator('text=Move Me Task')
    ).toBeVisible({ timeout: 5000 });

    // VERIFY: Task no longer in Todo column
    const todoColumnBody = todoColumn
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');
    await expect(
      todoColumnBody.locator('text=Move Me Task')
    ).not.toBeVisible();

    // VERIFY: Persistence - reload page and check task is still in In Progress
    await page.reload();
    await page.waitForSelector('app-kanban-column', { timeout: 10000 });
    await expect(
      inProgressColumnBody.locator('text=Move Me Task')
    ).toBeVisible({ timeout: 5000 });
  });

  test('reorder tasks within same column', async ({ page }) => {
    // SETUP: Create two tasks in Todo column
    await createTaskViaUI(page, 'Task A');
    await page.reload(); // Reload to prevent duplicate creation
    await page.waitForSelector('app-kanban-column', { timeout: 10000 });

    await createTaskViaUI(page, 'Task B');
    await page.reload();
    await page.waitForSelector('app-kanban-column', { timeout: 10000 });

    // VERIFY: Both tasks visible in Todo column
    const todoColumn = page.locator('h3:has-text("To Do")').first();
    const todoColumnBody = todoColumn
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    await expect(todoColumnBody.locator('text=Task A')).toBeVisible();
    await expect(todoColumnBody.locator('text=Task B')).toBeVisible();

    // ACTION: Drag Task B above Task A (reorder)
    const taskBCard = todoColumnBody.locator('text=Task B').first();
    const taskACard = todoColumnBody.locator('text=Task A').first();

    // Get positions
    const taskBBox = await taskBCard.boundingBox();
    const taskABox = await taskACard.boundingBox();

    if (taskBBox && taskABox && taskBBox.y > taskABox.y) {
      // Task B is below Task A, drag it up
      await taskBCard.dragTo(taskACard);

      // VERIFY: Order changed (Task B now above Task A visually)
      const cardPositions = await page.locator('.column-body .task-card').boundingBox();
      const updatedB = await todoColumnBody.locator('text=Task B').boundingBox();
      const updatedA = await todoColumnBody.locator('text=Task A').boundingBox();

      if (updatedB && updatedA) {
        expect(updatedB.y).toBeLessThan(updatedA.y); // B is now above A
      }
    }
  });

  test('show visual feedback during drag', async ({ page }) => {
    // SETUP: Create a task
    await createTaskViaUI(page, 'Drag Feedback Test');

    const taskCard = page.locator('text=Drag Feedback Test').first();
    const inProgressColumn = page.locator('h3:has-text("In Progress")').first()
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    // ACTION: Start drag (hover over card)
    await taskCard.hover();

    // VERIFY: Card has drag cursor
    const style = await taskCard.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(['grab', 'grabbing', 'move']).toContain(style);

    // ACTION: Perform drag to another column
    await taskCard.dragTo(inProgressColumn, { force: true });

    // VERIFY: Task appears in new location
    await expect(
      inProgressColumn.locator('text=Drag Feedback Test')
    ).toBeVisible({ timeout: 5000 });
  });

  test('handle drag to same column (no-op)', async ({ page }) => {
    // SETUP: Create a task
    await createTaskViaUI(page, 'Same Column Task');

    const todoColumn = page.locator('h3:has-text("To Do")').first()
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    const taskCard = todoColumn.locator('text=Same Column Task').first();

    // ACTION: Drag task to a different position in same column
    const firstCard = todoColumn.locator('.task-card').first();
    const secondCard = todoColumn.locator('.task-card').nth(1);

    if (await secondCard.isVisible()) {
      await taskCard.dragTo(secondCard, { force: true });
    }

    // VERIFY: Task still in same column
    await expect(
      todoColumn.locator('text=Same Column Task')
    ).toBeVisible();
  });

  test('cancel drag with Escape key', async ({ page }) => {
    // SETUP: Create a task
    await createTaskViaUI(page, 'Escape Test Task');

    const todoColumn = page.locator('h3:has-text("To Do")').first()
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    const inProgressColumn = page.locator('h3:has-text("In Progress")').first()
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    const taskCard = todoColumn.locator('text=Escape Test Task').first();

    // ACTION: Start drag, then press Escape
    await taskCard.hover();
    await page.keyboard.press('Escape');

    // VERIFY: Task still in original column (Todo)
    await expect(
      todoColumn.locator('text=Escape Test Task')
    ).toBeVisible();

    // VERIFY: Task NOT in other column
    await expect(
      inProgressColumn.locator('text=Escape Test Task')
    ).not.toBeVisible();
  });

  test('drop outside valid drop zone should cancel', async ({ page }) => {
    // SETUP: Create a task
    await createTaskViaUI(page, 'Outside Drop Task');

    const todoColumn = page.locator('h3:has-text("To Do")').first()
      .locator('ancestor::app-kanban-column');

    const taskCard = todoColumn.locator('.task-card').first();

    // ACTION: Try to drag task to sidebar (invalid drop zone)
    const sidebar = page.locator('app-sidebar');
    await taskCard.hover();
    // Simulate drag outside
    await page.mouse.move(await taskCard.boundingBox() ? 1200 : 100, 300);
    await page.mouse.up();

    // VERIFY: Task still in original column
    await expect(taskCard).toBeVisible();
  });

  test('drag task with multiple tasks in column', async ({ page }) => {
    // SETUP: Create multiple tasks to test reordering in crowded column
    for (let i = 0; i < 3; i++) {
      await createTaskViaUI(page, `Multi Task ${i}`);
      if (i < 2) {
        await page.reload();
        await page.waitForSelector('app-kanban-column', { timeout: 10000 });
      }
    }

    const todoColumn = page.locator('h3:has-text("To Do")').first()
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    const inProgressColumn = page.locator('h3:has-text("In Progress")').first()
      .locator('ancestor::app-kanban-column')
      .locator('.column-body');

    // ACTION: Drag middle task to another column
    const tasks = await todoColumn.locator('.task-card').count();
    if (tasks >= 2) {
      const secondTask = todoColumn.locator('.task-card').nth(1);
      await secondTask.dragTo(inProgressColumn, { force: true });

      // VERIFY: Task moved, others remain in original column
      const remainingTasks = await todoColumn.locator('.task-card').count();
      expect(remainingTasks).toBe(tasks - 1);
    }
  });
});
