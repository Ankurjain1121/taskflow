import { test, expect } from '@playwright/test';
import { signUpAndOnboard } from './helpers/auth';

test.describe('Theme Preferences Save', () => {
  test('theme preference PUT returns 200 after login', async ({ page }) => {
    // Sign up and onboard a fresh user
    await signUpAndOnboard(page, 'Theme Test WS');

    // Intercept the preferences PUT request
    const putPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/users/me/preferences') &&
        resp.request().method() === 'PUT',
      { timeout: 15000 },
    );

    // Change theme by calling the API directly through the browser
    await page.evaluate(() => {
      return fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ color_mode: 'dark' }),
      }).then((r) => r.status);
    });

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
    await signUpAndOnboard(page, 'Theme Partial WS');

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
    await signUpAndOnboard(page, 'Accent Test WS');

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
