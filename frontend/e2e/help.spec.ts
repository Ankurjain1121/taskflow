import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';
import { HelpPage } from './pages/HelpPage';

test.describe('Help Page', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Help Test WS');
  });

  test('page loads with Help heading', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();
  });

  test('Getting Started section is visible with numbered steps', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    await expect(helpPage.gettingStartedSection).toBeVisible({ timeout: 10000 });

    // Should have 4 numbered steps
    await expect(page.locator('text=Create a Workspace')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Add a Board')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Create Tasks')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Invite Your Team')).toBeVisible({ timeout: 10000 });
  });

  test('Features section shows feature cards', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    await expect(helpPage.featuresSection).toBeVisible({ timeout: 10000 });

    // Should show feature titles
    await expect(page.locator('text=Kanban Boards')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Time Tracking')).toBeVisible({ timeout: 10000 });
  });

  test('Keyboard Shortcuts section is present', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    await expect(helpPage.shortcutsSection).toBeVisible({ timeout: 10000 });
  });

  test('FAQ section has expandable details elements', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    // FAQ items are <details> elements
    const faqCount = await helpPage.faqItems.count();
    expect(faqCount).toBeGreaterThanOrEqual(1);
  });

  test('clicking FAQ item expands the answer', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    const firstFaq = helpPage.faqItems.first();
    const summary = firstFaq.locator('summary');

    // Initially closed
    await expect(firstFaq).not.toHaveAttribute('open', '', { timeout: 5000 });

    // Click to expand
    await summary.click();

    // Should now be open
    await expect(firstFaq).toHaveAttribute('open', '', { timeout: 5000 });
  });

  test('clicking FAQ item again collapses the answer', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    const firstFaq = helpPage.faqItems.first();
    const summary = firstFaq.locator('summary');

    // Open it
    await summary.click();
    await expect(firstFaq).toHaveAttribute('open', '', { timeout: 5000 });

    // Close it
    await summary.click();
    await expect(firstFaq).not.toHaveAttribute('open', '', { timeout: 5000 });
  });

  test('multiple FAQ items can be open simultaneously', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    const faqCount = await helpPage.faqItems.count();
    if (faqCount >= 2) {
      // Open first FAQ
      await helpPage.faqItems.nth(0).locator('summary').click();
      await expect(helpPage.faqItems.nth(0)).toHaveAttribute('open', '', { timeout: 5000 });

      // Open second FAQ
      await helpPage.faqItems.nth(1).locator('summary').click();
      await expect(helpPage.faqItems.nth(1)).toHaveAttribute('open', '', { timeout: 5000 });

      // First should still be open
      await expect(helpPage.faqItems.nth(0)).toHaveAttribute('open', '', { timeout: 5000 });
    }
  });

  test('Feedback section has mailto email link', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    await expect(helpPage.feedbackSection).toBeVisible({ timeout: 10000 });
    await expect(helpPage.feedbackLink).toBeVisible({ timeout: 10000 });
    await expect(helpPage.feedbackLink).toHaveAttribute('href', 'mailto:support@paraslace.in');
  });

  test('all major section headings are visible', async ({ page }) => {
    const helpPage = new HelpPage(page);
    await helpPage.goto();
    await helpPage.expectLoaded();

    // All h2 section headings
    await expect(page.locator('h2:has-text("Getting Started")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Features")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Keyboard Shortcuts")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("FAQ")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Feedback")')).toBeVisible({ timeout: 10000 });
  });
});
