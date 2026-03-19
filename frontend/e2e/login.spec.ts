import { test, expect } from '@playwright/test';
import {
  signInTestUser,
  signUpAndOnboard,
  TEST_PASSWORD,
} from './helpers/auth';
import { SignInPage } from './pages/SignInPage';

/**
 * E2E Journey: Login Flow
 *
 * Tests the complete login experience including:
 * - Navigating to sign-in page
 * - Filling credentials and submitting
 * - Verifying redirect to dashboard
 * - Sidebar and workspace visibility after login
 * - Invalid credentials error handling
 */

test.describe('Login Journey', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    // Create a fully onboarded test user so sign-in lands on /dashboard
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    testEmail = await signUpAndOnboard(page, 'Login Journey WS');
    await context.close();
  });

  test('navigate to sign-in page and verify form elements', async ({
    page,
  }) => {
    await page.goto('/auth/sign-in');
    await page.waitForLoadState('domcontentloaded');

    // Verify the sign-in form title is visible
    const signInPage = new SignInPage(page);
    await expect(signInPage.formTitle).toHaveText('Welcome back');

    // Email and password inputs should be present
    await expect(signInPage.emailInput).toBeVisible({ timeout: 10000 });
    await expect(signInPage.passwordInput).toBeVisible({ timeout: 10000 });

    // Submit button should be visible but disabled (empty form)
    await expect(signInPage.submitButton).toBeVisible();
    await expect(signInPage.submitButton).toBeDisabled();
  });

  test('fill credentials and submit redirects to dashboard', async ({
    page,
  }) => {
    // Navigate to sign-in
    await page.goto('/auth/sign-in');
    await page.waitForLoadState('domcontentloaded');

    // Fill email and password
    const signInPage = new SignInPage(page);
    await signInPage.fillForm(testEmail, TEST_PASSWORD);

    // Submit button should now be enabled
    await expect(signInPage.submitButton).toBeEnabled({ timeout: 5000 });
    await signInPage.submit();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
  });

  test('sidebar visible and workspace name shown after login', async ({
    page,
  }) => {
    // Sign in
    await signInTestUser(page, testEmail, TEST_PASSWORD);

    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });

    // Sidebar should be visible (contains workspace items)
    const sidebar = page.locator('app-sidebar, nav, aside').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Project items should appear in the sidebar
    const projectItem = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectItem).toBeVisible({ timeout: 10000 });
    const projectText = await projectItem.textContent();
    expect(projectText?.trim().length).toBeGreaterThan(0);
  });

  test('invalid credentials show error message', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();

    // Fill with invalid credentials
    await signInPage.fillForm('nonexistent@example.com', 'WrongPassword1!');
    await signInPage.submit();

    // Error message should appear
    await signInPage.expectErrorVisible();
    await expect(signInPage.errorMessage).toContainText(
      'Invalid email or password',
    );

    // Should still be on sign-in page
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('wrong password for valid email shows error', async ({ page }) => {
    const signInPage = new SignInPage(page);
    await signInPage.goto();

    // Use valid email but wrong password
    await signInPage.fillForm(testEmail, 'TotallyWrong123!');
    await signInPage.submit();

    // Should show error and remain on sign-in page
    await signInPage.expectErrorVisible();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});
