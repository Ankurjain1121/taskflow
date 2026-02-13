import { Page, Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly emailField: Locator;
  readonly avatarUrlInput: Locator;
  readonly saveButton: Locator;
  readonly createdDate: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Settings")');
    this.nameInput = page
      .locator('mat-form-field')
      .filter({ hasText: /Name/i })
      .locator('input')
      .first();
    this.emailField = page
      .locator('mat-form-field')
      .filter({ hasText: /email/i })
      .locator('input')
      .first();
    this.avatarUrlInput = page
      .locator('mat-form-field')
      .filter({ hasText: /avatar/i })
      .locator('input')
      .first();
    this.saveButton = page.locator('button:has-text("Save Changes")');
    this.createdDate = page.locator('text=Created');
  }

  async goto() {
    await this.page.goto('/settings/profile');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10000 });
  }
}
