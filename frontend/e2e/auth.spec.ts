import { test, expect } from '@playwright/test';
import { SignUpPage } from './pages/SignUpPage';
import { SignInPage } from './pages/SignInPage';
import { generateTestEmail, TEST_PASSWORD, TEST_NAME } from './helpers/auth';

test.describe('Authentication - Sign Up', () => {
  test('sign-up page loads with correct UI', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    await expect(signUpPage.formTitle).toHaveText('Create your account');
    await expect(signUpPage.nameInput).toBeVisible();
    await expect(signUpPage.emailInput).toBeVisible();
    await expect(signUpPage.passwordInput).toBeVisible();
    await expect(signUpPage.confirmPasswordInput).toBeVisible();
    await expect(signUpPage.submitButton).toBeVisible();
    await expect(signUpPage.signInLink).toBeVisible();
  });

  test('submit button is disabled when form is empty', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    await expect(signUpPage.submitButton).toBeDisabled();
  });

  test('successful sign-up redirects to onboarding', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    const email = generateTestEmail();
    await signUpPage.fillForm(TEST_NAME, email, TEST_PASSWORD);
    await signUpPage.submit();
    await signUpPage.expectOnOnboarding();
  });

  test('duplicate email shows error message', async ({ page }) => {
    // First, sign up a user
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    const email = generateTestEmail();
    await signUpPage.fillForm(TEST_NAME, email, TEST_PASSWORD);
    await signUpPage.submit();
    await signUpPage.expectOnOnboarding();

    // Now try to sign up with the same email
    await signUpPage.goto();
    await signUpPage.fillForm(TEST_NAME, email, TEST_PASSWORD);
    await signUpPage.submit();

    await signUpPage.expectErrorVisible();
    await expect(signUpPage.errorMessage).toContainText('already exists');
  });

  test('password mismatch prevents submission', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    const email = generateTestEmail();
    await signUpPage.fillForm(TEST_NAME, email, TEST_PASSWORD, 'DifferentPass123!');

    // The button should be disabled because passwords do not match
    // Touch the confirmPassword field to trigger validation
    await signUpPage.confirmPasswordInput.blur();
    await expect(signUpPage.submitButton).toBeDisabled();
  });

  test('sign-in link navigates to sign-in page', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();

    await signUpPage.signInLink.click();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe('Authentication - Sign In', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    // Create a test user to sign in with
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const signUpPage = new SignUpPage(page);
    await signUpPage.goto();
    testEmail = generateTestEmail();
    await signUpPage.fillForm(TEST_NAME, testEmail, TEST_PASSWORD);
    await signUpPage.submit();
    await signUpPage.expectOnOnboarding();
    await context.close();
  });

  test('sign-in page loads with correct UI', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();

    await expect(signInPage.formTitle).toHaveText('Welcome back');
    await expect(signInPage.emailInput).toBeVisible();
    await expect(signInPage.passwordInput).toBeVisible();
    await expect(signInPage.submitButton).toBeVisible();
    await expect(signInPage.signUpLink).toBeVisible();
    await expect(signInPage.forgotPasswordLink).toBeVisible();
  });

  test('submit button is disabled when form is empty', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();

    await expect(signInPage.submitButton).toBeDisabled();
  });

  test('successful sign-in redirects to onboarding or dashboard', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();
    await signInPage.fillForm(testEmail, TEST_PASSWORD);
    await signInPage.submit();

    // User who hasn't completed onboarding goes to /onboarding; otherwise /dashboard
    await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
  });

  test('invalid credentials show error', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();
    await signInPage.fillForm('nonexistent@example.com', 'WrongPassword1!');
    await signInPage.submit();

    await signInPage.expectErrorVisible();
    await expect(signInPage.errorMessage).toContainText('Invalid email or password');
  });

  test('sign-up link navigates to sign-up page', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();

    await signInPage.signUpLink.click();
    await expect(page).toHaveURL(/\/auth\/sign-up/);
  });
});
