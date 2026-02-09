import { Page, Locator, expect } from '@playwright/test';

export class OnboardingPage {
  readonly page: Page;

  // Workspace step
  readonly workspaceTitle: Locator;
  readonly workspaceNameInput: Locator;
  readonly workspaceDescriptionInput: Locator;
  readonly continueButton: Locator;

  // Invite step
  readonly inviteTitle: Locator;
  readonly skipButton: Locator;
  readonly sendInvitesButton: Locator;

  // Sample board step
  readonly sampleBoardTitle: Locator;
  readonly generateButton: Locator;
  readonly successMessage: Locator;
  readonly goToDashboardButton: Locator;

  // Step indicators
  readonly stepDots: Locator;

  constructor(page: Page) {
    this.page = page;
    this.workspaceTitle = page.locator('text=Create Your Workspace');
    this.workspaceNameInput = page.locator('input#name');
    this.workspaceDescriptionInput = page.locator('textarea#description');
    this.continueButton = page.locator('button[type="submit"]:has-text("Continue")');

    this.inviteTitle = page.locator('text=Invite Your Team');
    this.skipButton = page.locator('button:has-text("Skip this step")');
    this.sendInvitesButton = page.locator('button:has-text("Send Invites")');

    this.sampleBoardTitle = page.locator('text=Sample Board Preview');
    this.generateButton = page.locator('button:has-text("Generate Sample Board")');
    this.successMessage = page.locator('text=Sample board created successfully!');
    this.goToDashboardButton = page.locator('button:has-text("Go to Dashboard")');

    this.stepDots = page.locator('.rounded-full.transition-colors');
  }

  async expectWorkspaceStep() {
    await expect(this.workspaceTitle).toBeVisible({ timeout: 10000 });
  }

  async createWorkspace(name: string, description?: string) {
    await this.workspaceNameInput.fill(name);
    if (description) {
      await this.workspaceDescriptionInput.fill(description);
    }
    await this.continueButton.click();
  }

  async expectInviteStep() {
    await expect(this.inviteTitle).toBeVisible({ timeout: 10000 });
  }

  async skipInvite() {
    await this.skipButton.click();
  }

  async expectSampleBoardStep() {
    await expect(this.sampleBoardTitle).toBeVisible({ timeout: 10000 });
  }

  async generateSampleBoard() {
    await this.generateButton.click();
    await expect(this.successMessage).toBeVisible({ timeout: 20000 });
  }

  async goToDashboard() {
    await this.goToDashboardButton.click();
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  }
}
