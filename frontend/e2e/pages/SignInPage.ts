import { Page, Locator, expect } from '@playwright/test';

export class SignInPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signUpLink: Locator;
  readonly forgotPasswordLink: Locator;
  readonly formTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[formControlName="email"]');
    this.passwordInput = page.locator('input[formControlName="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.bg-red-50 span');
    this.signUpLink = page.locator('a[routerLink="/auth/sign-up"]');
    this.forgotPasswordLink = page.locator('a[routerLink="/auth/forgot-password"]');
    this.formTitle = page.locator('.form-title');
  }

  async goto() {
    await this.page.goto('/auth/sign-in');
    await this.page.waitForLoadState('networkidle');
  }

  async fillForm(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectRedirectedToDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  }

  async expectRedirectedToOnboarding() {
    await expect(this.page).toHaveURL(/\/onboarding/, { timeout: 15000 });
  }

  async expectErrorVisible() {
    await expect(this.errorMessage).toBeVisible({ timeout: 10000 });
  }
}
