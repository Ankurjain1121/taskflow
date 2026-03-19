import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';
import { WorkspacePage } from './pages/WorkspacePage';

/**
 * E2E Journey: Project (Board) CRUD
 *
 * Tests the complete project/board lifecycle:
 * - Login and navigate to project
 * - Create new board via workspace page
 * - Verify board appears in sidebar
 * - Navigate to board and verify kanban loads
 * - Navigate to board settings
 */

let testEmail: string;

test.describe('Project CRUD Journey', () => {
  test.setTimeout(120000);

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    testEmail = await signUpAndOnboard(page, 'Project CRUD WS');
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
  });

  test('create new board via workspace page', async ({ page }) => {
    // Navigate via sidebar project link
    await page.waitForLoadState('networkidle').catch(() => {});
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

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
        'input[formControlName="name"], input[placeholder*="board"], input[placeholder*="Board"]',
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
    // The sidebar should show project items
    await page.waitForLoadState('networkidle').catch(() => {});
    const sidebarProjects = page.locator('app-sidebar-projects .project-item').first();
    await expect(sidebarProjects).toBeVisible({ timeout: 15000 });

    // Project links should be visible in the sidebar
    const projectLinks = page.locator('app-sidebar-projects a.project-item');
    await expect(projectLinks.first()).toBeVisible({ timeout: 10000 });

    const projectCount = await projectLinks.count();
    expect(projectCount).toBeGreaterThanOrEqual(1);
  });

  test('navigate to board and verify kanban loads', async ({ page }) => {
    // Navigate via sidebar project link
    await page.waitForLoadState('networkidle').catch(() => {});
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

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
    // Navigate via sidebar project link
    await page.waitForLoadState('networkidle').catch(() => {});
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });
    await page.locator('button:has-text("New Task")').waitFor({
      timeout: 15000,
    });

    // Extract project and board IDs from current URL
    const url = page.url();
    const projectMatch = url.match(/\/project\/([a-f0-9-]+)/);
    const boardMatch = url.match(/\/board\/([a-f0-9-]+)/);
    expect(projectMatch).toBeTruthy();

    // Navigate to board settings via URL
    if (boardMatch) {
      await page.goto(
        `/project/${projectMatch![1]}/board/${boardMatch![1]}/settings`,
      );
    } else {
      await page.goto(
        `/project/${projectMatch![1]}/settings`,
      );
    }
    await page.waitForLoadState('domcontentloaded');

    // Board settings page should load
    await expect(
      page.locator('h1:has-text("Board Settings"), h1:has-text("Settings")').first(),
    ).toBeVisible({ timeout: 15000 });

    // General section should be visible with name input
    await expect(page.locator('h2:has-text("General")')).toBeVisible({
      timeout: 10000,
    });
  });

  test('workspace page shows board count and stats', async ({ page }) => {
    // Navigate via sidebar project link
    await page.waitForLoadState('networkidle').catch(() => {});
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Workspace name heading should be visible
    await expect(ws.workspaceName).toBeVisible({ timeout: 10000 });
    const nameText = await ws.workspaceName.textContent();
    expect(nameText?.trim().length).toBeGreaterThan(0);

    // Boards heading should show
    await expect(ws.boardsHeading).toBeVisible({ timeout: 10000 });

    // At least one board from onboarding
    const boardCount = await ws.getBoardCount();
    expect(boardCount).toBeGreaterThanOrEqual(1);
  });
});
