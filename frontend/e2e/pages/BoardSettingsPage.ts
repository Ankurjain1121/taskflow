import { Page, Locator, expect } from '@playwright/test';

export class BoardSettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly description: Locator;
  readonly loadingSpinner: Locator;
  readonly backToBoardLink: Locator;

  // General section
  readonly generalHeading: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly saveChangesButton: Locator;

  // Members section
  readonly boardMembersHeading: Locator;
  readonly addMemberButton: Locator;
  readonly membersTable: Locator;
  readonly memberRows: Locator;
  readonly roleDropdowns: Locator;
  readonly removeMemberButtons: Locator;
  readonly noMembersMessage: Locator;

  // Danger Zone
  readonly dangerZone: Locator;
  readonly deleteBoardButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Board Settings")');
    this.description = page.locator(
      "text=Configure your board's settings, columns, and members",
    );
    this.loadingSpinner = page.locator('app-board-settings .animate-spin');
    this.backToBoardLink = page.locator('a:has-text("Back to Board")');

    // General section
    this.generalHeading = page.locator('h2:has-text("General")');
    this.nameInput = page.locator('#name');
    this.descriptionInput = page.locator('#description');
    this.saveChangesButton = page.locator('button:has-text("Save Changes")');

    // Members section
    this.boardMembersHeading = page.locator('h3:has-text("Board Members")');
    this.addMemberButton = page.locator('button:has-text("Add Member")');
    this.membersTable = page.locator(
      'section:has(h3:has-text("Board Members")) table',
    );
    this.memberRows = page.locator(
      'section:has(h3:has-text("Board Members")) tbody tr',
    );
    this.roleDropdowns = page.locator(
      'section:has(h3:has-text("Board Members")) select',
    );
    this.removeMemberButtons = page.locator(
      'section:has(h3:has-text("Board Members")) button:has-text("Remove")',
    );
    this.noMembersMessage = page
      .locator('section:has(h3:has-text("Board Members"))')
      .getByText('No members found');

    // Danger Zone
    this.dangerZone = page.locator('h2:has-text("Danger Zone")');
    this.deleteBoardButton = page.locator('button:has-text("Delete Board")');
  }

  async goto(workspaceId: string, boardId: string) {
    await this.page.goto(`/workspace/${workspaceId}/board/${boardId}/settings`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15000 });
  }

  async waitForContentLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15000 });
    // Wait for loading spinner to disappear
    try {
      await expect(this.loadingSpinner).toBeHidden({ timeout: 15000 });
    } catch {
      // spinner may not appear if data loads fast
    }
  }

  async getMemberCount(): Promise<number> {
    return await this.memberRows.count();
  }

  async getRoleDropdownCount(): Promise<number> {
    return await this.roleDropdowns.count();
  }

  async getRoleOptions(index: number): Promise<string[]> {
    const dropdown = this.roleDropdowns.nth(index);
    const options = dropdown.locator('option');
    const count = await options.count();
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text) values.push(text.trim());
    }
    return values;
  }
}
