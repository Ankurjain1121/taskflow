import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { WorkspacePage } from './pages/WorkspacePage';

/**
 * E2E Journey: Project (Board) CRUD
 *
 * Tests the complete project/board lifecycle:
 * - Login and navigate to workspace
 * - Create new board via workspace page
 * - Verify board appears in sidebar
 * - Navigate to board and verify kanban loads
 * - Navigate to board settings
 */

test.describe('Project CRUD Journey', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Project CRUD WS');
  });

  test('create new board via workspace page', async ({ page }) => {
    // Navigate from dashboard to workspace
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('a:has-text("Open Workspace")').first().click();
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Get initial board count
    const initialCount = await ws.getBoardCount();

    // Click "Create Board" button
    await expect(ws.createBoardButton).toBeVisible({ timeout: 10000 });
    await ws.createBoardButton.click();

    // A dialog should appear for creating a new board
    const dialogTitle = page.locator(
      '.p-dialog-title:has-text("Create"), .p-dialog-title:has-text("New Board"), h2:has-text("Create")',
    );
    await expect(dialogTitle).toBeVisible({ timeout: 10000 });

    // Fill in the board name
    const nameInput = page
      .locator(
        'input[formControlName="name"], input[placeholder*="board"], input[placeholder*="Board"], input#name',
      )
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('E2E Test Board');

    // Submit the form
    const submitBtn = page
      .locator(
        'button:has-text("Create Board"), button:has-text("Create"), button[type="submit"]',
      )
      .first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Wait for dialog to close or navigate
    await page.waitForTimeout(2000);

    // Reload workspace page to see the new board
    await page.goto(page.url());
    await ws.expectLoaded();

    // Board count should have increased
    const newCount = await ws.getBoardCount();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('board appears in sidebar after creation', async ({ page }) => {
    // Navigate to workspace
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('a:has-text("Open Workspace")').first().click();
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    // The sidebar should show the workspace with at least the sample board
    const workspaceItem = page.locator('app-workspace-item').first();
    await expect(workspaceItem).toBeVisible({ timeout: 10000 });

    // Board links should be visible in the sidebar
    const boardLinks = workspaceItem.locator('a[href*="/board/"]');
    await expect(boardLinks.first()).toBeVisible({ timeout: 10000 });

    const boardCount = await boardLinks.count();
    expect(boardCount).toBeGreaterThanOrEqual(1);
  });

  test('navigate to board and verify kanban loads', async ({ page }) => {
    // Navigate from dashboard to workspace to board
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('a:has-text("Open Workspace")').first().click();
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Click the first board card
    await ws.clickFirstBoard();

    // Verify we are on a board page
    await expect(page).toHaveURL(/\/workspace\/.*\/board\//, {
      timeout: 15000,
    });

    // Wait for kanban board to load
    await page.waitForLoadState('domcontentloaded');

    // Kanban columns should be visible (default columns from onboarding)
    const columns = page.locator('app-kanban-column');
    await expect(columns.first()).toBeVisible({ timeout: 15000 });
    const columnCount = await columns.count();
    expect(columnCount).toBeGreaterThanOrEqual(2);

    // "New Task" button should be available
    await expect(page.locator('button:has-text("New Task")')).toBeVisible({
      timeout: 10000,
    });

    // Board heading should show a non-empty name
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    const headingText = await heading.textContent();
    expect(headingText?.trim().length).toBeGreaterThan(0);
  });

  test('navigate to board settings page', async ({ page }) => {
    // Navigate to workspace
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('a:has-text("Open Workspace")').first().click();
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Click the first board to go to board view
    await ws.clickFirstBoard();
    await expect(page).toHaveURL(/\/workspace\/.*\/board\//, {
      timeout: 15000,
    });
    await page.locator('button:has-text("New Task")').waitFor({
      timeout: 15000,
    });

    // Extract workspace and board IDs from current URL
    const url = page.url();
    const wsMatch = url.match(/\/workspace\/([a-f0-9-]+)/);
    const boardMatch = url.match(/\/board\/([a-f0-9-]+)/);
    expect(wsMatch).toBeTruthy();
    expect(boardMatch).toBeTruthy();

    // Navigate to board settings via URL
    await page.goto(
      `/workspace/${wsMatch![1]}/board/${boardMatch![1]}/settings`,
    );
    await page.waitForLoadState('domcontentloaded');

    // Board settings page should load
    await expect(
      page.locator('h1:has-text("Board Settings")'),
    ).toBeVisible({ timeout: 15000 });

    // General section should be visible with name input
    await expect(page.locator('h2:has-text("General")')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('#name')).toBeVisible({ timeout: 10000 });
  });

  test('workspace page shows board count and stats', async ({ page }) => {
    // Navigate to workspace
    await expect(page.locator('text=Your Workspaces')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('a:has-text("Open Workspace")').first().click();
    await expect(page).toHaveURL(/\/workspace\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Workspace name heading should be visible
    await expect(ws.workspaceName).toBeVisible({ timeout: 10000 });
    const nameText = await ws.workspaceName.textContent();
    expect(nameText?.trim()).toContain('Project CRUD WS');

    // Boards heading should show
    await expect(ws.boardsHeading).toBeVisible({ timeout: 10000 });

    // At least one board from onboarding
    const boardCount = await ws.getBoardCount();
    expect(boardCount).toBeGreaterThanOrEqual(1);
  });
});
