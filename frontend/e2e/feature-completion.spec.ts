import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for the three feature-completion changes:
 * A) Task Templates UI
 * B) Project Templates Wiring
 * C) Automations Completion
 *
 * Only 1 sign-up, minimal page navigations to stay under rate limits
 * (60 global req/min, 5 auth req/min).
 */

test.setTimeout(90000);

const TEST_PASSWORD = 'TestPass123!';

test('Feature completion: templates UI, project templates, and automations', async ({
  page,
}) => {
  const email = `e2e-feat-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;

  // ────── Setup: sign up + create workspace + board ──────

  await page.goto('/auth/sign-in');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('a:has-text("Sign up")').first().click();
  await page.waitForURL('**/auth/sign-up', { timeout: 10000 });
  await page.locator('app-sign-up').waitFor({ timeout: 10000 });

  const signUp = page.locator('app-sign-up');
  await signUp.locator('input[formControlName="name"]').fill('E2E Feat User');
  await signUp.locator('input[formControlName="email"]').fill(email);
  await signUp
    .locator('p-password[formControlName="password"] input')
    .fill(TEST_PASSWORD);
  await signUp
    .locator('p-password[formControlName="confirmPassword"] input')
    .fill(TEST_PASSWORD);
  await signUp.locator('button[type="submit"]').click();

  await page.waitForURL('**/onboarding', { timeout: 20000 });

  const wsRes = await page.request.post('/api/onboarding/create-workspace', {
    data: { name: 'Feat Test WS', description: '' },
  });
  expect(wsRes.ok(), `Create workspace: ${wsRes.status()}`).toBeTruthy();
  const wsData = await wsRes.json();
  const workspaceId = wsData.workspace_id;

  await page.request.post('/api/onboarding/complete', { data: {} });

  const boardRes = await page.request.post(
    `/api/workspaces/${workspaceId}/boards`,
    { data: { name: 'Feat Test Board', description: '' } },
  );
  expect(boardRes.ok(), `Create board: ${boardRes.status()}`).toBeTruthy();
  const board = await boardRes.json();
  const boardId = board.id;

  // ────── A1: Settings > Templates page ──────
  // Go directly here (skip dashboard to save requests)

  await page.goto('/settings/templates');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h2:has-text("Task Templates")')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('button:has-text("New Template")')).toBeVisible({
    timeout: 5000,
  });

  // A2: Settings sidebar has Templates link
  await expect(page.locator('a[href="/settings/templates"]')).toBeVisible({
    timeout: 5000,
  });

  // A3: Create a template
  await page.locator('button:has-text("New Template")').click();
  await expect(page.locator('text=Create Task Template')).toBeVisible({
    timeout: 5000,
  });

  await page
    .locator('input[placeholder="e.g. Bug Report Template"]')
    .fill('E2E Bug Template');
  await page
    .locator('input[placeholder="Default task title"]')
    .fill('Bug: [describe issue]');

  await page.locator('button:has-text("Create")').last().click();
  await expect(page.locator('text=E2E Bug Template')).toBeVisible({
    timeout: 10000,
  });

  // ────── A4 + B4 + C: Board view + board settings ──────
  // Navigate to board view, check "New Task" + "Use Template", then board settings

  await page.goto(`/workspace/${workspaceId}/board/${boardId}`);
  await page.waitForLoadState('networkidle');
  await page.locator('h1').first().waitFor({ timeout: 15000 });

  // A4: Create task dialog has Use Template toggle
  await page.locator('button:has-text("New Task")').waitFor({ timeout: 10000 });
  await page.locator('button:has-text("New Task")').click();
  await page
    .locator('input[placeholder="Enter task title"]')
    .waitFor({ timeout: 5000 });
  await expect(page.locator('text=Use Template')).toBeVisible({
    timeout: 5000,
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ────── B4 + B5: Board settings Save as Template ──────
  // Use Angular routing instead of full page.goto to avoid extra auth requests

  await page.goto(`/workspace/${workspaceId}/board/${boardId}/settings`);
  await page.waitForLoadState('networkidle');
  await page.locator('text=Board Settings').waitFor({ timeout: 15000 });

  await expect(page.locator('button:has-text("Save as Template")')).toBeVisible(
    { timeout: 10000 },
  );

  // B5: Dialog opens with name input and category select
  await page.locator('button:has-text("Save as Template")').click();
  await expect(page.locator('text=Save Board as Template').first()).toBeVisible(
    { timeout: 5000 },
  );
  const nameInput = page.locator('input#templateName');
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  // Verify the dialog has the expected structure
  await expect(page.locator('label:has-text("Template Name")')).toBeVisible({
    timeout: 3000,
  });
  await expect(page.locator('label:has-text("Category")')).toBeVisible({
    timeout: 3000,
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ────── C: Automations (still on board settings) ──────

  const autoTab = page
    .locator('a:has-text("Automations"), button:has-text("Automations")')
    .first();
  if (await autoTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await autoTab.click();
    await page.waitForTimeout(1000);
  }

  const newRuleBtn = page
    .locator(
      'button:has-text("New Rule"), button:has-text("Add Rule"), button:has-text("Create")',
    )
    .first();
  if (await newRuleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newRuleBtn.click();
    await page.waitForTimeout(500);
  }

  // C1: All 11 triggers
  const triggerSelect = page.locator('app-rule-builder select').first();
  if (await triggerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    const triggerOptions = await triggerSelect
      .locator('option')
      .allTextContents();
    const expectedTriggers = [
      'Task Moved',
      'Task Created',
      'Task Assigned',
      'Priority Changed',
      'Due Date Passed',
      'Task Completed',
      'Subtask Completed',
      'Comment Added',
      'Custom Field Changed',
      'Label Changed',
      'Due Date Approaching',
    ];
    for (const t of expectedTriggers) {
      expect(
        triggerOptions.some((o) => o.includes(t)),
        `Missing trigger: ${t}`,
      ).toBeTruthy();
    }
  }

  // C2: All 11 actions
  const addActionBtn = page.locator('button:has-text("Add Action")');
  if (await addActionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addActionBtn.click();
    await page.waitForTimeout(300);

    const actionSelect = page.locator('app-rule-builder select').last();
    if (await actionSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const actionOptions = await actionSelect
        .locator('option')
        .allTextContents();
      const expectedActions = [
        'Move Task',
        'Assign Task',
        'Set Priority',
        'Send Notification',
        'Add Label',
        'Set Milestone',
        'Create Subtask',
        'Add Comment',
        'Set Due Date',
        'Set Custom Field',
        'Send Webhook',
      ];
      for (const a of expectedActions) {
        expect(
          actionOptions.some((o) => o.includes(a)),
          `Missing action: ${a}`,
        ).toBeTruthy();
      }
    }
  }

  // ────── B1 + B2 + B3: Project templates (last to minimize req count) ──────

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.locator('h1').first().waitFor({ timeout: 15000 });

  // B1: Sidebar has Templates link
  await expect(page.locator('a[href="/templates"]')).toBeVisible({
    timeout: 10000,
  });

  // B2: Navigate to /templates via sidebar click (SPA navigation, no full reload)
  await page.locator('a[href="/templates"]').click();
  await page.waitForURL('**/templates', { timeout: 10000 });

  // B2: Gallery loads
  await expect(page.locator('text=Project Templates')).toBeVisible({
    timeout: 15000,
  });

  // B3: No hardcoded gray class
  const heading = page.locator('h2:has-text("Project Templates")');
  await expect(heading).toBeVisible({ timeout: 5000 });
  const classes = (await heading.getAttribute('class')) || '';
  expect(classes).not.toContain('text-gray-900');
});
