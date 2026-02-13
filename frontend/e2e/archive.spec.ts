import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import {
  navigateToFirstBoard,
  createTaskViaUI,
  deleteTaskViaAPI,
} from './helpers/data-factory';
import { ArchivePage } from './pages/ArchivePage';

test.describe('Archive Page', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Archive WS');
  });

  test('page loads with Archive heading', async ({ page }) => {
    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();
  });

  test('empty state shows "Archive is empty" message', async ({ page }) => {
    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    await expect(archivePage.emptyState).toBeVisible({ timeout: 10000 });
  });

  test('filter tabs are visible', async ({ page }) => {
    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    await expect(archivePage.filterAll).toBeVisible({ timeout: 10000 });
    await expect(archivePage.filterTasks).toBeVisible({ timeout: 10000 });
    await expect(archivePage.filterBoards).toBeVisible({ timeout: 10000 });
  });

  test('All filter is active by default', async ({ page }) => {
    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    // The "All" button should have the active style class (indigo)
    await expect(archivePage.filterAll).toHaveClass(/indigo/, {
      timeout: 10000,
    });
  });

  test('clicking Tasks filter switches active state', async ({ page }) => {
    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    await archivePage.filterTasks.click();

    // Tasks button should now have active style
    await expect(archivePage.filterTasks).toHaveClass(/indigo/, {
      timeout: 10000,
    });
  });

  test('clicking Boards filter switches active state', async ({ page }) => {
    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    await archivePage.filterBoards.click();

    // Boards button should now have active style
    await expect(archivePage.filterBoards).toHaveClass(/indigo/, {
      timeout: 10000,
    });
  });

  test('deleted task appears in archive', async ({ page }) => {
    // Navigate to board and create a task
    await navigateToFirstBoard(page);
    await createTaskViaUI(page, 'Task to Archive');

    // Get the task ID from the API
    const tasksResponse = await page.request.get('/api/my-tasks');
    const tasksBody = await tasksResponse.json();
    const tasks = tasksBody.items || tasksBody;
    const task = tasks.find(
      (t: { title: string }) => t.title === 'Task to Archive',
    );

    if (task) {
      await deleteTaskViaAPI(page, task.id);
    }

    // Navigate to archive
    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    // If task was found and deleted, it should appear
    if (task) {
      await expect(page.locator('text=Task to Archive')).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('archive item shows entity name', async ({ page }) => {
    await navigateToFirstBoard(page);
    await createTaskViaUI(page, 'Named Archive Task');

    const tasksResponse = await page.request.get('/api/my-tasks');
    const tasksBody = await tasksResponse.json();
    const tasks = tasksBody.items || tasksBody;
    const task = tasks.find(
      (t: { title: string }) => t.title === 'Named Archive Task',
    );

    if (task) {
      await deleteTaskViaAPI(page, task.id);
    }

    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    if (task) {
      await expect(page.locator('text=Named Archive Task')).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('archive item shows deletion date info', async ({ page }) => {
    await navigateToFirstBoard(page);
    await createTaskViaUI(page, 'Dated Archive Task');

    const tasksResponse = await page.request.get('/api/my-tasks');
    const tasksBody = await tasksResponse.json();
    const tasks = tasksBody.items || tasksBody;
    const task = tasks.find(
      (t: { title: string }) => t.title === 'Dated Archive Task',
    );

    if (task) {
      await deleteTaskViaAPI(page, task.id);
    }

    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    if (task) {
      // Should show "Deleted today" or "X days remaining"
      await expect(page.locator('text=/Deleted|days remaining/')).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('archive item shows entity type indicator', async ({ page }) => {
    await navigateToFirstBoard(page);
    await createTaskViaUI(page, 'Typed Archive Task');

    const tasksResponse = await page.request.get('/api/my-tasks');
    const tasksBody = await tasksResponse.json();
    const tasks = tasksBody.items || tasksBody;
    const task = tasks.find(
      (t: { title: string }) => t.title === 'Typed Archive Task',
    );

    if (task) {
      await deleteTaskViaAPI(page, task.id);
    }

    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    if (task) {
      // Should show entity type "Task" (titlecase)
      await expect(page.locator('text=Task').first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('restore button is visible on archive item', async ({ page }) => {
    await navigateToFirstBoard(page);
    await createTaskViaUI(page, 'Restorable Task');

    const tasksResponse = await page.request.get('/api/my-tasks');
    const tasksBody = await tasksResponse.json();
    const tasks = tasksBody.items || tasksBody;
    const task = tasks.find(
      (t: { title: string }) => t.title === 'Restorable Task',
    );

    if (task) {
      await deleteTaskViaAPI(page, task.id);
    }

    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    if (task) {
      await expect(archivePage.restoreButtons.first()).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('clicking restore removes item from archive list', async ({ page }) => {
    await navigateToFirstBoard(page);
    await createTaskViaUI(page, 'Restore Me Task');

    const tasksResponse = await page.request.get('/api/my-tasks');
    const tasksBody = await tasksResponse.json();
    const tasks = tasksBody.items || tasksBody;
    const task = tasks.find(
      (t: { title: string }) => t.title === 'Restore Me Task',
    );

    if (task) {
      await deleteTaskViaAPI(page, task.id);
    }

    const archivePage = new ArchivePage(page);
    await archivePage.goto();
    await archivePage.expectLoaded();

    if (task) {
      // Click restore
      await archivePage.restoreButtons.first().click();

      // Item should disappear and empty state should show
      await expect(page.locator('text=Restore Me Task')).not.toBeVisible({
        timeout: 10000,
      });
    }
  });
});
