import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  // Paths relative to this config file's directory (frontend/e2e/)
  testDir: './comprehensive',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 1,
  workers: 1, // Sequential to avoid auth conflicts
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: path.join(
          __dirname,
          '..',
          'playwright-report-comprehensive',
        ),
        open: 'never',
      },
    ],
  ],
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  use: {
    baseURL: 'https://taskflow.paraslace.in',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: path.join(__dirname, '..', 'test-results-comprehensive'),
});
