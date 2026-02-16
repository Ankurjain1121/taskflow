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

  // Wait for the Create New Task dialog
  const dialogTitle = page.locator('h2:has-text("New Task")');
  await dialogTitle.waitFor({ timeout: 10000 });

  // Fill the title field using its placeholder attribute
  const titleInput = page.locator('input[placeholder="Enter task title"]');
  await titleInput.waitFor({ timeout: 5000 });
  await titleInput.click();
  await titleInput.fill(title);

  // Verify submit button is enabled and click
  const submitBtn = page.locator('mat-dialog-actions button[mat-flat-button]');
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

/** Create a board via API */
export async function createBoardViaAPI(
  page: Page,
  workspaceId: string,
  name: string,
): Promise<string> {
  const response = await page.request.post(
    `${API_BASE}/workspaces/${workspaceId}/boards`,
    {
      data: { name, description: '' },
    },
  );
  if (!response.ok()) {
    throw new Error(
      `Failed to create board: ${response.status()} ${await response.text()}`,
    );
  }
  const body = await response.json();
  return body.id;
}

// ---------------------------------------------------------------------------
// Raw APIRequestContext helpers (for global-setup, no browser needed)
// ---------------------------------------------------------------------------

export interface ApiBoard {
  id: string;
  name: string;
  columns?: Array<{ id: string; name: string; position: number }>;
}

export interface ApiWorkspace {
  id: string;
  name: string;
}

export interface ApiTask {
  id: string;
  title: string;
  column_id: string;
  priority: string;
}

export interface ApiLabel {
  id: string;
  name: string;
  color: string;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
}

/** Sign up a new user via API, returns cookies header string */
export async function apiSignUp(
  ctx: APIRequestContext,
  name: string,
  email: string,
  password: string,
): Promise<{ user: ApiUser; cookies: string }> {
  const res = await ctx.post(`${API_BASE}/auth/sign-up`, {
    data: { name, email, password },
  });
  if (!res.ok()) {
    throw new Error(`Sign-up failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const setCookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie');
  const cookieStr = setCookies.map((h) => h.value.split(';')[0]).join('; ');
  return { user: body.user, cookies: cookieStr };
}

/** Sign in via API, returns cookies header string */
export async function apiSignIn(
  ctx: APIRequestContext,
  email: string,
  password: string,
): Promise<{ user: ApiUser; cookies: string }> {
  const res = await ctx.post(`${API_BASE}/auth/sign-in`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Sign-in failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const setCookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie');
  const cookieStr = setCookies.map((h) => h.value.split(';')[0]).join('; ');
  return { user: body.user, cookies: cookieStr };
}

/** Create workspace via API */
export async function apiCreateWorkspace(
  ctx: APIRequestContext,
  cookies: string,
  name: string,
  description = '',
): Promise<ApiWorkspace> {
  const res = await ctx.post(`${API_BASE}/workspaces`, {
    headers: { cookie: cookies },
    data: { name, description },
  });
  if (!res.ok()) {
    throw new Error(
      `Create workspace failed: ${res.status()} ${await res.text()}`,
    );
  }
  return (await res.json()) as ApiWorkspace;
}

/** Invite user to workspace via API */
export async function apiInviteUser(
  ctx: APIRequestContext,
  cookies: string,
  workspaceId: string,
  email: string,
  role = 'Member',
): Promise<{ id: string; token: string }> {
  const res = await ctx.post(`${API_BASE}/invitations`, {
    headers: { cookie: cookies },
    data: { email, workspace_id: workspaceId, role },
  });
  if (!res.ok()) {
    throw new Error(`Invite failed: ${res.status()} ${await res.text()}`);
  }
  return await res.json();
}

/** Accept invitation (public endpoint, creates user account in tenant) */
export async function apiAcceptInvitation(
  ctx: APIRequestContext,
  token: string,
  name: string,
  password: string,
): Promise<{ user: ApiUser; cookies: string }> {
  const res = await ctx.post(`${API_BASE}/invitations/accept`, {
    data: { token, name, password },
  });
  if (!res.ok()) {
    throw new Error(
      `Accept invitation failed: ${res.status()} ${await res.text()}`,
    );
  }
  const body = await res.json();
  const setCookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie');
  const cookieStr = setCookies.map((h) => h.value.split(';')[0]).join('; ');
  return { user: body.user, cookies: cookieStr };
}

/** Add member to workspace via API */
export async function apiAddWorkspaceMember(
  ctx: APIRequestContext,
  cookies: string,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const res = await ctx.post(`${API_BASE}/workspaces/${workspaceId}/members`, {
    headers: { cookie: cookies },
    data: { user_id: userId },
  });
  // 409 = already a member, that's fine
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`Add member failed: ${res.status()} ${await res.text()}`);
  }
}

/** Create board via API (raw context) */
export async function apiCreateBoard(
  ctx: APIRequestContext,
  cookies: string,
  workspaceId: string,
  name: string,
): Promise<ApiBoard> {
  const res = await ctx.post(`${API_BASE}/workspaces/${workspaceId}/boards`, {
    headers: { cookie: cookies },
    data: { name, description: '' },
  });
  if (!res.ok()) {
    throw new Error(`Create board failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as ApiBoard;
}

/** Create task via API (raw context) */
export async function apiCreateTask(
  ctx: APIRequestContext,
  cookies: string,
  boardId: string,
  data: {
    title: string;
    column_id: string;
    priority?: string;
    due_date?: string;
    assignee_ids?: string[];
    label_ids?: string[];
    description?: string;
  },
): Promise<ApiTask> {
  const res = await ctx.post(`${API_BASE}/boards/${boardId}/tasks`, {
    headers: { cookie: cookies },
    data,
  });
  if (!res.ok()) {
    throw new Error(`Create task failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as ApiTask;
}

/** Create label via API */
export async function apiCreateLabel(
  ctx: APIRequestContext,
  cookies: string,
  workspaceId: string,
  name: string,
  color: string,
): Promise<ApiLabel> {
  // Labels use "projects" endpoint in the backend
  const res = await ctx.post(`${API_BASE}/projects/${workspaceId}/labels`, {
    headers: { cookie: cookies },
    data: { name, color },
  });
  if (!res.ok()) {
    throw new Error(`Create label failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as ApiLabel;
}

/** Assign user to task via API */
export async function apiAssignTask(
  ctx: APIRequestContext,
  cookies: string,
  taskId: string,
  userId: string,
): Promise<void> {
  const res = await ctx.post(`${API_BASE}/tasks/${taskId}/assignees`, {
    headers: { cookie: cookies },
    data: { user_id: userId },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`Assign task failed: ${res.status()} ${await res.text()}`);
  }
}

/** Add label to task via API */
export async function apiAddLabelToTask(
  ctx: APIRequestContext,
  cookies: string,
  taskId: string,
  labelId: string,
): Promise<void> {
  const res = await ctx.post(`${API_BASE}/tasks/${taskId}/labels/${labelId}`, {
    headers: { cookie: cookies },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(
      `Add label to task failed: ${res.status()} ${await res.text()}`,
    );
  }
}

/** Update task via API */
export async function apiUpdateTask(
  ctx: APIRequestContext,
  cookies: string,
  taskId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await ctx.patch(`${API_BASE}/tasks/${taskId}`, {
    headers: { cookie: cookies },
    data,
  });
  if (!res.ok()) {
    throw new Error(`Update task failed: ${res.status()} ${await res.text()}`);
  }
}

/** Complete onboarding via API (create workspace + skip invite + sample board) */
export async function apiCompleteOnboarding(
  ctx: APIRequestContext,
  cookies: string,
  workspaceName: string,
): Promise<ApiWorkspace> {
  // The onboarding flow just creates a workspace, which we do via the normal API
  return apiCreateWorkspace(ctx, cookies, workspaceName);
}

/** Get workspace members */
export async function apiGetWorkspaceMembers(
  ctx: APIRequestContext,
  cookies: string,
  workspaceId: string,
): Promise<Array<{ user_id: string; role: string }>> {
  const res = await ctx.get(`${API_BASE}/workspaces/${workspaceId}`, {
    headers: { cookie: cookies },
  });
  if (!res.ok()) {
    throw new Error(
      `Get workspace failed: ${res.status()} ${await res.text()}`,
    );
  }
  const body = await res.json();
  return body.members || [];
}

// ---------------------------------------------------------------------------
// Page-based helpers for use inside tests
// ---------------------------------------------------------------------------

/** Create workspace via page.request (uses browser cookies) */
export async function createWorkspaceViaAPI(
  page: Page,
  name: string,
): Promise<{ id: string; name: string }> {
  const response = await page.request.post(`${API_BASE}/workspaces`, {
    data: { name, description: '' },
  });
  if (!response.ok()) {
    throw new Error(
      `Failed to create workspace: ${response.status()} ${await response.text()}`,
    );
  }
  return await response.json();
}

/** Invite user via page.request */
export async function inviteUserViaAPI(
  page: Page,
  workspaceId: string,
  email: string,
  role = 'Member',
): Promise<{ id: string; token: string }> {
  const response = await page.request.post(`${API_BASE}/invitations`, {
    data: { email, workspace_id: workspaceId, role },
  });
  if (!response.ok()) {
    throw new Error(
      `Failed to invite: ${response.status()} ${await response.text()}`,
    );
  }
  return await response.json();
}

/** Create task via page.request */
export async function createTaskViaAPI(
  page: Page,
  boardId: string,
  columnId: string,
  data: {
    title: string;
    priority?: string;
    due_date?: string;
    description?: string;
  },
): Promise<{ id: string }> {
  const response = await page.request.post(
    `${API_BASE}/boards/${boardId}/tasks`,
    {
      data: { ...data, column_id: columnId },
    },
  );
  if (!response.ok()) {
    throw new Error(
      `Failed to create task: ${response.status()} ${await response.text()}`,
    );
  }
  return await response.json();
}

/** Assign task via page.request */
export async function assignTaskViaAPI(
  page: Page,
  taskId: string,
  userId: string,
): Promise<void> {
  const response = await page.request.post(
    `${API_BASE}/tasks/${taskId}/assignees`,
    {
      data: { user_id: userId },
    },
  );
  if (!response.ok() && response.status() !== 409) {
    throw new Error(
      `Failed to assign task: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Move task to column via page.request */
export async function moveTaskToColumnViaAPI(
  page: Page,
  taskId: string,
  columnId: string,
  position = '1',
): Promise<void> {
  const response = await page.request.patch(
    `${API_BASE}/tasks/${taskId}/move`,
    {
      data: { column_id: columnId, position },
    },
  );
  if (!response.ok()) {
    throw new Error(
      `Failed to move task: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Update task via page.request */
export async function updateTaskViaAPI(
  page: Page,
  taskId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await page.request.patch(`${API_BASE}/tasks/${taskId}`, {
    data,
  });
  if (!response.ok()) {
    throw new Error(
      `Failed to update task: ${response.status()} ${await response.text()}`,
    );
  }
}

/** Create label via page.request */
export async function createLabelViaAPI(
  page: Page,
  workspaceId: string,
  name: string,
  color: string,
): Promise<{ id: string; name: string; color: string }> {
  const response = await page.request.post(
    `${API_BASE}/projects/${workspaceId}/labels`,
    { data: { name, color } },
  );
  if (!response.ok()) {
    throw new Error(
      `Failed to create label: ${response.status()} ${await response.text()}`,
    );
  }
  return await response.json();
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

/** Get workspaces list via page.request */
export async function getWorkspacesViaAPI(page: Page): Promise<ApiWorkspace[]> {
  const response = await page.request.get(`${API_BASE}/workspaces`);
  if (!response.ok()) {
    throw new Error(
      `Failed to get workspaces: ${response.status()} ${await response.text()}`,
    );
  }
  return await response.json();
}

/** Get boards for workspace via page.request */
export async function getBoardsViaAPI(
  page: Page,
  workspaceId: string,
): Promise<ApiBoard[]> {
  const response = await page.request.get(
    `${API_BASE}/workspaces/${workspaceId}/boards`,
  );
  if (!response.ok()) {
    throw new Error(
      `Failed to get boards: ${response.status()} ${await response.text()}`,
    );
  }
  return await response.json();
}

/** Get board detail with columns */
export async function getBoardDetailViaAPI(
  page: Page,
  boardId: string,
): Promise<ApiBoard> {
  const response = await page.request.get(`${API_BASE}/boards/${boardId}`);
  if (!response.ok()) {
    throw new Error(
      `Failed to get board: ${response.status()} ${await response.text()}`,
    );
  }
  return await response.json();
}
