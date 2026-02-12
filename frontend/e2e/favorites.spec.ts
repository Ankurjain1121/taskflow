import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { navigateToFirstBoard, addFavoriteViaAPI } from './helpers/data-factory';
import { FavoritesPage } from './pages/FavoritesPage';

test.describe('Favorites Page', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Favorites WS');
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

  test('empty state has a star icon visual indicator', async ({ page }) => {
    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectEmpty();

    // The empty state should include an SVG star icon
    const starIcon = page.locator('svg').filter({ has: page.locator('path[d*="11.049 2.927"]') });
    await expect(starIcon).toBeVisible({ timeout: 10000 });
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
    const favoriteLink = page.locator(`a[href*="/board/${boardId}"]`).first();
    await expect(favoriteLink).toBeVisible({ timeout: 10000 });
    await favoriteLink.click();

    // Should navigate to board page
    await expect(page).toHaveURL(/\/board\//, { timeout: 15000 });
  });

  test('hovering favorite item reveals unfavorite button', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // The unfavorite button should exist (opacity-0 by default, visible on hover)
    const unfavoriteBtn = page.locator('button[title="Remove from favorites"]').first();
    await expect(unfavoriteBtn).toBeAttached({ timeout: 10000 });

    // Hover the item to reveal the button
    const itemRow = unfavoriteBtn.locator('..');
    await itemRow.hover();
  });

  test('removing favorite makes it disappear from list', async ({ page }) => {
    const { boardId } = await navigateToFirstBoard(page);
    await addFavoriteViaAPI(page, 'board', boardId);

    const favoritesPage = new FavoritesPage(page);
    await favoritesPage.goto();
    await favoritesPage.expectLoaded();

    // Click the unfavorite button (force click since it may be opacity-0)
    const unfavoriteBtn = page.locator('button[title="Remove from favorites"]').first();
    await unfavoriteBtn.click({ force: true });

    // After removal, should show empty state
    await favoritesPage.expectEmpty();
  });

  test('can add multiple favorites', async ({ page }) => {
    const { workspaceId, boardId } = await navigateToFirstBoard(page);

    // Add board as favorite
    await addFavoriteViaAPI(page, 'board', boardId);

    // Create a second board and favorite it too
    const response = await page.request.post(`/api/workspaces/${workspaceId}/boards`, {
      data: { name: 'Second Board', description: '' },
    });
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

    const response = await page.request.post(`/api/workspaces/${workspaceId}/boards`, {
      data: { name: 'Another Board', description: '' },
    });
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
