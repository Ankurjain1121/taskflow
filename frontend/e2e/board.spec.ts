import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';

/**
 * Helper: Navigate from dashboard to the first board.
 * Returns the page (same reference) after landing on the board view.
 */
async function navigateToBoard(
  page: import('@playwright/test').Page,
): Promise<void> {
  await expect(page.locator('text=Your Workspaces')).toBeVisible({
    timeout: 15000,
  });
  await page.locator('a:has-text("Open Workspace")').first().click();
  await expect(page.locator('h2:has-text("Boards")')).toBeVisible({
    timeout: 15000,
  });

  const boardCard = page.locator('a[href*="/board/"]').first();
  await expect(boardCard).toBeVisible({ timeout: 10000 });
  await boardCard.click();

  await expect(page).toHaveURL(/\/workspace\/.*\/board\//, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');

  // Wait for board content to load (board name heading or New Task button)
  await expect(page.locator('button:has-text("New Task")')).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Helper: Create a task via the New Task dialog.
 * Opens dialog, fills title, submits via mat-flat-button, waits for dialog to close.
 */
async function createTaskViaDialog(
  page: import('@playwright/test').Page,
  title: string,
): Promise<void> {
  // Click "New Task" button in toolbar
  await page.locator('button:has-text("New Task")').click();

  // Wait for the Create New Task dialog
  const dialogTitle = page.locator('h2:has-text("New Task")');
  await expect(dialogTitle).toBeVisible({ timeout: 10000 });

  // Fill the title field using placeholder attribute
  const titleInput = page.locator('input[placeholder="Enter task title"]');
  await expect(titleInput).toBeVisible({ timeout: 5000 });
  await titleInput.click();
  await titleInput.fill(title);

  // Verify submit button is enabled (form valid) then click
  const submitBtn = page.locator('mat-dialog-actions button[mat-flat-button]');
  await expect(submitBtn).toBeEnabled({ timeout: 3000 });
  await submitBtn.click();

  // Wait for dialog to close
  await expect(dialogTitle).toBeHidden({ timeout: 15000 });

  // Give the API call time to complete, then reload to ensure fresh state
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('button:has-text("New Task")').waitFor({ timeout: 15000 });

  // Wait for the task card to appear on the board
  await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 15000 });
}

test.describe('Board Management', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up and onboard so we have a workspace with a sample board
    await signUpAndOnboard(page, 'Board Test WS');
  });

  test('can navigate to a board via workspace page', async ({ page }) => {
    // Dashboard should show workspace(s)
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });

    // Click "Open Workspace" to go to the workspace page
    const openLink = page.locator('a:has-text("Open Workspace")').first();
    await expect(openLink).toBeVisible({ timeout: 10000 });
    await openLink.click();

    // Verify we are on the workspace page
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    // Wait for workspace page to load (spinner gone, "Boards" heading visible)
    await expect(page.locator('h2:has-text("Boards")')).toBeVisible({
      timeout: 15000,
    });

    // The sample board created during onboarding should appear as a link
    const boardCard = page.locator('a[href*="/board/"]').first();
    await expect(boardCard).toBeVisible({ timeout: 10000 });
    await boardCard.click();

    // Verify we are on a board page
    await expect(page).toHaveURL(/\/workspace\/.*\/board\//, {
      timeout: 15000,
    });

    // The board view should show a board name header (not "Loading...")
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('board view loads with board name', async ({ page }) => {
    // Navigate: Dashboard -> Workspace -> Board
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('a:has-text("Open Workspace")').first().click();
    await expect(page.locator('h2:has-text("Boards")')).toBeVisible({
      timeout: 15000,
    });

    const boardCard = page.locator('a[href*="/board/"]').first();
    await expect(boardCard).toBeVisible({ timeout: 10000 });
    await boardCard.click();

    await expect(page).toHaveURL(/\/workspace\/.*\/board\//, {
      timeout: 15000,
    });

    // Wait for the board to fully load
    await page.waitForLoadState('domcontentloaded');

    // The heading should contain the board name, not "Loading..."
    const boardHeading = page.locator('h1').first();
    await expect(boardHeading).toBeVisible({ timeout: 15000 });
    await expect(boardHeading).not.toHaveText('Loading...');
  });

  test('workspace page is accessible and shows boards heading', async ({
    page,
  }) => {
    // Click "Open Workspace" link
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });
    const openLink = page.locator('a:has-text("Open Workspace")').first();
    await expect(openLink).toBeVisible({ timeout: 10000 });
    await openLink.click();

    // Verify we navigated to a workspace page
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    // Verify the "Boards" section heading appears
    await expect(page.locator('h2:has-text("Boards")')).toBeVisible({
      timeout: 15000,
    });
  });

  // Default columns visible - verify via column name headings
  test('default columns are visible on board', async ({ page }) => {
    await navigateToBoard(page);

    // Column names are in h3 tags within app-kanban-column components
    const backlog = page.locator('h3:has-text("Backlog")').first();
    const todo = page.locator('h3:has-text("To Do")').first();

    await expect(backlog).toBeVisible({ timeout: 15000 });
    await expect(todo).toBeVisible({ timeout: 10000 });
  });

  // Create first task via New Task dialog
  test('create first task via New Task button', async ({ page }) => {
    await navigateToBoard(page);

    // Click "New Task" button in toolbar
    const newTaskBtn = page.locator('button:has-text("New Task")');
    await expect(newTaskBtn).toBeVisible({ timeout: 5000 });
    await newTaskBtn.click();

    // The Create New Task dialog should appear
    await expect(page.locator('h2:has-text("New Task")')).toBeVisible({
      timeout: 10000,
    });

    // Title input should be visible (identified by placeholder)
    const titleInput = page.locator('input[placeholder="Enter task title"]');
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.click();
    await titleInput.fill('E2E Test Task 1');

    // Submit via the mat-flat-button in dialog actions
    const submitBtn = page.locator(
      'mat-dialog-actions button[mat-flat-button]',
    );
    await submitBtn.click();

    // Dialog should close after creation
    await expect(page.locator('h2:has-text("New Task")')).toBeHidden({
      timeout: 15000,
    });
  });

  // Created task appears in a column
  test('created task appears in a column', async ({ page }) => {
    await navigateToBoard(page);
    await createTaskViaDialog(page, 'Column Task Test');

    // The task title should appear somewhere on the board
    await expect(page.locator('text=Column Task Test')).toBeVisible({
      timeout: 15000,
    });
  });

  // Create second task with different title
  test('create second task with different title', async ({ page }) => {
    await navigateToBoard(page);

    await createTaskViaDialog(page, 'Second Task Alpha');
    await createTaskViaDialog(page, 'Second Task Beta');

    // Both tasks should be visible
    await expect(page.locator('text=Second Task Alpha')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('text=Second Task Beta')).toBeVisible({
      timeout: 15000,
    });
  });

  // Create three tasks consecutively
  test('can create three tasks consecutively', async ({ page }) => {
    await navigateToBoard(page);

    const taskNames = ['Triple Task 1', 'Triple Task 2', 'Triple Task 3'];

    for (const taskName of taskNames) {
      await createTaskViaDialog(page, taskName);
    }

    // All three should be visible
    for (const taskName of taskNames) {
      await expect(page.locator(`text=${taskName}`)).toBeVisible({
        timeout: 15000,
      });
    }
  });

  // Task card shows title text - verify board has content or task structure
  test('task card shows title text', async ({ page }) => {
    await navigateToBoard(page);

    // Create a task so we have something to check
    await createTaskViaDialog(page, 'Card Text Test');

    // The task text should be visible on the board
    await expect(page.locator('text=Card Text Test')).toBeVisible({
      timeout: 15000,
    });
  });

  // Click task card opens task detail panel
  test('click task card opens task detail panel', async ({ page }) => {
    await navigateToBoard(page);

    // Create a task to click on
    await createTaskViaDialog(page, 'Detail Panel Test');

    // Click on the task text
    await page.locator('text=Detail Panel Test').click();

    // The task detail slide-over panel should appear (fixed right side panel)
    // Wait for the panel content to load (shows "Created" text in footer)
    await expect(page.locator('text=Detail Panel Test').first()).toBeVisible({
      timeout: 10000,
    });

    // The backdrop overlay should be visible
    const backdrop = page.locator('.fixed.inset-0').first();
    await expect(backdrop).toBeVisible({ timeout: 5000 });
  });

  // Board toolbar shows view switcher buttons
  test('board toolbar shows view switcher buttons', async ({ page }) => {
    await navigateToBoard(page);

    // The board has icon-only view mode buttons with title attributes
    const kanbanBtn = page.locator('button[title="Kanban View"]');
    const listBtn = page.locator('button[title="List View"]');

    await expect(kanbanBtn).toBeVisible({ timeout: 5000 });
    await expect(listBtn).toBeVisible({ timeout: 5000 });
  });

  // Switch to List view and verify
  test('switch to list view', async ({ page }) => {
    await navigateToBoard(page);

    const listBtn = page.locator('button[title="List View"]');
    await expect(listBtn).toBeVisible({ timeout: 5000 });
    await listBtn.click();

    // After switching, the list view component should be visible
    const listView = page.locator('app-list-view');
    await expect(listView).toBeVisible({ timeout: 10000 });
  });

  // Switch back to Kanban view
  test('switch back to kanban view from list', async ({ page }) => {
    await navigateToBoard(page);

    const listBtn = page.locator('button[title="List View"]');
    const kanbanBtn = page.locator('button[title="Kanban View"]');

    await expect(listBtn).toBeVisible({ timeout: 5000 });

    // Switch to list first
    await listBtn.click();
    await page.waitForTimeout(1000);

    // Switch back to kanban
    await kanbanBtn.click();

    // Verify kanban columns are visible again (h3 headings)
    const backlogCol = page.locator('h3:has-text("Backlog")').first();
    await expect(backlogCol).toBeVisible({ timeout: 10000 });
  });

  // Column headers visible on board - verify via column structure
  test('column headers are visible on board', async ({ page }) => {
    await navigateToBoard(page);

    // Column names appear as h3 headings in kanban columns
    const backlog = page.locator('h3:has-text("Backlog")').first();
    await expect(backlog).toBeVisible({ timeout: 15000 });

    // Should have multiple columns visible
    const inProgress = page.locator('h3:has-text("In Progress")').first();
    await expect(inProgress).toBeVisible({ timeout: 10000 });
  });

  // New Task button is visible and clickable
  test('new task button is visible and clickable', async ({ page }) => {
    await navigateToBoard(page);

    // Look for the "New Task" button in the toolbar
    const addButton = page.locator('button:has-text("New Task")');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await expect(addButton).toBeEnabled();

    // Click it to verify dialog opens
    await addButton.click();
    await expect(page.locator('h2:has-text("New Task")')).toBeVisible({
      timeout: 10000,
    });
  });
});
