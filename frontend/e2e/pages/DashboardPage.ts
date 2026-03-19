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
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    // Dashboard greeting is time-based: "Good morning/afternoon/evening, Name"
    this.welcomeHeading = page.locator(
      'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
    );
    this.subtitle = page.locator(
      "text=Here's what's happening across your projects",
    );
    this.myTasksLink = page.locator('a[href="/my-tasks"]');
    this.statsCards = page.locator('.grid .rounded-xl.shadow-sm');
    this.totalTasksStat = page.locator('text=Total Tasks');
    this.overdueStat = page.locator('text=Overdue');
    this.dueTodayStat = page.locator('text=Due Today');
    this.completedStat = page.locator('text=Completed This Week');
    this.loadingSpinner = page.locator('.animate-spin');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.welcomeHeading.first()).toBeVisible({ timeout: 15000 });
  }

  async expectStatsVisible() {
    await expect(this.totalTasksStat).toBeVisible({ timeout: 10000 });
    await expect(this.overdueStat.first()).toBeVisible();
    await expect(this.dueTodayStat).toBeVisible();
    await expect(this.completedStat).toBeVisible();
  }

  async waitForContentLoaded() {
    // Wait for loading spinner to disappear if it appears, or content to be ready
    const spinnerVisible = await this.loadingSpinner
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (spinnerVisible) {
      await expect(this.loadingSpinner).toBeHidden({ timeout: 20000 });
    }
    // Give a moment for content to render
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectProjectsVisible() {
    await this.waitForContentLoaded();
    const projectItem = this.page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectItem).toBeVisible({ timeout: 10000 });
  }

  async getProjectCount(): Promise<number> {
    await this.waitForContentLoaded();
    return await this.page.locator('app-sidebar-projects a.project-item').count();
  }

  async clickFirstProject() {
    await this.waitForContentLoaded();
    await this.page.locator('app-sidebar-projects a.project-item').first().click();
  }
}
