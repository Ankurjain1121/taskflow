/**
 * CRM Phase 9 — Playwright E2E specs.
 *
 * Coverage:
 *   T-E2E-1: Sidebar CRM click → iframe loads OR mobile sheet (viewport-dependent)
 *   T-E2E-2: Link task to deal from drawer → reload → link persists
 *   T-E2E-5: Twenty container offline → CRM route shows degraded state, not crash
 *
 * Execution policy:
 *   Tests that require a live Twenty instance are wrapped with `test.skip()` and
 *   annotated with the prerequisite.  Structural / UI-only assertions run freely.
 *
 * Dependencies (W9/W10 frontend):
 *   - app-crm-shell component or equivalent CRM route must be registered
 *   - Sidebar must render the "CRM" nav entry
 *   - Task detail drawer must render "Linked Contacts / Companies / Deals" section
 */

import { test, expect, Page } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function loginAndGoToDashboard(page: Page): Promise<void> {
  await signUpAndOnboard(page, 'CRM E2E Test WS');
  // After onboarding we land on the board page; navigate to dashboard explicitly.
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

// ─── T-E2E-1: Sidebar CRM click ──────────────────────────────────────────────

test.describe('T-E2E-1: CRM sidebar entry', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToDashboard(page);
  });

  test(
    'desktop (1280×800): click CRM → iframe loads within 30s',
    async ({ page }) => {
      // Skip until W9/W10 frontend CRM route is merged.
      test.skip(
        true,
        'requires W9/W10 frontend: CRM route + app-crm-shell component',
      );

      await page.setViewportSize({ width: 1280, height: 800 });

      // Sidebar CRM nav entry
      const crmLink = page.locator('[data-testid="sidebar-crm-link"]').or(
        page.locator('a[href="/crm"]'),
      );
      await expect(crmLink).toBeVisible({ timeout: 5000 });
      await crmLink.click();

      await expect(page).toHaveURL(/\/crm/, { timeout: 5000 });

      // The CRM shell should render an iframe pointing at Twenty.
      const iframe = page.locator('app-crm-shell iframe, [data-testid="crm-iframe"]');
      await expect(iframe).toBeVisible({ timeout: 30_000 });

      // Verify the iframe src is set (non-empty).
      const src = await iframe.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toBe('');
    },
  );

  test(
    'mobile (375×812): tap CRM → mobile handoff sheet appears, NOT iframe',
    async ({ page }) => {
      test.skip(
        true,
        'requires W9/W10 frontend: CRM mobile sheet + responsive routing',
      );

      await page.setViewportSize({ width: 375, height: 812 });

      const crmLink = page.locator('[data-testid="sidebar-crm-link"]').or(
        page.locator('a[href="/crm"]'),
      );
      await expect(crmLink).toBeVisible({ timeout: 5000 });
      await crmLink.click();

      await expect(page).toHaveURL(/\/crm/, { timeout: 5000 });

      // Mobile viewport must NOT render the embedded iframe (too cramped).
      const iframe = page.locator('app-crm-shell iframe, [data-testid="crm-iframe"]');
      await expect(iframe).not.toBeVisible({ timeout: 3000 });

      // Instead a bottom sheet / handoff banner must appear.
      const mobileSheet = page
        .locator('[data-testid="crm-mobile-sheet"]')
        .or(page.locator('app-crm-mobile-handoff'));
      await expect(mobileSheet).toBeVisible({ timeout: 5000 });
    },
  );

  test(
    'CRM route does not 404 or throw a JS error on navigation',
    async ({ page }) => {
      test.skip(
        true,
        'requires W9/W10 frontend: CRM Angular route registered in app routing',
      );

      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto('/crm');
      await page.waitForLoadState('networkidle');

      // The route must exist (no redirect to 404 / error page).
      await expect(page.locator('app-root')).toBeAttached({ timeout: 10_000 });
      expect(errors, `Unexpected JS errors on /crm: ${errors.join('; ')}`).toHaveLength(0);
    },
  );
});

// ─── T-E2E-2: Link task to deal, persist across reload ───────────────────────

test.describe('T-E2E-2: Task–Deal linking', () => {
  test(
    'link a deal from task drawer → reload → link still present',
    async ({ page }) => {
      test.skip(
        true,
        'requires W8 backend (link routes) + W9/W10 frontend (linked-crm section in task drawer)',
      );

      await loginAndGoToDashboard(page);

      // Navigate to a board and open a task.
      await page.locator('app-sidebar-projects .project-item').first().click();
      await page.waitForLoadState('networkidle');

      // Open the first task card to show the detail drawer.
      const firstTask = page.locator('.task-card, [data-testid="task-card"]').first();
      await expect(firstTask).toBeVisible({ timeout: 10_000 });
      await firstTask.click();

      // The task drawer must show a "Linked CRM" or "Deals" section.
      const linkedSection = page
        .locator('[data-testid="linked-crm-deals"]')
        .or(page.locator('app-linked-crm-deals'));
      await expect(linkedSection).toBeVisible({ timeout: 5000 });

      // Click the "Link deal" button / search input.
      const linkDealBtn = page
        .locator('[data-testid="link-deal-btn"]')
        .or(page.locator('button:has-text("Link deal"), button:has-text("Add deal")'));
      await expect(linkDealBtn).toBeVisible({ timeout: 5000 });
      await linkDealBtn.click();

      // Type in the search picker (e.g. "Acme").
      const searchInput = page.locator(
        '[data-testid="crm-deal-search"], input[placeholder*="deal"], input[placeholder*="Search"]',
      );
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill('Acme');

      // Select the first matching result.
      const firstResult = page
        .locator('[data-testid="crm-deal-result"]')
        .or(page.locator('.crm-search-result'))
        .first();
      await expect(firstResult).toBeVisible({ timeout: 10_000 });
      await firstResult.click();

      // The linked deal chip / row should now appear in the drawer.
      const linkedDealChip = page
        .locator('[data-testid="linked-deal-chip"]')
        .or(page.locator('.linked-deal'));
      await expect(linkedDealChip).toBeVisible({ timeout: 5000 });

      // Reload the page and re-open the same task — link must persist.
      await page.reload();
      await page.waitForLoadState('networkidle');

      const sameTask = page.locator('.task-card, [data-testid="task-card"]').first();
      await sameTask.click();

      await expect(linkedDealChip).toBeVisible({ timeout: 10_000 });
    },
  );
});

// ─── T-E2E-5: Twenty offline → degraded state ────────────────────────────────

test.describe('T-E2E-5: Degraded CRM state when Twenty is offline', () => {
  test(
    'CRM route shows degraded / offline banner when Twenty is unreachable',
    async ({ page }) => {
      test.skip(
        true,
        'requires W9/W10 frontend degraded-state UI + ability to simulate Twenty offline',
      );

      await loginAndGoToDashboard(page);

      // Simulate Twenty being unreachable by aborting all requests to the
      // Twenty origin (adjust the URL pattern to match the test env config).
      await page.route('**/twenty/**', (route) => route.abort('connectionrefused'));
      await page.route('**/api/integrations/twenty/health', (route) =>
        route.fulfill({ status: 503, body: JSON.stringify({ status: 'down' }) }),
      );

      await page.goto('/crm');
      await page.waitForLoadState('networkidle');

      // Must NOT crash with an unhandled error.
      const pageError = page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null);
      expect(await pageError).toBeNull();

      // Must show a degraded / offline indicator, not a blank page or spinner.
      const degradedBanner = page
        .locator('[data-testid="crm-degraded-banner"]')
        .or(page.locator('app-crm-offline'))
        .or(page.locator(':text("unavailable"), :text("offline"), :text("degraded")'));
      await expect(degradedBanner).toBeVisible({ timeout: 10_000 });

      // The rest of the TaskBolt UI (sidebar, nav) must still be functional.
      await expect(page.locator('app-sidebar')).toBeVisible({ timeout: 5000 });
    },
  );

  test(
    'CRM health endpoint returns 503 → health indicator in /settings/integrations turns red',
    async ({ page }) => {
      test.skip(
        true,
        'requires W9/W10 frontend: /settings/integrations CRM health indicator',
      );

      await loginAndGoToDashboard(page);

      // Mock the health endpoint to return 503.
      await page.route('**/api/integrations/twenty/health', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'down', reason: 'connection_refused' }),
        }),
      );

      await page.goto('/settings/integrations');
      await page.waitForLoadState('networkidle');

      const healthIndicator = page
        .locator('[data-testid="crm-health-indicator"]')
        .or(page.locator('app-crm-health-status'));
      await expect(healthIndicator).toBeVisible({ timeout: 5000 });

      // The indicator must communicate an error state visually.
      // Accept either an aria-label, a CSS class, or text content.
      await expect(healthIndicator).toHaveAttribute('data-status', /down|error|offline/, {
        timeout: 5000,
      }).catch(async () => {
        // Fallback: check text content
        await expect(healthIndicator).toContainText(/down|offline|error|unavailable/i);
      });
    },
  );
});
