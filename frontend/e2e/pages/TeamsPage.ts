import { Page, Locator, expect } from '@playwright/test';

export class TeamsPage {
  readonly page: Page;

  // Teams list
  readonly teamsHeading: Locator;
  readonly teamsDescription: Locator;
  readonly createTeamButton: Locator;
  readonly teamCards: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  // Create/Edit Team Dialog
  readonly dialogHeader: Locator;
  readonly teamNameInput: Locator;
  readonly teamDescriptionInput: Locator;
  readonly colorButtons: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteTeamButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Teams list section (inside app-teams-list)
    this.teamsHeading = page.locator('app-teams-list h2:has-text("Teams")');
    this.teamsDescription = page.locator(
      'text=Organize your workspace members into teams',
    );
    this.createTeamButton = page.locator(
      'app-teams-list p-button:has-text("Create Team")',
    );
    this.teamCards = page.locator(
      'app-teams-list .border.rounded-xl.cursor-pointer',
    );
    this.emptyState = page.locator('text=No teams yet');
    this.loadingSpinner = page.locator('app-teams-list .animate-spin');

    // Dialog elements (PrimeNG p-dialog)
    this.dialogHeader = page.locator(
      'p-dialog .p-dialog-title, p-dialog [class*="dialog-title"]',
    );
    this.teamNameInput = page.locator('#teamName');
    this.teamDescriptionInput = page.locator('#teamDesc');
    this.colorButtons = page.locator(
      'app-team-detail-dialog button[aria-label^="Select color"]',
    );
    this.submitButton = page.locator(
      'app-team-detail-dialog p-button:has-text("Create Team"), app-team-detail-dialog p-button:has-text("Save Changes")',
    );
    this.cancelButton = page.locator(
      'app-team-detail-dialog p-button:has-text("Cancel")',
    );
    this.deleteTeamButton = page.locator(
      'app-team-detail-dialog p-button:has-text("Delete Team")',
    );
  }

  async expectLoaded() {
    await expect(this.teamsHeading).toBeVisible({ timeout: 10000 });
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible({ timeout: 10000 });
  }

  async getTeamCount(): Promise<number> {
    return await this.teamCards.count();
  }

  async openCreateDialog() {
    await this.createTeamButton.click();
    await expect(this.teamNameInput).toBeVisible({ timeout: 10000 });
    // Wait for onDialogShow() to finish resetting the form
    await this.page.waitForTimeout(500);
  }

  async fillTeamForm(name: string, description?: string) {
    await this.teamNameInput.fill(name);
    if (description) {
      await this.teamDescriptionInput.fill(description);
    }
  }

  async selectColor(index: number) {
    const btn = this.colorButtons.nth(index);
    await btn.click();
  }

  async submitCreateForm() {
    const createBtn = this.page.locator(
      'app-team-detail-dialog p-button:has-text("Create Team")',
    );
    await createBtn.click();
  }

  async clickTeamCard(index: number) {
    await this.teamCards.nth(index).click();
  }

  async getTeamNames(): Promise<string[]> {
    const cards = this.teamCards;
    const count = await cards.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const nameEl = cards.nth(i).locator('h3');
      const text = await nameEl.textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }
}
