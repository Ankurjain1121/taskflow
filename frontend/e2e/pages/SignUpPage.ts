import { Page, Locator, expect } from '@playwright/test';

export class SignUpPage {
  readonly page: Page;
  readonly container: Locator;
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
    // Scope all locators to the sign-up component to avoid conflicts with sign-in
    this.container = page.locator('app-sign-up');
    this.nameInput = this.container.locator('input[formControlName="name"]');
    this.emailInput = this.container.locator('input[formControlName="email"]');
    this.passwordInput = this.container.locator('input[formControlName="password"]');
    this.confirmPasswordInput = this.container.locator('input[formControlName="confirmPassword"]');
    this.submitButton = this.container.locator('button[type="submit"]');
    this.errorMessage = this.container.locator('.bg-red-50 span');
    this.signInLink = this.container.locator('a[routerLink="/auth/sign-in"]');
    this.formTitle = this.container.locator('.form-title');
  }

  async goto() {
    // Direct navigation to /auth/sign-up gets intercepted by the HTTP interceptor.
    // Navigate to sign-in first, then click the sign-up link.
    await this.page.goto('/auth/sign-in');
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.locator('a:has-text("Sign up")').first().click();
    await this.page.waitForURL('**/auth/sign-up', { timeout: 10000 });
    // Wait for the sign-up component to fully mount
    await this.container.waitFor({ timeout: 10000 });
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
