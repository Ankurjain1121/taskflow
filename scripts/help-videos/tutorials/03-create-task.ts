import { Page } from 'playwright';
import { CONFIG } from '../config';

/**
 * Tutorial: Creating a Task
 * Shows how to create a task via the New Task dialog with title, priority, and assignee.
 */
export async function record(page: Page): Promise<void> {
  // Navigate to dashboard, then to first project
  await page.goto(`${CONFIG.baseURL}/dashboard`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(CONFIG.pauseShort);

  // Click on first project
  const projectLink = page.locator('app-sidebar-projects a.project-item').first();
  if (await projectLink.isVisible()) {
    await projectLink.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(CONFIG.pauseMedium);
  }

  // Click "New Task" or "+ Task" button
  const newTaskBtn = page.locator('button:has-text("New Task"), button:has-text("+ Task")').first();
  await newTaskBtn.waitFor({ state: 'visible', timeout: 10000 });
  await newTaskBtn.hover();
  await page.waitForTimeout(CONFIG.pauseShort);
  await newTaskBtn.click();
  await page.waitForTimeout(CONFIG.pauseMedium);

  // Fill in the task title (type slowly for video effect)
  const titleInput = page.locator('input[placeholder*="task title"], input[placeholder*="Task title"]').first();
  if (await titleInput.isVisible()) {
    await titleInput.click();
    await page.waitForTimeout(CONFIG.pauseShort);
    // Type character by character for visual effect
    const title = 'Design new landing page';
    for (const char of title) {
      await titleInput.type(char, { delay: 80 });
    }
    await page.waitForTimeout(CONFIG.pauseShort);
  }

  // Try to set priority if dropdown exists
  const prioritySelect = page.locator('[formControlName="priority"], [data-testid="priority"]').first();
  if (await prioritySelect.isVisible().catch(() => false)) {
    await prioritySelect.click();
    await page.waitForTimeout(CONFIG.pauseShort);
    // Select "High" priority
    const highOption = page.locator('li:has-text("High"), .p-dropdown-item:has-text("High")').first();
    if (await highOption.isVisible().catch(() => false)) {
      await highOption.click();
      await page.waitForTimeout(CONFIG.pauseShort);
    }
  }

  // Show the dialog for a moment before submitting
  await page.waitForTimeout(CONFIG.pauseMedium);

  // Click Create Task button
  const createBtn = page.locator('button:has-text("Create Task")').first();
  if (await createBtn.isVisible()) {
    await createBtn.hover();
    await page.waitForTimeout(CONFIG.pauseShort);
    await createBtn.click();
    await page.waitForTimeout(CONFIG.pauseLong);
  }

  // Show the board with the new task visible
  await page.waitForTimeout(CONFIG.pauseLong);
}
