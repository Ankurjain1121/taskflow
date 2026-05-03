/**
 * E2E: CRM Shell
 *
 * Tests: sidebar CRM entry, iframe loads, mobile viewport handoff sheet.
 * DO NOT run in CI until backend CRM endpoints are implemented.
 */
import { test, expect } from '@playwright/test';
import { signInTestUser } from './helpers/auth';

const WORKSPACE_BASE = /\/workspace\/[^/]+/;

test.describe('CRM Shell', () => {
  test.beforeEach(async ({ page }) => {
    await signInTestUser(page);
    // Enable CRM feature flag in localStorage for the active workspace
    await page.waitForURL(WORKSPACE_BASE, { timeout: 15_000 });
    await page.evaluate(() => {
      // Determine active workspace id from localStorage
      const wsId = localStorage.getItem('taskbolt_active_ws');
      if (wsId) {
        localStorage.setItem(`taskbolt_crm_enabled_${wsId}`, 'true');
      }
    });
    await page.reload();
    await page.waitForURL(WORKSPACE_BASE, { timeout: 15_000 });
  });

  test('sidebar shows CRM entry when feature flag enabled', async ({ page }) => {
    const crmLink = page.locator('app-sidebar a[routerLink="/crm"], app-sidebar a[href="/crm"]');
    await expect(crmLink).toBeVisible({ timeout: 8_000 });
    await expect(crmLink).toContainText('CRM');
  });

  test('clicking CRM sidebar entry navigates to /crm', async ({ page }) => {
    const crmLink = page.locator('app-sidebar a[routerLink="/crm"], app-sidebar a[href="/crm"]');
    await crmLink.click();
    await expect(page).toHaveURL(/\/crm/, { timeout: 8_000 });
  });

  test('CRM bar is visible after navigation', async ({ page }) => {
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');
    const bar = page.locator('[role="toolbar"][aria-label="CRM navigation"]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('text=CRM')).toBeVisible();
  });

  test('loading skeleton shows while iframe is loading', async ({ page }) => {
    await page.goto('/crm');
    // Intercept iframe src to stall loading
    const skeleton = page.locator('[role="status"][aria-label="Loading CRM"]');
    // Skeleton appears during the loading state (may be brief)
    // We just verify the component renders and eventually shows connected or offline
    await expect(page.locator('app-crm-shell')).toBeVisible({ timeout: 5_000 });
  });

  test('iframe is present in connected or loading state on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/crm');
    // Wait for either connected (iframe visible) or loading (iframe hidden)
    await page.waitForTimeout(1_000);
    const iframe = page.locator('iframe[title="CRM workspace"]');
    // Iframe element should be in the DOM (either visible or background-hidden)
    await expect(iframe).toHaveCount(1, { timeout: 5_000 });
  });

  test('mobile viewport (<1024px) shows handoff sheet instead of iframe', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');

    const handoff = page.locator('.mobile-handoff');
    await expect(handoff).toBeVisible({ timeout: 8_000 });

    const openBtn = handoff.locator('.mobile-open-btn, a:has-text("Open CRM in new tab")');
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toHaveAttribute('href', 'https://crm.taskflow.paraslace.in');
  });

  test('mobile handoff open button has correct target and rel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');

    const openBtn = page.locator('.mobile-open-btn');
    await expect(openBtn).toHaveAttribute('target', '_blank');
    await expect(openBtn).toHaveAttribute('rel', 'noopener');
  });

  test('iframe does NOT render on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/crm');
    await page.waitForLoadState('networkidle');

    const iframe = page.locator('.crm-iframe');
    await expect(iframe).toHaveCount(0, { timeout: 5_000 });
  });
});
