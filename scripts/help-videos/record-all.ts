/**
 * Record all tutorial videos using Playwright.
 *
 * Usage:
 *   cd frontend && npx ts-node --project ../tsconfig.scripts.json ../scripts/help-videos/record-all.ts
 *   # Or record a single tutorial:
 *   npx ts-node ... ../scripts/help-videos/record-all.ts dashboard
 */
import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CONFIG } from './config';

// Import all tutorial recorders
import { record as recordDashboard } from './tutorials/01-dashboard-overview';
import { record as recordKanbanBoard } from './tutorials/02-kanban-board';
import { record as recordCreateTask } from './tutorials/03-create-task';

const TUTORIALS: Record<string, { record: (page: Page) => Promise<void>; name: string }> = {
  dashboard: { record: recordDashboard, name: '01-dashboard-overview' },
  kanban: { record: recordKanbanBoard, name: '02-kanban-board' },
  task: { record: recordCreateTask, name: '03-create-task' },
};

async function signIn(page: any): Promise<void> {
  await page.goto(`${CONFIG.baseURL}/auth/sign-in`);
  await page.waitForLoadState('domcontentloaded');

  // Check if already logged in (redirected away from sign-in)
  if (!page.url().includes('/auth/sign-in')) return;

  const emailInput = page.locator('input[type="email"], input[formControlName="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(CONFIG.credentials.email);

  const passwordInput = page.locator('p-password input[type="password"], input[type="password"]').first();
  await passwordInput.fill(CONFIG.credentials.password);

  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL('**/dashboard', { timeout: 25000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

function convertToMp4(webmPath: string, mp4Path: string): void {
  console.log(`  Converting to MP4: ${path.basename(mp4Path)}`);
  execSync(
    `ffmpeg -y -i "${webmPath}" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`,
    { stdio: 'pipe' },
  );
  // Remove the webm source
  fs.unlinkSync(webmPath);
}

async function main(): Promise<void> {
  const filter = process.argv[2];
  const toRecord = filter
    ? Object.entries(TUTORIALS).filter(([key]) => key === filter)
    : Object.entries(TUTORIALS);

  if (toRecord.length === 0) {
    console.error(`Unknown tutorial: ${filter}. Available: ${Object.keys(TUTORIALS).join(', ')}`);
    process.exit(1);
  }

  // Ensure output dir exists
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // Sign in once, save storage state for reuse
  const authContext = await browser.newContext({
    viewport: CONFIG.viewport,
  });
  const authPage = await authContext.newPage();
  await signIn(authPage);
  const storageState = await authContext.storageState();
  await authContext.close();

  console.log(`\nRecording ${toRecord.length} tutorial(s)...\n`);

  for (const [key, tutorial] of toRecord) {
    console.log(`Recording: ${tutorial.name}`);

    // Create context with video recording + saved auth
    const context = await browser.newContext({
      viewport: CONFIG.viewport,
      recordVideo: {
        dir: CONFIG.outputDir,
        size: CONFIG.videoSize,
      },
      storageState,
    });

    const page = await context.newPage();

    try {
      await tutorial.record(page);
    } catch (err) {
      console.error(`  ERROR in ${tutorial.name}:`, err);
    }

    // Close context to finalize video
    await context.close();

    // Find the recorded webm and rename/convert
    const videoPath = await page.video()?.path();
    if (videoPath && fs.existsSync(videoPath)) {
      const mp4Path = path.join(CONFIG.outputDir, `${tutorial.name}.mp4`);
      convertToMp4(videoPath, mp4Path);
      console.log(`  Saved: ${mp4Path}\n`);
    } else {
      console.log(`  WARNING: No video file found for ${tutorial.name}\n`);
    }
  }

  await browser.close();
  console.log('All recordings complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
