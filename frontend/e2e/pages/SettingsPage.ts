import { Page, Locator, expect } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly emailField: Locator;
  readonly phoneInput: Locator;
  readonly avatarUrlInput: Locator;
  readonly saveButton: Locator;
  readonly notificationsLink: Locator;
  readonly createdDate: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Profile Settings")');
    this.nameInput = page.locator('input').filter({ hasText: /display name/i }).or(page.locator('mat-form-field').filter({ hasText: /display name/i }).locator('input')).first();
    this.emailField = page.locator('mat-form-field').filter({ hasText: /email/i }).locator('input').first();
    this.phoneInput = page.locator('mat-form-field').filter({ hasText: /phone/i }).locator('input').first();
    this.avatarUrlInput = page.locator('mat-form-field').filter({ hasText: /avatar/i }).locator('input').first();
    this.saveButton = page.locator('button:has-text("Save Changes")');
    this.notificationsLink = page.locator('a[href*="/settings/notifications"]');
    this.createdDate = page.locator('text=Created');
  }

  async goto() {
    await this.page.goto('/settings/profile');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10000 });
  }
}
