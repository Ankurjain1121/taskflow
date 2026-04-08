import { Page } from 'playwright';
import { CONFIG } from '../config';

/**
 * Tutorial: Kanban Board
 * Shows board navigation, column layout, card interactions, and view switching.
 */
export async function record(page: Page): Promise<void> {
  // Navigate to dashboard first
  await page.goto(`${CONFIG.baseURL}/dashboard`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(CONFIG.pauseShort);

  // Click on first project in sidebar
  const projectLink = page.locator('app-sidebar-projects a.project-item').first();
  if (await projectLink.isVisible()) {
    await projectLink.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(CONFIG.pauseLong);
  }

  // Show the board — hover over columns
  const columns = page.locator('.kanban-column, [class*="column"]');
  const colCount = await columns.count();
  for (let i = 0; i < Math.min(colCount, 4); i++) {
    const col = columns.nth(i);
    if (await col.isVisible()) {
      await col.hover();
      await page.waitForTimeout(CONFIG.pauseShort);
    }
  }

  // Hover over task cards to show details
  const cards = page.locator('.task-card, [class*="task-card"]');
  const cardCount = await cards.count();
  for (let i = 0; i < Math.min(cardCount, 3); i++) {
    const card = cards.nth(i);
    if (await card.isVisible()) {
      await card.hover();
      await page.waitForTimeout(CONFIG.pauseShort);
    }
  }

  // Click on a task card to show task detail
  const firstCard = cards.first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForTimeout(CONFIG.pauseLong);

    // Close the task detail (press Escape)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(CONFIG.pauseShort);
  }

  // Try switching views if view tabs exist
  const viewButtons = page.locator('button:has-text("List"), button:has-text("Calendar")');
  const listBtn = viewButtons.first();
  if (await listBtn.isVisible()) {
    await listBtn.click();
    await page.waitForTimeout(CONFIG.pauseMedium);
  }

  // Switch back to board view
  const boardBtn = page.locator('button:has-text("Board")').first();
  if (await boardBtn.isVisible()) {
    await boardBtn.click();
    await page.waitForTimeout(CONFIG.pauseMedium);
  }

  await page.waitForTimeout(CONFIG.pauseLong);
}
