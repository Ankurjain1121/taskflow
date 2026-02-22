import { Page, Locator, expect } from '@playwright/test';

export class WorkspaceSettingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly description: Locator;
  readonly loadingSpinner: Locator;

  // Tabs
  readonly generalTab: Locator;
  readonly membersTab: Locator;
  readonly teamsTab: Locator;
  readonly integrationsTab: Locator;
  readonly advancedTab: Locator;

  // Members list
  readonly membersTable: Locator;
  readonly memberRows: Locator;
  readonly memberRoleBadges: Locator;
  readonly memberRoleDropdowns: Locator;
  readonly inviteButton: Locator;
  readonly memberSearchInput: Locator;

  // Pending Invitations
  readonly pendingInvitationsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Workspace Settings")');
    this.description = page.locator(
      'text=Manage your workspace settings and members',
    );
    this.loadingSpinner = page.locator('.animate-spin');

    // PrimeNG Tabs use p-tab elements
    this.generalTab = page.locator('p-tab:has-text("General")');
    this.membersTab = page.locator('p-tab:has-text("Members")');
    this.teamsTab = page.locator('p-tab:has-text("Teams")');
    this.integrationsTab = page.locator('p-tab:has-text("Integrations")');
    this.advancedTab = page.locator('p-tab:has-text("Advanced")');

    // Members list (inside members tab panel)
    this.membersTable = page.locator('app-members-list table');
    this.memberRows = page.locator('app-members-list tbody tr');
    this.memberRoleBadges = page.locator(
      'app-members-list .rounded-full.text-xs.font-medium',
    );
    this.memberRoleDropdowns = page.locator('app-members-list select');
    this.inviteButton = page.locator('button:has-text("Invite")');
    this.memberSearchInput = page.locator(
      'input[placeholder*="Search members"]',
    );

    // Pending invitations section
    this.pendingInvitationsHeading = page.locator(
      'h3:has-text("Pending Invitations")',
    );
  }

  async goto(workspaceId: string) {
    await this.page.goto(`/workspace/${workspaceId}/settings`);
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

  async clickMembersTab() {
    await this.membersTab.click();
    // Wait for the members content to appear (table or search input)
    await expect(this.memberSearchInput).toBeVisible({
      timeout: 10000,
    });
  }

  async clickTeamsTab() {
    await this.teamsTab.click();
    // Wait for teams content to appear
    await expect(
      this.page.locator('app-teams-list h2:has-text("Teams")'),
    ).toBeVisible({ timeout: 10000 });
  }

  async getMemberCount(): Promise<number> {
    return await this.memberRows.count();
  }

  async getMemberRoleTexts(): Promise<string[]> {
    const badges = this.memberRoleBadges;
    const count = await badges.count();
    const roles: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await badges.nth(i).textContent();
      if (text) roles.push(text.trim());
    }
    return roles;
  }
}
