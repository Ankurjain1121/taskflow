import { Page, Locator, expect } from '@playwright/test';

export class TeamOverviewPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly description: Locator;
  readonly memberCards: Locator;
  readonly loadingSkeletons: Locator;
  readonly errorState: Locator;
  readonly emptyState: Locator;
  readonly emptyStateHeading: Locator;
  readonly overloadBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Team Overview")');
    this.description = page.locator(
      "text=Monitor your team's workload and task distribution",
    );
    this.memberCards = page.locator('app-member-workload-card');
    this.loadingSkeletons = page.locator(
      'app-team-overview .skeleton',
    );
    this.errorState = page.locator(
      'text=Failed to load team workload',
    );
    this.emptyState = page.locator('text=Build your team');
    this.emptyStateHeading = page.locator('h3:has-text("Build your team")');
    this.overloadBanner = page.locator('app-overload-banner');
  }

  async goto(workspaceId: string) {
    await this.page.goto(`/workspace/${workspaceId}/team`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15000 });
  }

  async waitForContentLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15000 });
    // Wait for loading skeletons to disappear
    try {
      await expect(this.loadingSkeletons.first()).toBeHidden({
        timeout: 15000,
      });
    } catch {
      // skeletons may not appear if data loads fast
    }
  }

  async expectContentOrEmptyState() {
    const hasCards = this.memberCards.first();
    const hasEmpty = this.emptyStateHeading;
    await expect(hasCards.or(hasEmpty)).toBeVisible({ timeout: 15000 });
  }

  async getMemberCount(): Promise<number> {
    return await this.memberCards.count();
  }
}
