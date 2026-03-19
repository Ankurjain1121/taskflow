import { test, expect } from '@playwright/test';
import { signUpAndOnboard, signInTestUser } from './helpers/auth';

test.describe('Theme Preferences Save', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    testEmail = await signUpAndOnboard(page, 'Theme Test WS');
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
  });

  test('theme preference PUT returns 200 after login', async ({ page }) => {
    // Verify the response
    const status = await page.evaluate(() => {
      return fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ color_mode: 'dark' }),
      }).then((r) => r.status);
    });

    expect(status).toBe(200);
  });

  test('partial theme update preserves existing preferences', async ({
    page,
  }) => {
    // First, get current preferences
    const before = await page.evaluate(() =>
      fetch('/api/users/me/preferences', { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    );

    // Send a partial update with only color_mode
    const updateStatus = await page.evaluate(() =>
      fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ color_mode: 'dark' }),
      }).then((r) => r.status),
    );
    expect(updateStatus).toBe(200);

    // Fetch again and verify other fields are preserved
    const after = await page.evaluate(() =>
      fetch('/api/users/me/preferences', { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    );

    expect(after.color_mode).toBe('dark');
    expect(after.timezone).toBe(before.timezone);
    expect(after.date_format).toBe(before.date_format);
    expect(after.sidebar_density).toBe(before.sidebar_density);
  });

  test('accent color saves and persists', async ({ page }) => {
    const updateStatus = await page.evaluate(() =>
      fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accent_color: 'rose' }),
      }).then((r) => r.status),
    );
    expect(updateStatus).toBe(200);

    const prefs = await page.evaluate(() =>
      fetch('/api/users/me/preferences', { credentials: 'include' }).then((r) =>
        r.json(),
      ),
    );
    expect(prefs.accent_color).toBe('rose');
  });
});
