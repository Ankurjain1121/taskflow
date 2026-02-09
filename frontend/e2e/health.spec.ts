import { test, expect } from '@playwright/test';

test.describe('API Health Check', () => {
  test('GET /api/health returns 200 with healthy status', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('healthy');
  });

  test('frontend serves the Angular app', async ({ page }) => {
    const response = await page.goto('/');

    // The page should load (200 or redirect)
    expect(response?.status()).toBeLessThan(400);

    // The Angular app should bootstrap - check for <app-root>
    await expect(page.locator('app-root')).toBeAttached({ timeout: 15000 });
  });
});
