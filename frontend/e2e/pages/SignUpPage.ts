import { Page, Locator, expect } from '@playwright/test';

export class SignUpPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signInLink: Locator;
  readonly formTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input[formControlName="name"]');
    this.emailInput = page.locator('input[formControlName="email"]');
    this.passwordInput = page.locator('input[formControlName="password"]');
    this.confirmPasswordInput = page.locator('input[formControlName="confirmPassword"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.bg-red-50 span');
    this.signInLink = page.locator('a[routerLink="/auth/sign-in"]');
    this.formTitle = page.locator('.form-title');
  }

  async goto() {
    await this.page.goto('/auth/sign-up');
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm(name: string, email: string, password: string, confirmPassword?: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword ?? password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectOnOnboarding() {
    await expect(this.page).toHaveURL(/\/onboarding/, { timeout: 15000 });
  }

  async expectErrorVisible() {
    await expect(this.errorMessage).toBeVisible({ timeout: 10000 });
  }
}
