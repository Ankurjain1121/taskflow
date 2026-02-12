import { Page, Locator, expect } from '@playwright/test';

export class ArchivePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly filterAll: Locator;
  readonly filterTasks: Locator;
  readonly filterBoards: Locator;
  readonly archiveItems: Locator;
  readonly restoreButtons: Locator;
  readonly deleteButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Archive")');
    this.emptyState = page.locator('text=Archive is empty, text=No archived items, text=archive is empty').first();
    this.filterAll = page.locator('button:has-text("All")');
    this.filterTasks = page.locator('button:has-text("Tasks")');
    this.filterBoards = page.locator('button:has-text("Boards")');
    this.archiveItems = page.locator('[class*="border"]').filter({ hasText: /deleted|ago|remaining/i });
    this.restoreButtons = page.locator('button:has-text("Restore")');
    this.deleteButtons = page.locator('button:has-text("Delete")');
  }

  async goto() {
    await this.page.goto('/archive');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10000 });
  }
}
