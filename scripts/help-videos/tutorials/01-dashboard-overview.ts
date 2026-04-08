import { Page } from 'playwright';
import { CONFIG } from '../config';

/**
 * Tutorial: Dashboard Overview
 * Shows the dashboard layout, stat cards, recent tasks, and navigation.
 */
export async function record(page: Page): Promise<void> {
  // Navigate to dashboard
  await page.goto(`${CONFIG.baseURL}/dashboard`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(CONFIG.pauseLong);

  // Hover over stat cards to show interactivity
  const statCards = page.locator('.stat-card');
  const count = await statCards.count();
  for (let i = 0; i < Math.min(count, 4); i++) {
    await statCards.nth(i).hover();
    await page.waitForTimeout(CONFIG.pauseShort);
  }

  // Scroll down to show more content
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(CONFIG.pauseMedium);

  // Click on a project in sidebar to show navigation
  const projectLink = page.locator('app-sidebar-projects a.project-item').first();
  if (await projectLink.isVisible()) {
    await projectLink.hover();
    await page.waitForTimeout(CONFIG.pauseShort);
  }

  // Go back to dashboard
  await page.goto(`${CONFIG.baseURL}/dashboard`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(CONFIG.pauseMedium);

  // Show the sidebar navigation items
  const navItems = ['Home', 'My Work', 'Reports'];
  for (const label of navItems) {
    const link = page.locator(`nav a:has-text("${label}"), a:has-text("${label}")`).first();
    if (await link.isVisible()) {
      await link.hover();
      await page.waitForTimeout(CONFIG.pauseShort);
    }
  }

  await page.waitForTimeout(CONFIG.pauseLong);
}
