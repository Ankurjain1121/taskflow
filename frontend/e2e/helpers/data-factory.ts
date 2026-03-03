import { Page, APIRequestContext } from '@playwright/test';

/**
 * API-based test data creation helpers.
 * Uses page.request which shares HttpOnly cookies from browser session.
 * Call these AFTER signing in via UI so cookies are set.
 *
 * Functions prefixed with `api` use a raw APIRequestContext (for global setup).
 * Functions without prefix use page.request (for in-test use).
 */

const API_BASE = '/api';

/** Navigate to workspace and return the workspace ID from the URL */
export async function getFirstWorkspaceId(page: Page): Promise<string> {
  await page.locator('a:has-text("Open Workspace")').first().click();
  await page.waitForURL(/\/workspace\//, { timeout: 15000 });
  const url = page.url();
  const match = url.match(/\/workspace\/([a-f0-9-]+)/);
  if (!match)
    throw new Error(`Could not extract workspace ID from URL: ${url}`);
  return match[1];
}

/** Navigate to workspace, then to the first board, return { workspaceId, boardId } */
export async function navigateToFirstBoard(
  page: Page,
): Promise<{ workspaceId: string; boardId: string }> {
  // From dashboard, click Open Workspace
  await page.locator('text=Your Workspaces').waitFor({ timeout: 15000 });
  const openLink = page.locator('a:has-text("Open Workspace")').first();
  await openLink.waitFor({ timeout: 10000 });
  await openLink.click();

  await page.waitForURL(/\/workspace\//, { timeout: 15000 });
  const wsUrl = page.url();
  const wsMatch = wsUrl.match(/\/workspace\/([a-f0-9-]+)/);
  if (!wsMatch)
    throw new Error(`Could not extract workspace ID from URL: ${wsUrl}`);

  // Wait for boards to appear
  await page.locator('h2:has-text("Boards")').waitFor({ timeout: 15000 });
  const boardCard = page.locator('a[href*="/board/"]').first();
  await boardCard.waitFor({ timeout: 10000 });
  await boardCard.click();

  await page.waitForURL(/\/workspace\/.*\/board\//, { timeout: 15000 });
  const boardUrl = page.url();
  const boardMatch = boardUrl.match(/\/board\/([a-f0-9-]+)/);
  if (!boardMatch)
    throw new Error(`Could not extract board ID from URL: ${boardUrl}`);

  await page.waitForLoadState('domcontentloaded');

  // Wait for board content to load (New Task button visible)
  await page.locator('button:has-text("New Task")').waitFor({ timeout: 15000 });

  return { workspaceId: wsMatch[1], boardId: boardMatch[1] };
}

/** Create a task via the board UI (click New Task, fill dialog, submit) */
export async function createTaskViaUI(
  page: Page,
  title: string,
): Promise<void> {
  // Click the "New Task" button in toolbar to open the dialog
  const newTaskBtn = page.locator('button:has-text("New Task")');
  await newTaskBtn.click();

  // Wait for the Create New Task dialog (PrimeNG p-dialog uses span.p-dialog-title)
  const dialogTitle = page.locator('.p-dialog-title:has-text("Create New Task")');
  await dialogTitle.waitFor({ timeout: 10000 });

  // Fill the title field using its placeholder attribute
  const titleInput = page.locator('input[placeholder="Enter task title"]');
  await titleInput.waitFor({ timeout: 5000 });
  await titleInput.click();
  await titleInput.fill(title);

  // Click submit button (PrimeNG button inside dialog footer)
  const submitBtn = page.locator('.p-dialog-footer button:has-text("Create Task"), .p-dialog button:has-text("Create Task")').first();
  await submitBtn.click();

  // Wait for dialog to close
  await dialogTitle.waitFor({ state: 'hidden', timeout: 15000 });

  // Wait for the task card to appear on the board
  await page.locator(`text=${title}`).waitFor({ timeout: 15000 });
}

/** Add a favorite via API (requires authenticated session) */
export async function addFavoriteViaAPI(
  page: Page,
  entityType: string,
  entityId: string,
): Promise<void> {
  const response = await page.request.post(`${API_BASE}/favorites`, {
    data: { entity_type: entityType, entity_id: entityId },
  });
  if (!response.ok()) {
    throw new Error(
      `Failed to add favorite: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Remove a favorite via API */
export async function removeFavoriteViaAPI(
  page: Page,
  entityType: string,
  entityId: string,
): Promise<void> {
  const response = await page.request.delete(
    `${API_BASE}/favorites/${entityType}/${entityId}`,
  );
  if (!response.ok()) {
    throw new Error(
      `Failed to remove favorite: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Delete a task via API (soft-delete, goes to archive) */
export async function deleteTaskViaAPI(
  page: Page,
  taskId: string,
): Promise<void> {
  const response = await page.request.delete(`${API_BASE}/tasks/${taskId}`);
  if (!response.ok()) {
    throw new Error(
      `Failed to delete task: ${response.status()} ${await response.text()}`,
    );
  }
}



/** Add label to task via page.request */
export async function addLabelToTaskViaAPI(
  page: Page,
  taskId: string,
  labelId: string,
): Promise<void> {
  const response = await page.request.post(
    `${API_BASE}/tasks/${taskId}/labels/${labelId}`,
  );
  if (!response.ok() && response.status() !== 409) {
    throw new Error(
      `Failed to add label: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Remove label from task via page.request */
export async function removeLabelFromTaskViaAPI(
  page: Page,
  taskId: string,
  labelId: string,
): Promise<void> {
  const response = await page.request.delete(
    `${API_BASE}/tasks/${taskId}/labels/${labelId}`,
  );
  if (!response.ok()) {
    throw new Error(
      `Failed to remove label: ${response.status()} ${await response.text()}`,
    );
  }
}

