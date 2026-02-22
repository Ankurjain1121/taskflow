import { Page, Locator, expect } from '@playwright/test';

export class DiscoverPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly description: Locator;
  readonly workspaceCards: Locator;
  readonly joinButtons: Locator;
  readonly emptyState: Locator;
  readonly emptyStateHeading: Locator;
  readonly loadingSkeletons: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Discover Workspaces")');
    this.description = page.locator(
      'text=Browse and join open workspaces in your organization',
    );
    this.workspaceCards = page.locator(
      'app-discover-workspaces .rounded-xl.border',
    );
    this.joinButtons = page.locator(
      'app-discover-workspaces button:has-text("Join")',
    );
    this.emptyState = page.locator('text=No workspaces to discover');
    this.emptyStateHeading = page.locator(
      'h3:has-text("No workspaces to discover")',
    );
    this.loadingSkeletons = page.locator(
      'app-discover-workspaces .skeleton',
    );
    this.errorMessage = page.locator('app-discover-workspaces .bg-red-50');
  }

  async goto() {
    await this.page.goto('/discover');
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

  async getWorkspaceCount(): Promise<number> {
    return await this.workspaceCards.count();
  }

  async getJoinButtonCount(): Promise<number> {
    return await this.joinButtons.count();
  }

  async expectContentOrEmptyState() {
    // Either workspace cards or empty state should appear
    const hasCards = this.workspaceCards.first();
    const hasEmpty = this.emptyStateHeading;
    await expect(hasCards.or(hasEmpty)).toBeVisible({ timeout: 15000 });
  }
}
