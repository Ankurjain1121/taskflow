import { Page, Locator, expect } from '@playwright/test';

export class WorkspacePage {
  readonly page: Page;
  readonly workspaceName: Locator;
  readonly boardsHeading: Locator;
  readonly boardCards: Locator;
  readonly createBoardButton: Locator;
  readonly settingsLink: Locator;
  readonly teamLink: Locator;
  readonly statsCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.workspaceName = page.locator('h1').first();
    this.boardsHeading = page.locator('h2:has-text("Boards")');
    this.boardCards = page.locator('a[href*="/board/"]');
    this.createBoardButton = page.locator('button:has-text("Create Board")');
    this.settingsLink = page
      .locator('a[href*="/settings"]:has-text("Settings")')
      .first();
    this.teamLink = page
      .locator('a[href*="/team"]:has-text("Team Overview")')
      .first();
    this.statsCards = page.locator('.rounded-xl');
    this.emptyState = page.locator('text=Create your first board');
  }

  async expectLoaded() {
    await expect(this.boardsHeading).toBeVisible({ timeout: 15000 });
  }

  async getBoardCount(): Promise<number> {
    return await this.boardCards.count();
  }

  async clickFirstBoard() {
    await this.boardCards.first().click();
    await expect(this.page).toHaveURL(/\/board\//, { timeout: 15000 });
  }
}
