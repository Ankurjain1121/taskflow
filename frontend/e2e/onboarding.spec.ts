import { test, expect } from '@playwright/test';
import { OnboardingPage } from './pages/OnboardingPage';
import { signUpTestUser } from './helpers/auth';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Sign up a fresh user which redirects to /onboarding
    await signUpTestUser(page);
  });

  test('onboarding page loads at workspace step after sign-up', async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.expectWorkspaceStep();

    // Verify key elements are present
    await expect(onboarding.workspaceNameInput).toBeVisible();
    await expect(onboarding.continueButton).toBeVisible();
  });

  test('workspace name is required', async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.expectWorkspaceStep();

    // The continue button should be disabled when workspace name is empty
    await expect(onboarding.continueButton).toBeDisabled();
  });

  test('create workspace advances to invite step', async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.expectWorkspaceStep();

    await onboarding.createWorkspace('My Test Workspace');
    await onboarding.expectInviteStep();
  });

  test('skip invite advances to sample board step', async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.expectWorkspaceStep();

    await onboarding.createWorkspace('My Test Workspace');
    await onboarding.expectInviteStep();

    await onboarding.skipInvite();
    await onboarding.expectSampleBoardStep();
  });

  test('full onboarding flow completes successfully', async ({ page }) => {
    const onboarding = new OnboardingPage(page);

    // Step 1: Create workspace
    await onboarding.expectWorkspaceStep();
    await onboarding.createWorkspace('Full Flow Workspace');

    // Step 2: Skip invite
    await onboarding.expectInviteStep();
    await onboarding.skipInvite();

    // Step 3: Generate sample board
    await onboarding.expectSampleBoardStep();
    await onboarding.generateSampleBoard();

    // Step 4: Go to dashboard
    await onboarding.goToDashboard();

    // Verify we are on the dashboard
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });
  });

  test('generate sample board shows success message', async ({ page }) => {
    const onboarding = new OnboardingPage(page);

    await onboarding.expectWorkspaceStep();
    await onboarding.createWorkspace('Sample Board Workspace');
    await onboarding.expectInviteStep();
    await onboarding.skipInvite();
    await onboarding.expectSampleBoardStep();

    // Click generate and verify success
    await page.locator('button:has-text("Generate Sample Board")').click();
    await expect(page.locator('text=Sample board created successfully!')).toBeVisible({ timeout: 20000 });

    // Verify "Go to Dashboard" button appears
    await expect(page.locator('button:has-text("Go to Dashboard")')).toBeVisible();
  });
});
