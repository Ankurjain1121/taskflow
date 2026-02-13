import { Page, Locator, expect } from '@playwright/test';

export class TaskDetailPage {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly titleInput: Locator;
  readonly descriptionArea: Locator;
  readonly prioritySelect: Locator;
  readonly dueDateInput: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // The task detail is a fixed side panel (w-[480px])
    this.panel = page
      .locator('.fixed.right-0, [class*="w-[480px]"]')
      .first();
    this.closeButton = page
      .locator('button')
      .filter({ has: page.locator('svg') })
      .first();
    this.titleInput = page.locator('input[type="text"]').first();
    this.descriptionArea = page.locator('textarea').first();
    this.prioritySelect = page.locator('select').first();
    this.dueDateInput = page.locator('input[type="date"]').first();
    this.deleteButton = page.locator('button:has-text("Delete")');
  }

  async expectOpen() {
    // Wait for the task detail panel to be visible
    await expect(
      this.page.locator('text=/Task Detail|Created/'),
    ).toBeVisible({ timeout: 10000 });
  }

  async close() {
    await this.closeButton.click();
  }
}
