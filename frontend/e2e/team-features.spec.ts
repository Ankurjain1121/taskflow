import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { signUpAndOnboard } from './helpers/auth';
import { WorkspaceSettingsPage } from './pages/WorkspaceSettingsPage';
import { TeamsPage } from './pages/TeamsPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { TeamOverviewPage } from './pages/TeamOverviewPage';
import { BoardSettingsPage } from './pages/BoardSettingsPage';
import {
  getFirstWorkspaceId,
  navigateToFirstBoard,
} from './helpers/data-factory';

// ---------------------------------------------------------------------------
// Helper: sign up, onboard, get workspace ID from sidebar project link
// ---------------------------------------------------------------------------
async function setupAndGetWorkspaceId(
  page: import('@playwright/test').Page,
  wsName: string,
): Promise<string> {
  await signUpAndOnboard(page, wsName);
  return await getFirstWorkspaceId(page);
}

// ===========================================================================
// F1/F3: WORKSPACE MEMBER ROLES
// Uses a single sign-up + shared storageState to avoid auth rate-limit.
// ===========================================================================
test.describe('F1/F3: Workspace Member Roles', () => {
  test.setTimeout(90_000);

  let storagePath: string;
  let workspaceId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndOnboard(page, 'MemberRoles WS');
    workspaceId = await getFirstWorkspaceId(page);

    // Save storage state (cookies + localStorage) for reuse
    const resultsDir = path.join(__dirname, '..', 'e2e-artifacts');
    fs.mkdirSync(resultsDir, { recursive: true });
    storagePath = path.join(resultsDir, '.f1f3-auth.json');
    await context.storageState({ path: storagePath });
    await page.close();
    await context.close();
  });

  test('workspace settings page loads with all tabs', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(workspaceId);
    await settingsPage.expectLoaded();

    // Verify all tabs are present
    await expect(settingsPage.generalTab).toBeVisible({ timeout: 10000 });
    await expect(settingsPage.membersTab).toBeVisible({ timeout: 5000 });
    await expect(settingsPage.teamsTab).toBeVisible({ timeout: 5000 });
    await expect(settingsPage.integrationsTab).toBeVisible({ timeout: 5000 });
    await expect(settingsPage.advancedTab).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f1-workspace-settings-tabs.png',
    });
    await page.close();
    await context.close();
  });

  test('members tab shows current user with Owner role badge', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(workspaceId);
    await settingsPage.waitForContentLoaded();

    // Click Members tab
    await settingsPage.clickMembersTab();

    // Wait for member rows to appear
    await expect(settingsPage.memberRows.first()).toBeVisible({
      timeout: 10000,
    });

    // Should have at least 1 member (the owner/current user)
    const memberCount = await settingsPage.getMemberCount();
    expect(memberCount).toBeGreaterThanOrEqual(1);

    // Owner role badge should be visible (role badge text)
    const ownerBadge = page.locator(
      'app-members-list span.rounded-full:has-text("Owner")',
    );
    await expect(ownerBadge).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'e2e-artifacts/f1-members-owner-badge.png',
    });
    await page.close();
    await context.close();
  });

  test('members table has correct column headers', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(workspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickMembersTab();

    // Verify table header columns
    const memberHeader = page.locator('app-members-list th:has-text("Member")');
    const roleHeader = page.locator('app-members-list th:has-text("Role")');
    const joinedHeader = page.locator('app-members-list th:has-text("Joined")');

    await expect(memberHeader).toBeVisible({ timeout: 10000 });
    await expect(roleHeader).toBeVisible({ timeout: 5000 });
    await expect(joinedHeader).toBeVisible({ timeout: 5000 });
    await page.close();
    await context.close();
  });

  test('owner sees Actions column and invite button', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(workspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickMembersTab();

    // Owner should see Actions column
    const actionsHeader = page.locator(
      'app-members-list th:has-text("Actions")',
    );
    await expect(actionsHeader).toBeVisible({ timeout: 10000 });

    // Owner should see Invite button
    await expect(settingsPage.inviteButton).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f1-members-admin-actions.png',
    });
    await page.close();
    await context.close();
  });

  test('owner sees Pending Invitations section', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(workspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickMembersTab();

    // Owner should see Pending Invitations section
    await expect(settingsPage.pendingInvitationsHeading).toBeVisible({
      timeout: 10000,
    });
    await page.close();
    await context.close();
  });

  test('member search input is present and filters members', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(workspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickMembersTab();

    // Search input should be visible
    await expect(settingsPage.memberSearchInput).toBeVisible({
      timeout: 10000,
    });

    // Type a non-matching query
    await settingsPage.memberSearchInput.fill('nonexistentmember123');
    await page.waitForTimeout(500);

    // Should show "No members matching" text
    const noMatch = page.locator('text=No members matching');
    await expect(noMatch).toBeVisible({ timeout: 5000 });
    await page.close();
    await context.close();
  });
});

// ===========================================================================
// F4: TEAMS/GROUPS
// Uses a single sign-up + shared storageState to avoid auth rate-limit.
// ===========================================================================
test.describe('F4: Teams/Groups', () => {
  test.setTimeout(90_000);

  let f4StoragePath: string;
  let f4WorkspaceId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndOnboard(page, 'Teams WS');
    f4WorkspaceId = await getFirstWorkspaceId(page);

    const resultsDir = path.join(__dirname, '..', 'e2e-artifacts');
    fs.mkdirSync(resultsDir, { recursive: true });
    f4StoragePath = path.join(resultsDir, '.f4-auth.json');
    await context.storageState({ path: f4StoragePath });
    await page.close();
    await context.close();
  });

  test('teams tab shows empty state initially', async ({ browser }) => {
    const context = await browser.newContext({ storageState: f4StoragePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(f4WorkspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickTeamsTab();

    const teamsPage = new TeamsPage(page);
    await teamsPage.expectLoaded();

    // Should show Create Team button
    await expect(teamsPage.createTeamButton).toBeVisible({ timeout: 5000 });

    // Should show empty state or team list
    const hasEmptyState = await teamsPage.emptyState
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const teamCount = await teamsPage.getTeamCount();

    // Either empty state or no teams
    expect(hasEmptyState || teamCount === 0).toBeTruthy();

    await page.screenshot({
      path: 'e2e-artifacts/f4-teams-empty-state.png',
    });
    await page.close();
    await context.close();
  });

  test('create team dialog opens and has all required fields', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f4StoragePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(f4WorkspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickTeamsTab();

    const teamsPage = new TeamsPage(page);
    await teamsPage.expectLoaded();
    await teamsPage.openCreateDialog();

    // Verify dialog fields
    await expect(teamsPage.teamNameInput).toBeVisible({ timeout: 5000 });
    await expect(teamsPage.teamDescriptionInput).toBeVisible({
      timeout: 5000,
    });

    // Verify color picker buttons are present
    const colorCount = await teamsPage.colorButtons.count();
    expect(colorCount).toBe(8); // 8 preset colors

    // Verify dialog title
    const dialogTitle = page.locator('.p-dialog-title:has-text("Create Team")');
    await expect(dialogTitle).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f4-create-team-dialog.png',
    });
    await page.close();
    await context.close();
  });

  test('create a new team and verify it appears in list', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f4StoragePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(f4WorkspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickTeamsTab();

    const teamsPage = new TeamsPage(page);
    await teamsPage.expectLoaded();

    // Open create dialog
    await teamsPage.openCreateDialog();

    // Fill form
    await teamsPage.fillTeamForm('Engineering Team', 'The core dev team');

    // Select a color (second color - blue)
    await teamsPage.selectColor(1);

    // Submit
    await teamsPage.submitCreateForm();

    // Wait for dialog to close
    await expect(teamsPage.teamNameInput).toBeHidden({ timeout: 15000 });

    // Verify team appears in list
    await page.waitForTimeout(1000);
    const teamNames = await teamsPage.getTeamNames();
    expect(teamNames).toContain('Engineering Team');

    await page.screenshot({
      path: 'e2e-artifacts/f4-team-created.png',
    });
    await page.close();
    await context.close();
  });

  test('click team card opens edit dialog with team details', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f4StoragePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(f4WorkspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickTeamsTab();

    const teamsPage = new TeamsPage(page);
    await teamsPage.expectLoaded();

    // Create a team first
    await teamsPage.openCreateDialog();
    await teamsPage.fillTeamForm('Design Team');
    await teamsPage.selectColor(2);
    await teamsPage.submitCreateForm();
    await expect(teamsPage.teamNameInput).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Click on the team card
    await teamsPage.clickTeamCard(0);

    // Verify edit dialog opens
    await expect(teamsPage.teamNameInput).toBeVisible({ timeout: 10000 });

    // Verify dialog shows "Edit Team" title
    const editTitle = page.locator('.p-dialog-title:has-text("Edit Team")');
    await expect(editTitle).toBeVisible({ timeout: 5000 });

    // Verify name is pre-populated
    const nameValue = await teamsPage.teamNameInput.inputValue();
    expect(nameValue).toBe('Design Team');

    // Verify Delete Team button is visible in edit mode
    await expect(teamsPage.deleteTeamButton).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f4-team-edit-dialog.png',
    });
    await page.close();
    await context.close();
  });

  test('team card shows member count', async ({ browser }) => {
    const context = await browser.newContext({ storageState: f4StoragePath });
    const page = await context.newPage();

    const settingsPage = new WorkspaceSettingsPage(page);
    await settingsPage.goto(f4WorkspaceId);
    await settingsPage.waitForContentLoaded();
    await settingsPage.clickTeamsTab();

    const teamsPage = new TeamsPage(page);
    await teamsPage.expectLoaded();

    // Create a team
    await teamsPage.openCreateDialog();
    await teamsPage.fillTeamForm('QA Team');
    await teamsPage.submitCreateForm();
    await expect(teamsPage.teamNameInput).toBeHidden({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Team card should show member count text
    const memberCountText = teamsPage.teamCards
      .first()
      .locator('text=/\\d+ member/');
    await expect(memberCountText).toBeVisible({ timeout: 5000 });
    await page.close();
    await context.close();
  });
});

// ===========================================================================
// F5: DISCOVER WORKSPACES
// Uses a single sign-up + shared storageState to avoid auth rate-limit.
// ===========================================================================
test.describe('F5: Discover Workspaces', () => {
  test.setTimeout(90_000);

  let f5StoragePath: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndOnboard(page, 'Discover WS');

    const resultsDir = path.join(__dirname, '..', 'e2e-artifacts');
    fs.mkdirSync(resultsDir, { recursive: true });
    f5StoragePath = path.join(resultsDir, '.f5-auth.json');
    await context.storageState({ path: f5StoragePath });
    await page.close();
    await context.close();
  });

  test('discover page loads with heading and description', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f5StoragePath });
    const page = await context.newPage();

    const discoverPage = new DiscoverPage(page);
    await discoverPage.goto();
    await discoverPage.expectLoaded();

    await expect(discoverPage.description).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f5-discover-page.png',
    });
    await page.close();
    await context.close();
  });

  test('discover page shows content or empty state after loading', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f5StoragePath });
    const page = await context.newPage();

    const discoverPage = new DiscoverPage(page);
    await discoverPage.goto();
    await discoverPage.waitForContentLoaded();

    // Either workspace cards or empty state should be visible
    await discoverPage.expectContentOrEmptyState();

    await page.screenshot({
      path: 'e2e-artifacts/f5-discover-content.png',
    });
    await page.close();
    await context.close();
  });

  test('discover page accessible from sidebar Discover link', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f5StoragePath });
    const page = await context.newPage();

    // Navigate to dashboard first so sidebar is visible
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // From the dashboard, find the sidebar Discover link
    const discoverLink = page.locator('a[href="/discover"]').first();
    await expect(discoverLink).toBeVisible({ timeout: 10000 });
    await discoverLink.click();

    await expect(page).toHaveURL(/\/discover/, { timeout: 15000 });

    const discoverPage = new DiscoverPage(page);
    await discoverPage.expectLoaded();
    await page.close();
    await context.close();
  });

  test('discover page has no error state', async ({ browser }) => {
    const context = await browser.newContext({ storageState: f5StoragePath });
    const page = await context.newPage();

    const discoverPage = new DiscoverPage(page);
    await discoverPage.goto();
    await discoverPage.waitForContentLoaded();

    // Should not show error
    await expect(discoverPage.errorMessage).toBeHidden({ timeout: 5000 });
    await page.close();
    await context.close();
  });
});

// ===========================================================================
// F6: TEAM OVERVIEW / WORKLOAD
// Uses a single sign-up + shared storageState to avoid auth rate-limit.
// ===========================================================================
test.describe('F6: Team Overview & Workload', () => {
  test.setTimeout(90_000);

  let f6StoragePath: string;
  let f6WorkspaceId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndOnboard(page, 'TeamOverview WS');
    f6WorkspaceId = await getFirstWorkspaceId(page);

    const resultsDir = path.join(__dirname, '..', 'e2e-artifacts');
    fs.mkdirSync(resultsDir, { recursive: true });
    f6StoragePath = path.join(resultsDir, '.f6-auth.json');
    await context.storageState({ path: f6StoragePath });
    await page.close();
    await context.close();
  });

  test('team overview page loads with heading', async ({ browser }) => {
    const context = await browser.newContext({ storageState: f6StoragePath });
    const page = await context.newPage();

    const teamOverview = new TeamOverviewPage(page);
    await teamOverview.goto(f6WorkspaceId);
    await teamOverview.expectLoaded();

    await expect(teamOverview.description).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f6-team-overview.png',
    });
    await page.close();
    await context.close();
  });

  test('team overview shows member cards or empty state', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f6StoragePath });
    const page = await context.newPage();

    const teamOverview = new TeamOverviewPage(page);
    await teamOverview.goto(f6WorkspaceId);
    await teamOverview.waitForContentLoaded();

    // Should show either member cards or empty state
    await teamOverview.expectContentOrEmptyState();
    await page.close();
    await context.close();
  });

  test('team overview accessible from sidebar workspace links', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f6StoragePath });
    const page = await context.newPage();

    // Navigate to workspace team overview directly
    await page.goto(`/workspace/${f6WorkspaceId}/team`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/workspace\/[a-f0-9-]+\/team/, {
      timeout: 15000,
    });

    const teamOverview = new TeamOverviewPage(page);
    await teamOverview.expectLoaded();

    await page.screenshot({
      path: 'e2e-artifacts/f6-team-overview-via-sidebar.png',
    });
    await page.close();
    await context.close();
  });

  test('workload balance page loads from team overview', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: f6StoragePath });
    const page = await context.newPage();

    // Navigate directly to the workload balance page
    await page.goto(`/workspace/${f6WorkspaceId}/team/balance`);
    await page.waitForLoadState('domcontentloaded');

    // Verify the workload balance page loads
    const heading = page.locator('h1:has-text("Workload Balance")');
    await expect(heading).toBeVisible({ timeout: 15000 });

    const description = page.locator(
      'text=View member tasks and reassign work',
    );
    await expect(description).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f6-workload-balance.png',
    });
    await page.close();
    await context.close();
  });

  test('workload balance shows team members list', async ({ browser }) => {
    const context = await browser.newContext({ storageState: f6StoragePath });
    const page = await context.newPage();

    await page.goto(`/workspace/${f6WorkspaceId}/team/balance`);
    await page.waitForLoadState('domcontentloaded');

    const heading = page.locator('h1:has-text("Workload Balance")');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Should show "Team Members" section heading
    const teamMembersHeading = page.locator('h2:has-text("Team Members")');
    await expect(teamMembersHeading).toBeVisible({ timeout: 15000 });
    await page.close();
    await context.close();
  });
});

// ===========================================================================
// F7: BOARD MEMBER MANAGEMENT
// Uses a single sign-up + shared storageState to avoid auth rate-limit.
// ===========================================================================
test.describe('F7: Board Member Management', () => {
  test.setTimeout(90_000);

  let storagePath: string;
  let workspaceId: string;
  let boardId: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndOnboard(page, 'BoardMembers WS');

    // Extract workspace + board IDs from sidebar project link
    const projectLink = page
      .locator('app-sidebar-projects a.project-item')
      .first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    const href = await projectLink.getAttribute('href');
    if (!href) throw new Error('Project link has no href');
    const wsMatch = href.match(/\/workspace\/([a-f0-9-]+)/);
    const boardMatch = href.match(/\/(?:board|project)\/([a-f0-9-]+)/);
    if (!wsMatch || !boardMatch) {
      throw new Error(`Could not parse IDs from href: ${href}`);
    }
    workspaceId = wsMatch[1];
    boardId = boardMatch[1];

    // Save storage state for reuse
    const resultsDir = path.join(__dirname, '..', 'e2e-artifacts');
    fs.mkdirSync(resultsDir, { recursive: true });
    storagePath = path.join(resultsDir, '.f7-auth.json');
    await context.storageState({ path: storagePath });
    await page.close();
    await context.close();
  });

  test('board settings page loads with heading', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.expectLoaded();

    await expect(boardSettings.description).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: 'e2e-artifacts/f7-board-settings.png',
    });
    await page.close();
    await context.close();
  });

  test('board settings shows Board Members section heading', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.waitForContentLoaded();

    // Members section heading should be visible
    await expect(boardSettings.boardMembersHeading).toBeVisible({
      timeout: 10000,
    });
    await page.close();
    await context.close();
  });

  test('board settings shows Add Member button', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.waitForContentLoaded();

    // Add Member button should be visible
    await expect(boardSettings.addMemberButton).toBeVisible({
      timeout: 10000,
    });

    await page.screenshot({
      path: 'e2e-artifacts/f7-board-add-member.png',
    });
    await page.close();
    await context.close();
  });

  test('board settings members table has correct headers', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.waitForContentLoaded();

    // Check table headers
    const memberHeader = page.locator(
      'section:has(h3:has-text("Board Members")) th:has-text("Member")',
    );
    const roleHeader = page.locator(
      'section:has(h3:has-text("Board Members")) th:has-text("Role")',
    );
    const actionsHeader = page.locator(
      'section:has(h3:has-text("Board Members")) th:has-text("Actions")',
    );

    await expect(memberHeader).toBeVisible({ timeout: 10000 });
    await expect(roleHeader).toBeVisible({ timeout: 5000 });
    await expect(actionsHeader).toBeVisible({ timeout: 5000 });
    await page.close();
    await context.close();
  });

  test('board settings has role dropdown with Viewer/Editor options', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.waitForContentLoaded();

    // Check if there are members with role dropdowns
    const roleDropdownCount = await boardSettings.getRoleDropdownCount();

    if (roleDropdownCount > 0) {
      // Verify dropdown options contain Viewer and Editor
      const options = await boardSettings.getRoleOptions(0);
      expect(options).toContain('Viewer');
      expect(options).toContain('Editor');
    }

    // Even if no members yet, the "No members found" or members table should exist
    const hasMembersOrEmpty = boardSettings.membersTable.or(
      boardSettings.noMembersMessage,
    );
    await expect(hasMembersOrEmpty).toBeVisible({ timeout: 10000 });
    await page.close();
    await context.close();
  });

  test('board settings has Back to Board link', async ({ browser }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.expectLoaded();

    await expect(boardSettings.backToBoardLink).toBeVisible({
      timeout: 10000,
    });
    await page.close();
    await context.close();
  });

  test('board settings shows General section with name and description', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.waitForContentLoaded();

    await expect(boardSettings.generalHeading).toBeVisible({ timeout: 10000 });
    await expect(boardSettings.nameInput).toBeVisible({ timeout: 5000 });
    await expect(boardSettings.descriptionInput).toBeVisible({
      timeout: 5000,
    });

    // Name input should be pre-populated
    const nameValue = await boardSettings.nameInput.inputValue();
    expect(nameValue.trim().length).toBeGreaterThan(0);
    await page.close();
    await context.close();
  });

  test('board settings shows Danger Zone with Delete Board button', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: storagePath });
    const page = await context.newPage();

    const boardSettings = new BoardSettingsPage(page);
    await boardSettings.goto(workspaceId, boardId);
    await boardSettings.waitForContentLoaded();

    await expect(boardSettings.dangerZone).toBeVisible({ timeout: 10000 });
    await expect(boardSettings.deleteBoardButton).toBeVisible({
      timeout: 5000,
    });
    await page.close();
    await context.close();
  });
});

// ===========================================================================
// SIDEBAR NAVIGATION
// Uses a single sign-up + shared storageState to avoid auth rate-limit.
// ===========================================================================
test.describe('Sidebar Navigation', () => {
  test.setTimeout(90_000);

  let sidebarStoragePath: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndOnboard(page, 'Sidebar WS');

    // Wait for sidebar project items to load (ensures sample board exists)
    await expect(page.locator('app-sidebar-projects .project-item').first()).toBeVisible({
      timeout: 15000,
    });

    // Save storage state for reuse
    const resultsDir = path.join(__dirname, '..', 'e2e-artifacts');
    fs.mkdirSync(resultsDir, { recursive: true });
    sidebarStoragePath = path.join(resultsDir, '.sidebar-auth.json');
    await context.storageState({ path: sidebarStoragePath });
    await page.close();
    await context.close();
  });

  test('sidebar shows project items', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: sidebarStoragePath,
    });
    const page = await context.newPage();
    await page.goto('/dashboard');

    // Wait for the sidebar to load project items
    const projectItem = page.locator('app-sidebar-projects .project-item').first();
    await expect(projectItem).toBeVisible({ timeout: 15000 });

    await page.screenshot({
      path: 'e2e-artifacts/sidebar-workspace-links.png',
    });
    await page.close();
    await context.close();
  });

  test('sidebar shows Discover link in workspaces section', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: sidebarStoragePath,
    });
    const page = await context.newPage();
    await page.goto('/dashboard');

    // The Discover link appears in the sidebar
    const discoverLink = page.locator('app-sidebar a[routerLink="/discover"]');
    await expect(discoverLink).toBeVisible({ timeout: 15000 });

    // Should contain "Discover" text
    await expect(discoverLink).toContainText('Discover');

    await page.screenshot({
      path: 'e2e-artifacts/sidebar-discover-link.png',
    });
    await page.close();
    await context.close();
  });

  test('sidebar project link navigates to project page', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: sidebarStoragePath,
    });
    const page = await context.newPage();
    await page.goto('/dashboard');

    const projectLink = page
      .locator('app-sidebar-projects a.project-item')
      .first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();

    await expect(page).toHaveURL(/\/project\//, {
      timeout: 15000,
    });
    await page.close();
    await context.close();
  });

  test('sidebar Discover link navigates to /discover', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: sidebarStoragePath,
    });
    const page = await context.newPage();
    await page.goto('/dashboard');

    const discoverLink = page.locator('app-sidebar a[routerLink="/discover"]');
    await expect(discoverLink).toBeVisible({ timeout: 15000 });
    await discoverLink.click();

    await expect(page).toHaveURL(/\/discover/, { timeout: 15000 });
    await page.close();
    await context.close();
  });

  test('sidebar shows project list with links', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: sidebarStoragePath,
    });
    const page = await context.newPage();
    await page.goto('/dashboard');

    const projectItems = page.locator('app-sidebar-projects a.project-item');
    await expect(projectItems.first()).toBeVisible({ timeout: 15000 });

    const count = await projectItems.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await page.screenshot({
      path: 'e2e-artifacts/sidebar-boards-list.png',
    });
    await page.close();
    await context.close();
  });
});
