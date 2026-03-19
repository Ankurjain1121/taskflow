import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';
import { WorkspacePage } from './pages/WorkspacePage';

test.describe('Workspace Page', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    testEmail = await signUpAndOnboard(page, 'Workspace Test WS');
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
  });

  test('workspace page loads with name in header', async ({ page }) => {
    // Navigate from sidebar to workspace/project
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Workspace name heading should be visible and not empty
    await expect(ws.workspaceName).toBeVisible({ timeout: 10000 });
    const nameText = await ws.workspaceName.textContent();
    expect(nameText?.trim().length).toBeGreaterThan(0);
    expect(nameText?.trim()).not.toBe('Loading...');
  });

  test('boards section heading is visible', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await expect(ws.boardsHeading).toBeVisible({ timeout: 15000 });
  });

  test('sample board card visible after onboarding', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // The sample board created during onboarding should appear
    const count = await ws.getBoardCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('create new board via Create Board button', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    const initialCount = await ws.getBoardCount();

    // Click "Create Board" button
    await expect(ws.createBoardButton).toBeVisible({ timeout: 10000 });
    await ws.createBoardButton.click();

    // Fill the create board dialog
    await expect(page.locator('text=Create New Board')).toBeVisible({ timeout: 10000 });
    await page.locator('input[formControlName="name"]').fill('Test Board Alpha');

    // Click Create Board submit button in dialog
    const submitBtn = page.locator('button:has-text("Create Board")').last();
    await submitBtn.click();

    // Wait for dialog to close and board to appear
    await expect(page.locator('text=Create New Board')).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify new board count
    const newCount = await ws.getBoardCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test('second board appears in grid after creation', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Create a board
    await ws.createBoardButton.click();
    await expect(page.locator('text=Create New Board')).toBeVisible({ timeout: 10000 });
    await page.locator('input[formControlName="name"]').fill('Second Board');
    await page.locator('button:has-text("Create Board")').last().click();
    await expect(page.locator('text=Create New Board')).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const count = await ws.getBoardCount();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('third board created successfully', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    // Create two more boards
    for (const name of ['Board Two', 'Board Three']) {
      await ws.createBoardButton.click();
      await expect(page.locator('text=Create New Board')).toBeVisible({ timeout: 10000 });
      await page.locator('input[formControlName="name"]').fill(name);
      await page.locator('button:has-text("Create Board")').last().click();
      await expect(page.locator('text=Create New Board')).toBeHidden({ timeout: 15000 });
      await page.waitForTimeout(2000);
    }

    const count = await ws.getBoardCount();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('board card shows board name text', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    const firstCard = ws.boardCards.first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    const text = await firstCard.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('click board card navigates to board page', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();
    await ws.clickFirstBoard();

    // Should be on a board URL
    await expect(page).toHaveURL(/\/workspace\/[a-f0-9-]+\/board\/[a-f0-9-]+/, { timeout: 15000 });
  });

  test('workspace settings link is visible', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    await expect(ws.settingsLink).toBeVisible({ timeout: 10000 });
  });

  test('team link is visible in workspace', async ({ page }) => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    const ws = new WorkspacePage(page);
    await ws.expectLoaded();

    await expect(ws.teamLink).toBeVisible({ timeout: 10000 });
  });
});
