import { Page, Locator, expect } from '@playwright/test';

export class HelpPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly gettingStartedSection: Locator;
  readonly featuresSection: Locator;
  readonly shortcutsSection: Locator;
  readonly faqItems: Locator;
  readonly feedbackSection: Locator;
  readonly feedbackLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1:has-text("Help")');
    this.gettingStartedSection = page.locator('h2:has-text("Getting Started")');
    this.featuresSection = page.locator('h2:has-text("Features")');
    this.shortcutsSection = page.locator('h2:has-text("Keyboard Shortcuts")');
    this.faqItems = page.locator('details');
    this.feedbackSection = page.locator('h2:has-text("Feedback")');
    this.feedbackLink = page.locator('a[href*="mailto:"]');
  }

  async goto() {
    await this.page.goto('/help');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 10000 });
  }
}
