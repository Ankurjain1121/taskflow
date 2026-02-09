import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly welcomeHeading: Locator;
  readonly subtitle: Locator;
  readonly myTasksLink: Locator;
  readonly statsCards: Locator;
  readonly totalTasksStat: Locator;
  readonly overdueStat: Locator;
  readonly dueTodayStat: Locator;
  readonly completedStat: Locator;
  readonly workspaceCards: Locator;
  readonly workspacesHeading: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeHeading = page.locator('h1:has-text("Welcome back")');
    this.subtitle = page.locator('text=Here\'s an overview of your workspaces');
    this.myTasksLink = page.locator('a[routerLink="/my-tasks"]');
    this.statsCards = page.locator('.grid .rounded-xl.shadow-sm');
    this.totalTasksStat = page.locator('text=Total Tasks');
    this.overdueStat = page.locator('text=Overdue');
    this.dueTodayStat = page.locator('text=Due Today');
    this.completedStat = page.locator('text=Completed This Week');
    this.workspaceCards = page.locator('.hover\\:shadow-md');
    this.workspacesHeading = page.getByRole('heading', { name: 'Your Workspaces' });
    this.loadingSpinner = page.locator('.animate-spin');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.welcomeHeading).toBeVisible({ timeout: 15000 });
  }

  async expectStatsVisible() {
    await expect(this.totalTasksStat).toBeVisible({ timeout: 10000 });
    await expect(this.overdueStat).toBeVisible();
    await expect(this.dueTodayStat).toBeVisible();
    await expect(this.completedStat).toBeVisible();
  }

  async waitForContentLoaded() {
    // Wait for loading spinner to disappear, indicating data has arrived
    await expect(this.loadingSpinner).toBeHidden({ timeout: 20000 });
  }

  async expectWorkspacesVisible() {
    await this.waitForContentLoaded();
    await expect(this.workspacesHeading).toBeVisible({ timeout: 10000 });
  }

  async getWorkspaceCount(): Promise<number> {
    await this.waitForContentLoaded();
    // Count workspace cards by looking for "Open Workspace" links
    return await this.page.locator('a:has-text("Open Workspace")').count();
  }

  async clickFirstWorkspace() {
    await this.waitForContentLoaded();
    await this.page.locator('a:has-text("Open Workspace")').first().click();
  }
}
