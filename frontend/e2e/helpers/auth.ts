import { Page, expect } from '@playwright/test';

/**
 * Generate a unique test email address using the current timestamp.
 */
export function generateTestEmail(): string {
  return `e2e-test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}

/** Default test password that meets the 8-char minimum requirement. */
export const TEST_PASSWORD = 'TestPass123!';

/** Default test user display name. */
export const TEST_NAME = 'E2E Test User';

/**
 * Sign up a brand-new test user via the UI.
 * Returns the email address used so subsequent steps can sign in.
 */
export async function signUpTestUser(page: Page): Promise<string> {
  const email = generateTestEmail();

  await page.goto('/auth/sign-up');
  await page.waitForLoadState('networkidle');

  // Fill out the sign-up form
  await page.locator('input[formControlName="name"]').fill(TEST_NAME);
  await page.locator('input[formControlName="email"]').fill(email);
  await page.locator('input[formControlName="password"]').fill(TEST_PASSWORD);
  await page.locator('input[formControlName="confirmPassword"]').fill(TEST_PASSWORD);

  // Submit
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to onboarding (sign-up succeeded)
  await page.waitForURL('**/onboarding', { timeout: 15000 });

  return email;
}

/**
 * Sign in an existing test user via the UI.
 */
export async function signInTestUser(page: Page, email: string, password: string = TEST_PASSWORD): Promise<void> {
  await page.goto('/auth/sign-in');
  await page.waitForLoadState('networkidle');

  await page.locator('input[formControlName="email"]').fill(email);
  await page.locator('input[formControlName="password"]').fill(password);

  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from sign-in page
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
}

/**
 * Complete the full onboarding flow after sign-up:
 *  1. Create workspace
 *  2. Skip invite step
 *  3. Generate sample board
 *  4. Go to dashboard
 */
export async function completeOnboarding(page: Page, workspaceName: string = 'E2E Test Workspace'): Promise<void> {
  // Step 1 - Create workspace
  await expect(page.locator('text=Create Your Workspace')).toBeVisible({ timeout: 10000 });
  await page.locator('input#name').fill(workspaceName);
  await page.locator('button[type="submit"]:has-text("Continue")').click();

  // Step 2 - Invite team (skip it)
  await expect(page.locator('text=Invite Your Team')).toBeVisible({ timeout: 10000 });
  await page.locator('button:has-text("Skip this step")').click();

  // Step 3 - Generate sample board
  await expect(page.locator('text=Sample Board Preview')).toBeVisible({ timeout: 10000 });
  await page.locator('button:has-text("Generate Sample Board")').click();

  // Wait for board generation success
  await expect(page.locator('text=Sample board created successfully!')).toBeVisible({ timeout: 20000 });

  // Step 4 - Go to dashboard
  await page.locator('button:has-text("Go to Dashboard")').click();

  // Wait for dashboard to load
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
}

/**
 * Full flow: sign up + complete onboarding. Returns the email used.
 */
export async function signUpAndOnboard(page: Page, workspaceName?: string): Promise<string> {
  const email = await signUpTestUser(page);
  await completeOnboarding(page, workspaceName);
  return email;
}
