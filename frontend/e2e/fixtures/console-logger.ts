import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extended test fixture that captures all browser console messages
 * and attaches them to the test report on failure.
 */
export const test = base.extend<{ consoleLogs: string[] }>({
  consoleLogs: [
    async ({}, use) => {
      const logs: string[] = [];
      await use(logs);
    },
    { scope: 'test' },
  ],

  page: async ({ page, consoleLogs }, use, testInfo) => {
    // Capture all console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const timestamp = new Date().toISOString();
      const entry = `[${timestamp}] [${type.toUpperCase()}] ${text}`;
      consoleLogs.push(entry);
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      const timestamp = new Date().toISOString();
      consoleLogs.push(
        `[${timestamp}] [PAGE_ERROR] ${error.message}\n${error.stack || ''}`,
      );
    });

    // Capture failed network requests
    page.on('requestfailed', (request) => {
      const timestamp = new Date().toISOString();
      const failure = request.failure();
      consoleLogs.push(
        `[${timestamp}] [REQUEST_FAILED] ${request.method()} ${request.url()} - ${failure?.errorText || 'unknown'}`,
      );
    });

    // Capture 4xx/5xx responses
    page.on('response', (response) => {
      if (response.status() >= 400) {
        const timestamp = new Date().toISOString();
        consoleLogs.push(
          `[${timestamp}] [HTTP_${response.status()}] ${response.url()}`,
        );
      }
    });

    await use(page);

    // After test: attach console logs to report
    if (consoleLogs.length > 0) {
      const logContent = consoleLogs.join('\n');

      // Always attach logs as test artifact
      await testInfo.attach('console-logs', {
        body: logContent,
        contentType: 'text/plain',
      });

      // Also write to a file for easy aggregation
      const logsDir = path.join(
        process.cwd(),
        'test-results',
        'console-logs',
      );
      fs.mkdirSync(logsDir, { recursive: true });

      const safeTitle = testInfo.title.replace(/[^a-zA-Z0-9_-]/g, '_');
      const logFile = path.join(
        logsDir,
        `${testInfo.project.name}-${safeTitle}-${testInfo.retry}.log`,
      );
      fs.writeFileSync(logFile, logContent, 'utf-8');
    }
  },
});

export { expect } from '@playwright/test';
