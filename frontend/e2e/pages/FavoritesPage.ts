import { Page, Locator, expect } from '@playwright/test';

export class FavoritesPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly favoriteItems: Locator;
  readonly taskSection: Locator;
  readonly boardSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Favorites")');
    this.emptyState = page.locator('text=No favorites yet');
    this.favoriteItems = page.locator('[class*="hover\\:border-indigo"]');
    this.taskSection = page.locator('h2:has-text("Tasks")');
    this.boardSection = page.locator('h2:has-text("Boards")');
  }

  async goto() {
    await this.page.goto('/favorites');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10000 });
  }

  async expectEmpty() {
    await expect(this.emptyState).toBeVisible({ timeout: 10000 });
  }
}
