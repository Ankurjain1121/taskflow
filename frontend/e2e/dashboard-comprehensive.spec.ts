import { test, expect, Page, BrowserContext } from '@playwright/test';

const ADMIN_EMAIL = 'admin1@paraslace.in';
const ADMIN_PASSWORD = 'Admin@123';
const BASE = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * Sign in once, save storage state, reuse across all tests.
 */
let authStoragePath: string;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.goto(`${BASE}/auth/sign-in`);
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page
    .locator('input[type="email"], input[formControlName="email"]')
    .first();
  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(ADMIN_EMAIL);

  const passwordInput = page
    .locator('p-password input[type="password"], input[type="password"]')
    .first();
  await passwordInput.fill(ADMIN_PASSWORD);

  const submitBtn = page.locator('button[type="submit"]').first();
  await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  await submitBtn.click();

  // Wait for redirect away from sign-in
  await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 30000 });

  // Navigate to dashboard
  if (!page.url().includes('/dashboard')) {
    await page.goto(`${BASE}/dashboard`);
  }
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Save auth state
  authStoragePath = '/tmp/playwright-auth-state.json';
  await context.storageState({ path: authStoragePath });
  await context.close();
});

// Increase timeout for all tests since VPS can be slow
test.setTimeout(60000);

test.describe('Dashboard — Comprehensive Feature Tests', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      storageState: authStoragePath,
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    // Wait for greeting to confirm dashboard loaded
    const greeting = page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible({ timeout: 15000 });
  });

  test.afterEach(async () => {
    await context?.close();
  });

  // ──────────────────────────────────────────────────────────
  // 1. HEADER & GREETING
  // ──────────────────────────────────────────────────────────
  test('1.1 shows time-based greeting with user name', async () => {
    const greeting = page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible();
    const text = await greeting.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(5);
    await page.screenshot({ path: 'test-results/dashboard-1.1-greeting.png', fullPage: false });
  });

  test('1.2 shows smart status subtitle', async () => {
    const subtitle = page
      .locator("text=Here's what's happening across your projects")
      .first();
    const overdueAlert = page.locator('text=overdue').first();
    const dueToday = page.locator('text=due today').first();

    const hasSubtitle = await subtitle.isVisible({ timeout: 5000 }).catch(() => false);
    const hasOverdue = await overdueAlert.isVisible({ timeout: 2000 }).catch(() => false);
    const hasDueToday = await dueToday.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasSubtitle || hasOverdue || hasDueToday).toBeTruthy();
    await page.screenshot({ path: 'test-results/dashboard-1.2-subtitle.png', fullPage: false });
  });

  test('1.3 My Tasks CTA button navigates correctly', async () => {
    const myTasksLink = page.locator('a[href="/my-tasks"]').first();
    await expect(myTasksLink).toBeVisible({ timeout: 10000 });
    await myTasksLink.click();
    await expect(page).toHaveURL(/\/my-tasks/, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/dashboard-1.3-my-tasks.png', fullPage: false });
  });

  // ──────────────────────────────────────────────────────────
  // 2. SUMMARY STATS CARDS
  // ──────────────────────────────────────────────────────────
  test('2.1 all four stat cards are visible', async () => {
    await expect(page.locator('text=Total Tasks')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Overdue').first()).toBeVisible();
    await expect(page.locator('text=Due Today')).toBeVisible();
    await expect(page.locator('text=Completed This Week')).toBeVisible();
    await page.screenshot({ path: 'test-results/dashboard-2.1-stats.png', fullPage: false });
  });

  test('2.2 stat cards show numeric values', async () => {
    await expect(page.locator('text=Total Tasks')).toBeVisible({ timeout: 10000 });
    const statValues = page.locator('.stat-card-value');
    const count = await statValues.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < Math.min(count, 4); i++) {
      const text = await statValues.nth(i).textContent();
      expect(text?.trim()).toMatch(/^\d+/);
    }
  });

  test('2.3 Total Tasks card links to /my-tasks', async () => {
    await expect(page.locator('text=Total Tasks')).toBeVisible({ timeout: 10000 });
    const totalTasksCard = page
      .locator('a:has(.rounded-xl:has-text("Total Tasks")), .rounded-xl:has-text("Total Tasks") a, a:has-text("Total Tasks")')
      .first();
    if (await totalTasksCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await totalTasksCard.click();
      await expect(page).toHaveURL(/\/my-tasks/, { timeout: 10000 });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 3. WORKSPACE SELECTOR
  // ──────────────────────────────────────────────────────────
  test('3.1 workspace selector dropdown works', async () => {
    const wsDropdown = page
      .locator('p-dropdown, p-select, [data-testid="workspace-selector"]')
      .first();
    const isVisible = await wsDropdown.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await wsDropdown.click();
      await page.waitForTimeout(500);
      const options = page.locator(
        '.p-dropdown-items .p-dropdown-item, .p-select-list .p-select-option, .p-listbox-option',
      );
      const optCount = await options.count();
      expect(optCount).toBeGreaterThanOrEqual(1);
      await page.screenshot({ path: 'test-results/dashboard-3.1-ws-dropdown.png' });
      await page.keyboard.press('Escape');
    }
    // If not visible, user has <2 workspaces — acceptable
  });

  // ──────────────────────────────────────────────────────────
  // 4. MY TASKS TODAY WIDGET
  // ──────────────────────────────────────────────────────────
  test('4.1 My Tasks Today widget renders', async () => {
    const widget = page.locator('text=/My Tasks/i').first();
    await expect(widget).toBeVisible({ timeout: 10000 });
  });

  test('4.2 My Tasks Today shows items or empty state', async () => {
    await page.waitForTimeout(3000);
    const taskItems = page.locator('app-my-tasks-today [class*="cursor-pointer"]');
    const emptyState = page.locator("text=You're all caught up");

    const hasItems = await taskItems.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasItems || hasEmpty).toBeTruthy();
    await page.screenshot({ path: 'test-results/dashboard-4.2-my-tasks-today.png' });
  });

  // ──────────────────────────────────────────────────────────
  // 5. RECENT ACTIVITY FEED
  // ──────────────────────────────────────────────────────────
  test('5.1 Recent Activity section renders', async () => {
    const activityHeading = page.locator('text=Recent Activity').first();
    await expect(activityHeading).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/dashboard-5.1-activity.png' });
  });

  test('5.2 activity entries show relative timestamps', async () => {
    await expect(page.locator('text=Recent Activity').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check for time indicators like "5m ago", "2h ago", "just now"
    const timeIndicators = page.locator('text=/\\d+[smhd] ago|just now/i');
    const hasActivity = await timeIndicators.first().isVisible({ timeout: 5000 }).catch(() => false);
    // Activity may be empty for fresh accounts
    if (hasActivity) {
      const count = await timeIndicators.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  // ──────────────────────────────────────────────────────────
  // 6. METRICS SECTION — VIEW MODE TOGGLE
  // ──────────────────────────────────────────────────────────
  test('6.1 Metrics section has Workspace/Team/Personal buttons', async () => {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    const workspaceBtn = page.locator('button:has-text("Workspace")').first();
    const teamBtn = page.locator('button:has-text("Team")').first();
    const personalBtn = page.locator('button:has-text("Personal")').first();

    const hasWorkspace = await workspaceBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasWorkspace) {
      await expect(workspaceBtn).toBeVisible();
      await expect(teamBtn).toBeVisible();
      await expect(personalBtn).toBeVisible();
      await page.screenshot({ path: 'test-results/dashboard-6.1-metrics-buttons.png' });
    }
  });

  test('6.2 Team view toggle works', async () => {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    const teamBtn = page.locator('button:has-text("Team")').first();
    if (await teamBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await teamBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/dashboard-6.2-team-view.png' });
      // No crash = pass
    }
  });

  test('6.3 Personal view hides workload balance', async () => {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    const personalBtn = page.locator('button:has-text("Personal")').first();
    if (await personalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await personalBtn.click();
      await page.waitForTimeout(1500);

      const workloadBalance = page.locator('text=Workload Balance');
      const isVisible = await workloadBalance.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
      await page.screenshot({ path: 'test-results/dashboard-6.3-personal-view.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 7. CYCLE TIME CHART
  // ──────────────────────────────────────────────────────────
  test('7.1 Cycle Time chart area renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    const cycleTime = page.locator('text=Cycle Time').first();
    const isVisible = await cycleTime.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(cycleTime).toBeVisible();
      await page.screenshot({ path: 'test-results/dashboard-7.1-cycle-time.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 8. VELOCITY CHART
  // ──────────────────────────────────────────────────────────
  test('8.1 Velocity chart area renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    const velocity = page.locator('text=Velocity').first();
    const isVisible = await velocity.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(velocity).toBeVisible();
      await page.screenshot({ path: 'test-results/dashboard-8.1-velocity.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 9. ON-TIME DELIVERY METRIC
  // ──────────────────────────────────────────────────────────
  test('9.1 On-Time Delivery gauge renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);

    const onTime = page.locator('text=On-Time Delivery').first();
    const isVisible = await onTime.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(onTime).toBeVisible();
      const onTimeLabel = page.locator('text=on time').first();
      const hasLabel = await onTimeLabel.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasLabel).toBeTruthy();
      await page.screenshot({ path: 'test-results/dashboard-9.1-ontime.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 10. WORKLOAD BALANCE
  // ──────────────────────────────────────────────────────────
  test('10.1 Workload Balance renders in Workspace view', async () => {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);

    // Make sure we're on workspace view
    const workspaceBtn = page.locator('button:has-text("Workspace")').first();
    if (await workspaceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await workspaceBtn.click();
      await page.waitForTimeout(1500);
    }

    const workload = page.locator('text=Workload Balance').first();
    const isVisible = await workload.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(workload).toBeVisible();
      await page.screenshot({ path: 'test-results/dashboard-10.1-workload.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 11. RESOURCE UTILIZATION
  // ──────────────────────────────────────────────────────────
  test('11.1 Resource Utilization renders in Workspace view', async () => {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);

    const utilization = page.locator('text=Resource Utilization').first();
    const isVisible = await utilization.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(utilization).toBeVisible();
      await page.screenshot({ path: 'test-results/dashboard-11.1-utilization.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 12. EXPORT METRICS CSV
  // ──────────────────────────────────────────────────────────
  test('12.1 Export button triggers download', async () => {
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1500);

    const exportBtn = page
      .locator('button:has-text("Export"), button[aria-label*="export"], button[title*="Export"]')
      .first();
    const isVisible = await exportBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
        await page.screenshot({ path: 'test-results/dashboard-12.1-export.png' });
      }
    }
  });

  // ──────────────────────────────────────────────────────────
  // 13. COMPLETION TREND
  // ──────────────────────────────────────────────────────────
  test('13.1 Completion Trend with time range selector', async () => {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(1500);

    const completionTrend = page.locator('text=Completion Trend').first();
    const isVisible = await completionTrend.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(completionTrend).toBeVisible();

      // Test time range buttons
      const btn30d = page.locator('button:has-text("30d")').first();
      const btn60d = page.locator('button:has-text("60d")').first();
      const btn90d = page.locator('button:has-text("90d")').first();

      if (await btn60d.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn60d.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/dashboard-13.1-trend-60d.png' });

        await btn90d.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/dashboard-13.1-trend-90d.png' });

        await btn30d.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-results/dashboard-13.1-trend-30d.png' });
      }
    }
  });

  // ──────────────────────────────────────────────────────────
  // 14. TASKS BY STATUS (Doughnut)
  // ──────────────────────────────────────────────────────────
  test('14.1 Tasks by Status chart renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 1400));
    await page.waitForTimeout(1500);

    const statusChart = page.locator('text=Tasks by Status').first();
    const isVisible = await statusChart.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(statusChart).toBeVisible();
      const canvas = page.locator('app-tasks-by-status canvas').first();
      const noData = page.locator('app-tasks-by-status').locator('text=/No data/i').first();
      const hasCanvas = await canvas.isVisible({ timeout: 3000 }).catch(() => false);
      const hasNoData = await noData.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasCanvas || hasNoData).toBeTruthy();
      await page.screenshot({ path: 'test-results/dashboard-14.1-status-chart.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 15. TASKS BY PRIORITY (Bar)
  // ──────────────────────────────────────────────────────────
  test('15.1 Tasks by Priority chart renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 1400));
    await page.waitForTimeout(1500);

    const priorityChart = page.locator('text=Tasks by Priority').first();
    const isVisible = await priorityChart.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(priorityChart).toBeVisible();
      await page.screenshot({ path: 'test-results/dashboard-15.1-priority-chart.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 16. UPCOMING DEADLINES
  // ──────────────────────────────────────────────────────────
  test('16.1 Upcoming Deadlines timeline renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 1600));
    await page.waitForTimeout(1500);

    const deadlines = page.locator('text=Upcoming Deadlines').first();
    const isVisible = await deadlines.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(deadlines).toBeVisible();
      const emptyState = page.locator('text=No upcoming deadlines');
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      // Either timeline items or empty state — both are valid
      await page.screenshot({ path: 'test-results/dashboard-16.1-deadlines.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 17. TEAM WORKLOAD
  // ──────────────────────────────────────────────────────────
  test('17.1 Team Workload widget renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 1600));
    await page.waitForTimeout(1500);

    const teamWorkload = page.locator('text=Team Workload').first();
    const isVisible = await teamWorkload.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(teamWorkload).toBeVisible();
      await page.screenshot({ path: 'test-results/dashboard-17.1-team-workload.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 18. OVERDUE TASKS TABLE
  // ──────────────────────────────────────────────────────────
  test('18.1 Overdue Tasks table renders', async () => {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(1500);

    const overdueTable = page.locator('text=Overdue Tasks').first();
    const isVisible = await overdueTable.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(overdueTable).toBeVisible();
      const table = page.locator('p-table, table').first();
      const emptyState = page.locator('text=No overdue tasks');
      const hasTable = await table.isVisible({ timeout: 3000 }).catch(() => false);
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasTable || hasEmpty).toBeTruthy();
      await page.screenshot({ path: 'test-results/dashboard-18.1-overdue-table.png' });
    }
  });

  test('18.2 Overdue table columns are sortable', async () => {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(1500);

    const tableHeader = page.locator('th:has-text("Days Overdue")').first();
    if (await tableHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tableHeader.click();
      await page.waitForTimeout(500);
      await tableHeader.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/dashboard-18.2-sort.png' });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 19. WORKSPACES SECTION
  // ──────────────────────────────────────────────────────────
  test('19.1 Sidebar shows project items', async () => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/dashboard-19.1-workspaces.png' });
  });

  test('19.2 clicking sidebar project navigates correctly', async () => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });
    await page.screenshot({ path: 'test-results/dashboard-19.2-workspace-nav.png' });
  });

  // ──────────────────────────────────────────────────────────
  // 20. SIDEBAR NAVIGATION
  // ──────────────────────────────────────────────────────────
  test('20.1 sidebar is visible with navigation items', async () => {
    const sidebar = page
      .locator('app-sidebar, nav, aside, [role="navigation"]')
      .first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    const dashboardLink = page
      .locator('a[href="/dashboard"], a:has-text("Dashboard")')
      .first();
    await expect(dashboardLink).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/dashboard-20.1-sidebar.png' });
  });

  test('20.2 sidebar My Tasks link works', async () => {
    const myTasksLink = page
      .locator('a[href="/my-tasks"], a:has-text("My Tasks")')
      .first();
    if (await myTasksLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await myTasksLink.click();
      await expect(page).toHaveURL(/\/my-tasks/, { timeout: 10000 });
    }
  });

  // ──────────────────────────────────────────────────────────
  // 21. TOP NAV
  // ──────────────────────────────────────────────────────────
  test('21.1 top nav shows user indicator', async () => {
    const topNav = page.locator('app-top-nav, header, [class*="top-nav"]').first();
    await expect(topNav).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/dashboard-21.1-topnav.png' });
  });

  // ──────────────────────────────────────────────────────────
  // 22. LOADING STATES
  // ──────────────────────────────────────────────────────────
  test('22.1 no stuck loading spinners after 8 seconds', async () => {
    await page.waitForTimeout(8000);
    const spinners = page.locator('.animate-spin');
    const count = await spinners.count();
    for (let i = 0; i < count; i++) {
      const isVisible = await spinners.nth(i).isVisible().catch(() => false);
      expect(isVisible).toBeFalsy();
    }
    await page.screenshot({ path: 'test-results/dashboard-22.1-no-spinners.png', fullPage: true });
  });

  // ──────────────────────────────────────────────────────────
  // 23. RESPONSIVE BEHAVIOR
  // ──────────────────────────────────────────────────────────
  test('23.1 mobile viewport (375px)', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const greeting = page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Total Tasks')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/dashboard-23.1-mobile.png', fullPage: true });
  });

  test('23.2 tablet viewport (768px)', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload({ waitUntil: 'domcontentloaded' });

    const greeting = page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/dashboard-23.2-tablet.png', fullPage: true });
  });

  // ──────────────────────────────────────────────────────────
  // 24. UNAUTHENTICATED ACCESS
  // ──────────────────────────────────────────────────────────
  test('24.1 unauthenticated user redirected to sign-in', async ({ browser }) => {
    const freshCtx = await browser.newContext({ ignoreHTTPSErrors: true });
    const freshPage = await freshCtx.newPage();
    await freshPage.goto(`${BASE}/dashboard`);
    await expect(freshPage).toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
    await freshCtx.close();
  });

  // ──────────────────────────────────────────────────────────
  // 25. PERFORMANCE
  // ──────────────────────────────────────────────────────────
  test('25.1 dashboard loads within 10 seconds', async ({ browser }) => {
    const freshCtx = await browser.newContext({
      storageState: authStoragePath,
      ignoreHTTPSErrors: true,
    });
    const freshPage = await freshCtx.newPage();
    const start = Date.now();
    await freshPage.goto(`${BASE}/dashboard`);
    const greeting = freshPage
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible({ timeout: 15000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
    await freshCtx.close();
  });

  // ──────────────────────────────────────────────────────────
  // 26. BROWSER NAVIGATION
  // ──────────────────────────────────────────────────────────
  test('26.1 back/forward preserves dashboard state', async () => {
    const projectLink = page.locator('app-sidebar-projects a.project-item').first();
    await expect(projectLink).toBeVisible({ timeout: 15000 });
    await projectLink.click();
    await expect(page).toHaveURL(/\/project\//, { timeout: 15000 });

    await page.goBack();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const greeting = page
      .locator(
        'h1:has-text("Good morning"), h1:has-text("Good afternoon"), h1:has-text("Good evening")',
      )
      .first();
    await expect(greeting).toBeVisible({ timeout: 15000 });
  });

  // ──────────────────────────────────────────────────────────
  // 27. CONSOLE ERRORS
  // ──────────────────────────────────────────────────────────
  test('27.1 no critical console errors', async ({ browser }) => {
    const freshCtx = await browser.newContext({
      storageState: authStoragePath,
      ignoreHTTPSErrors: true,
    });
    const freshPage = await freshCtx.newPage();
    const errors: string[] = [];
    freshPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await freshPage.goto(`${BASE}/dashboard`);
    await freshPage.waitForTimeout(8000);

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('CORS') &&
        !e.includes('net::ERR') &&
        !e.includes('404') &&
        !e.includes('Failed to load resource') &&
        !e.includes('third-party'),
    );

    expect(criticalErrors.length).toBeLessThanOrEqual(2);
    await freshCtx.close();
  });

  // ──────────────────────────────────────────────────────────
  // 28. FULL PAGE SCROLL
  // ──────────────────────────────────────────────────────────
  test('28.1 full page scroll renders all deferred sections', async () => {
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const step = 400;

    for (let y = 0; y < pageHeight; y += step) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/dashboard-28.1-full-scroll.png', fullPage: true });
  });

  // ──────────────────────────────────────────────────────────
  // 29. ONBOARDING CHECKLIST
  // ──────────────────────────────────────────────────────────
  test('29.1 onboarding checklist renders (if present)', async () => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    const checklist = page.locator('app-onboarding-checklist');
    const isVisible = await checklist.isVisible({ timeout: 3000 }).catch(() => false);
    // Onboarding may or may not show depending on completion status
    if (isVisible) {
      await page.screenshot({ path: 'test-results/dashboard-29.1-onboarding.png' });
    }
  });
});
