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
 * Retries on rate-limit (429) or transient failures with delays.
 */
export async function signUpTestUser(page: Page): Promise<string> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const email = generateTestEmail();

    // Wait between retries to let the rate-limit window (5 req/60s) expire
    if (attempt > 1) {
      await page.waitForTimeout(15000);
    }

    // Navigate to sign-in first (direct /auth/sign-up gets redirected by the HTTP interceptor)
    await page.goto('/auth/sign-in');
    await page.waitForLoadState('domcontentloaded');

    // Click the "Sign up" link to navigate to the sign-up form
    await page.locator('a:has-text("Sign up")').first().click();
    await page.waitForURL('**/auth/sign-up', { timeout: 10000 });
    // Wait for sign-up component to mount (avoid duplicate element conflicts)
    await page.locator('app-sign-up').waitFor({ timeout: 10000 });

    // Fill out the sign-up form (scoped to sign-up component)
    const signUp = page.locator('app-sign-up');
    await signUp.locator('input[formControlName="name"]').fill(TEST_NAME);
    await signUp.locator('input[formControlName="email"]').fill(email);
    await signUp
      .locator('p-password[formControlName="password"] input')
      .fill(TEST_PASSWORD);
    await signUp
      .locator('p-password[formControlName="confirmPassword"] input')
      .fill(TEST_PASSWORD);

    // Submit
    await signUp.locator('button[type="submit"]').click();

    // Wait for either redirect to onboarding or an error/timeout
    try {
      await page.waitForURL('**/onboarding', { timeout: 20000 });
      return email;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(
          `Sign-up failed after ${maxAttempts} attempts. URL: ${page.url()}`,
        );
      }
      // Retry with a new email on next iteration
    }
  }

  throw new Error('Sign-up failed unexpectedly');
}

/**
 * Sign in an existing test user via the UI.
 * If skipNavigation is true, assumes the page is already on the sign-in form.
 */
export async function signInTestUser(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD,
  skipNavigation = false,
): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!skipNavigation || attempt > 1) {
      await page.goto('/auth/sign-in');
      await page.waitForLoadState('domcontentloaded');
    }

    // Small delay between retry attempts to let the server recover
    if (attempt > 1) {
      await page.waitForTimeout(2000);
    }

    // Wait for the sign-in form to be interactive
    const emailInput = page
      .locator('input[type="email"], input[formControlName="email"]')
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(email);

    const passwordInput = page
      .locator('p-password input[type="password"], input[type="password"]')
      .first();
    await passwordInput.fill(password);

    // Wait for submit button to be enabled
    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Wait for redirect away from sign-in page
    try {
      await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 25000 });
      return; // Success
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(
          `Sign-in failed after ${maxAttempts} attempts for ${email}. Still on: ${page.url()}`,
        );
      }
      // Retry on next iteration
    }
  }
}

/**
 * Complete the full onboarding flow after sign-up:
 *  1. Create workspace
 *  2. Skip invite step
 *  3. Generate sample board
 *  4. Go to dashboard
 */
export async function completeOnboarding(
  page: Page,
  workspaceName: string = 'E2E Test Workspace',
): Promise<void> {
  // Step 1 - Create workspace
  await expect(page.locator('text=Create Your Workspace')).toBeVisible({
    timeout: 10000,
  });
  await page.locator('app-step-workspace input#name').fill(workspaceName);
  await page.locator('button[type="submit"]:has-text("Continue")').click();

  // Step 2 - Invite team (skip it)
  await expect(page.locator('text=Invite Your Team')).toBeVisible({
    timeout: 10000,
  });
  await page.locator('button:has-text("Skip this step")').click();

  // Step 3 - Generate sample board
  await expect(page.locator('text=Sample Board Preview')).toBeVisible({
    timeout: 10000,
  });
  await page.locator('button:has-text("Generate Sample Board")').click();

  // Wait for board generation success
  await expect(
    page.locator('text=Sample board created successfully!'),
  ).toBeVisible({ timeout: 20000 });

  // Step 4 - Go to dashboard
  const goToDashboard = page.locator('button:has-text("Go to Dashboard")');
  await expect(goToDashboard).toBeVisible({ timeout: 10000 });
  await goToDashboard.click();

  // Wait for dashboard to load (may take a moment for onboarding finalization)
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  // Dashboard shows a time-based greeting like "Good morning, E2E Test User"
  await expect(
    page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first(),
  ).toBeVisible({ timeout: 10000 });
}

/**
 * Full flow: sign up + complete onboarding. Returns the email used.
 */
export async function signUpAndOnboard(
  page: Page,
  workspaceName?: string,
): Promise<string> {
  const email = await signUpTestUser(page);
  await completeOnboarding(page, workspaceName);
  return email;
}
