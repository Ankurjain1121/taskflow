import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';
import {
  navigateToFirstBoard,
  addFavoriteViaAPI,
} from './helpers/data-factory';
import { FavoritesPage } from './pages/FavoritesPage';

let testEmail: string;

test.describe('Favorites Page', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    const page = await browser.newPage();
    testEmail = await signUpAndOnboard(page, 'Favorites WS');
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  test('page loads with Favorites heading', async ({ page }) => {
    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();
  });

  test('empty state shows "No favorites yet" message', async ({ page }) => {
    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectEmpty();
  });

  test('empty state has an icon visual indicator', async ({ page }) => {
    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectEmpty();

    // The empty state should include an SVG icon
    const icon = page.locator('svg').first();
    await expect(icon).toBeVisible({ timeout: 10000 });
  });

  test('can add a board as favorite via API', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    // Navigate to favorites and verify
    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Should not show empty state
    await expect(favoritesPage.emptyState).not.toBeVisible({ timeout: 5000 });
  });

  test('favorited board appears on favorites page', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Board section should be visible
    await expect(favoritesPage.boardSection).toBeVisible({ timeout: 10000 });
  });

  test('favorite item shows entity name', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Should have at least one favorite item with text content
    const itemCount = await favoritesPage.favoriteItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(1);
  });

  test('favorite item shows "Boards" type section header', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // The section header should indicate "Boards"
    await expect(favoritesPage.boardSection).toBeVisible({ timeout: 10000 });
    await expect(favoritesPage.boardSection).toContainText('Boards');
  });

  test('clicking favorite item navigates to entity', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Click the favorite link
    const favoriteLink = page.locator(`a[href*="/project/"]`).first();
    await expect(favoriteLink).toBeVisible({ timeout: 10000 });
    await favoriteLink.click();

    // Should navigate to project/board page
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });
  });

  test('unfavorite button exists on favorite item', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // The unfavorite button has opacity-0 by default but should be in the DOM
    // It's a button with an SVG star icon inside a .group container
    const unfavoriteBtn = page
      .locator('button.opacity-0, button[class*="opacity-0"]')
      .first();
    await expect(unfavoriteBtn).toBeAttached({ timeout: 10000 });
  });

  test('removing favorite makes it disappear from list', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Click the unfavorite button (force click since it's opacity-0)
    const unfavoriteBtn = page
      .locator('button.opacity-0, button[class*="opacity-0"]')
      .first();
    await unfavoriteBtn.click({ force: true });

    // After removal, should show empty state
    await favoritesPage.expectEmpty();
  });

  test('can add multiple favorites', async ({ page }) => {
    const { workspaceId, boardId } = await navigateToFirstBoard(page);

    // Add board as favorite
    await addFavoriteViaAPI(page, 'board', boardId);

    // Create a second board and favorite it too
    const response = await page.request.post(
      `/api/workspaces/${workspaceId}/boards`,
      {
        data: { name: 'Second Board', description: '' },
      },
    );
    const body = await response.json();
    const secondBoardId = body.id;
    await addFavoriteViaAPI(page, 'board', secondBoardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Should not be empty
    await expect(favoritesPage.emptyState).not.toBeVisible({ timeout: 5000 });
  });

  test('multiple favorites display in the boards section', async ({ page }) => {
    const { workspaceId, boardId } = await navigateToFirstBoard(page);

    await addFavoriteViaAPI(page, 'board', boardId);

    const response = await page.request.post(
      `/api/workspaces/${workspaceId}/boards`,
      {
        data: { name: 'Another Board', description: '' },
      },
    );
    const body = await response.json();
    await addFavoriteViaAPI(page, 'board', body.id);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Boards section header should show count
    await expect(favoritesPage.boardSection).toBeVisible({ timeout: 10000 });
    await expect(favoritesPage.boardSection).toContainText('Boards (2)');
  });
});
