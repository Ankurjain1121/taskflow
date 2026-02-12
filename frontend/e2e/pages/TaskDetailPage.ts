import { Page, Locator, expect } from '@playwright/test';

export class TaskDetailPage {
  readonly page: Page;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly titleInput: Locator;
  readonly descriptionArea: Locator;
  readonly prioritySelect: Locator;
  readonly dueDateInput: Locator;
  readonly commentInput: Locator;
  readonly subtaskInput: Locator;
  readonly deleteButton: Locator;
  readonly columnDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    // The task detail is a side panel
    this.panel = page.locator('[class*="w-[480px]"], [class*="task-detail"], .fixed.right-0').first();
    this.closeButton = page.locator('button:has-text("close"), button[aria-label="Close"]').first();
    this.titleInput = page.locator('input[type="text"]').first();
    this.descriptionArea = page.locator('textarea').first();
    this.prioritySelect = page.locator('select, mat-select').first();
    this.dueDateInput = page.locator('input[type="date"]').first();
    this.commentInput = page.locator('textarea[placeholder*="comment"], input[placeholder*="comment"]').first();
    this.subtaskInput = page.locator('input[placeholder*="subtask"], input[placeholder*="Subtask"]').first();
    this.deleteButton = page.locator('button:has-text("Delete")');
    this.columnDisplay = page.locator('text=To Do, text=In Progress, text=Done').first();
  }

  async expectOpen() {
    // Wait for the task detail panel to be visible
    await expect(this.page.locator('text=Created')).toBeVisible({ timeout: 10000 });
  }

  async close() {
    const closeBtn = this.page.locator('button').filter({ hasText: /close|×/ }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  }
}
