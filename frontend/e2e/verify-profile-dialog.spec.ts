import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { TEST_NAME } from './helpers/auth';
import {
  apiSignUp,
  apiCompleteOnboarding,
  apiCreateBoard,
} from './helpers/data-factory';

/**
 * Quick E2E verification:
 * 1. Sign in (create a new account via API)
 * 2. Navigate to Team page (sidebar "Team" link)
 * 3. Click "Members" tab to see org members table
 * 4. Click a member ROW -> "Member Profile" dialog should appear
 * 5. Screenshot -> /home/ankur/taskflow/verify-profile-dialog.png
 * 6. Go to Workload tab, click a member card -> navigates to member detail page
 * 7. Screenshot -> /home/ankur/taskflow/verify-member-nav.png
 */

test.describe('Team Page - Profile Dialog & Workload Navigation', () => {
  test.setTimeout(120_000);

  let storagePath: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);

    // Use API to create account + workspace (faster than UI onboarding)
    const baseURL =
      process.env['BASE_URL'] || 'https://taskflow.paraslace.in';
    const context = await browser.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
    });

    const apiCtx = context.request;
    const email = `e2e-verify-${Date.now()}@example.com`;
    const password = 'TestPass123!';

    // Sign up via API
    const { cookies } = await apiSignUp(apiCtx, TEST_NAME, email, password);

    // Create workspace via API
    await apiCompleteOnboarding(apiCtx, cookies, 'VerifyDialog WS');

    // Now sign in via browser to get proper session cookies stored
    const page = await context.newPage();
    await page.goto('/auth/sign-in');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page
      .locator('input[type="email"], input[formControlName="email"]')
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(email);

    const passwordInput = page
      .locator('p-password input[type="password"], input[type="password"]')
      .first();
    await passwordInput.fill(password);

    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Wait for redirect away from sign-in
    await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 25000 });

    // If redirected to onboarding, handle it quickly
    if (page.url().includes('/onboarding')) {
      // Skip through the onboarding steps
      // Step 1: workspace (may already be done via API)
      const createWsVisible = await page
        .locator('text=Create Your Workspace')
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (createWsVisible) {
        await page
          .locator('app-step-workspace input[formControlName="name"]')
          .fill('VerifyDialog WS');
        await page
          .locator('button[type="submit"]:has-text("Continue")')
          .click();
      }

      // Step 2: invite
      const inviteVisible = await page
        .locator('text=Invite Your Team')
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (inviteVisible) {
        await page.locator('button:has-text("Skip this step")').click();
      }

      // Step 3: sample board - scroll to button and click
      const sampleBoardVisible = await page
        .locator('text=Sample Board Preview')
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (sampleBoardVisible) {
        const genBtn = page.locator(
          'button:has-text("Generate Sample Board")',
        );
        await genBtn.scrollIntoViewIfNeeded();
        await genBtn.click();

        // Wait for success or error (60s)
        const success = page.locator(
          'text=Sample board created successfully!',
        );
        const errorMsg = page.locator('text=Failed to generate');

        await expect(success.or(errorMsg)).toBeVisible({ timeout: 60000 });

        const goBtn = page.locator('button:has-text("Go to your board"), button:has-text("Go to Dashboard")').first();
        if (await goBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await goBtn.click();
          await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        }
      }
    }

    // Wait for dashboard to load (if we didn't get there yet)
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard');
    }
    await page.waitForLoadState('domcontentloaded');

    // Save storage state
    const resultsDir = path.join(__dirname, '..', 'e2e-artifacts');
    fs.mkdirSync(resultsDir, { recursive: true });
    storagePath = path.join(resultsDir, '.verify-dialog-auth.json');
    await context.storageState({ path: storagePath });
    await page.close();
    await context.close();
  });

  test('Members tab: clicking row opens Member Profile dialog', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: storagePath,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    // Step 2: Navigate to Team page via sidebar
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    const teamLink = page.locator('a[href="/team"]').first();
    await expect(teamLink).toBeVisible({ timeout: 15000 });
    await teamLink.click();

    await expect(page).toHaveURL(/\/team/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // Step 3: Click "Members" tab
    const membersTab = page.locator('p-tab:has-text("Members")');
    await expect(membersTab).toBeVisible({ timeout: 10000 });
    await membersTab.click();

    // Wait for org members table to load (lazy-loaded on tab switch)
    const membersTable = page.locator('app-org-members table');
    await expect(membersTable).toBeVisible({ timeout: 25000 });

    // Wait for at least one member row in the tbody
    const memberRows = page.locator('app-org-members tbody tr');
    await expect(memberRows.first()).toBeVisible({ timeout: 15000 });

    // Step 4: Click on the member ROW -- on the Name/Email cell (not checkbox or actions)
    const firstRowNameCell = memberRows.first().locator('td').nth(1);
    await firstRowNameCell.click();

    // Step 5: Verify the "Member Profile" dialog appears
    const dialogHeader = page.locator(
      '.p-dialog-title:has-text("Member Profile")',
    );
    await expect(dialogHeader).toBeVisible({ timeout: 10000 });

    // Verify dialog content shows user name
    const dialogContent = page.locator('.p-dialog-content');
    await expect(dialogContent.locator(`text=${TEST_NAME}`)).toBeVisible({
      timeout: 5000,
    });

    // Verify "Workspaces" section inside dialog
    await expect(
      dialogContent.locator('h4:has-text("Workspaces")'),
    ).toBeVisible({ timeout: 10000 });

    // Wait for workspaces to load inside the profile dialog
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({
      path: '/home/ankur/taskflow/verify-profile-dialog.png',
      fullPage: false,
    });

    await page.close();
    await context.close();
  });

  test('Workload tab: clicking member card navigates to member detail', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: storagePath,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    // Navigate to Team page
    await page.goto('/team');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1:has-text("Team")')).toBeVisible({
      timeout: 10000,
    });

    // Wait for initial data loading
    await page.waitForTimeout(3000);

    // Click "Workload" tab
    const workloadTab = page.locator('p-tab:has-text("Workload")');
    await expect(workloadTab).toBeVisible({ timeout: 10000 });
    await workloadTab.click();

    // Wait for workload content
    await page.waitForTimeout(2000);

    // The workload tab shows member cards as <a> with routerLink to /team/member/
    const memberCard = page.locator('a[href*="/team/member/"]').first();
    const emptyState = page.locator('text=No workload data');

    // Wait for either member cards or empty state
    await expect(memberCard.or(emptyState)).toBeVisible({ timeout: 15000 });

    const hasMemberCard = await memberCard.isVisible().catch(() => false);

    if (hasMemberCard) {
      // Click the member card
      await memberCard.click();

      // Verify navigation to member detail page
      await expect(page).toHaveURL(
        /\/workspace\/[a-f0-9-]+\/team\/member\/[a-f0-9-]+/,
        { timeout: 15000 },
      );

      // Verify member detail page content
      const backLink = page.locator('a:has-text("Back to Team Overview")');
      await expect(backLink).toBeVisible({ timeout: 10000 });

      // Wait for profile content to load
      await page.waitForTimeout(2000);

      // Take screenshot of member detail page
      await page.screenshot({
        path: '/home/ankur/taskflow/verify-member-nav.png',
        fullPage: false,
      });
    } else {
      // Empty state -- take screenshot
      await page.screenshot({
        path: '/home/ankur/taskflow/verify-member-nav.png',
        fullPage: false,
      });
    }

    await page.close();
    await context.close();
  });
});
