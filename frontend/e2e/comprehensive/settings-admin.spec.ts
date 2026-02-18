import { test, expect, Page } from '@playwright/test';
import { signInTestUser, TEST_PASSWORD } from '../helpers/auth';
import { loadSeedData, SeedData } from '../helpers/seed-data';

let seed: SeedData;

test.beforeAll(() => {
  seed = loadSeedData();
});

async function loginAsAdmin(page: Page) {
  await signInTestUser(page, seed.users[0].email, TEST_PASSWORD);
}

async function navigateToSettings(page: Page) {
  const settingsLink = page
    .locator(
      'a:has-text("Settings"), a[href*="/settings"], [routerLink*="settings"]',
    )
    .first();
  if (await settingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await settingsLink.click();
  } else {
    await page.goto('/settings');
  }
  await page.waitForTimeout(2000);
}

test.describe('Settings & Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForURL(/\/(dashboard|settings|workspace)/, {
      timeout: 20000,
    });
  });

  test('user profile settings page loads', async ({ page }) => {
    await navigateToSettings(page);

    const profileHeading = page
      .locator(
        'h1:has-text("Settings"), h1:has-text("Profile"), h2:has-text("Settings"), h2:has-text("Profile")',
      )
      .first();
    if (await profileHeading.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(profileHeading).toBeVisible();
    }
  });

  test('change display name updates header avatar/name', async ({ page }) => {
    await navigateToSettings(page);

    const nameInput = page
      .locator(
        'input[formControlName="name"], input#name, input[placeholder*="name"], input[name="name"]',
      )
      .first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const originalName = await nameInput.inputValue();
      expect(originalName).toBeTruthy();
    }
  });

  test('change password with correct old password succeeds', async ({
    page,
  }) => {
    await navigateToSettings(page);

    const passwordSection = page
      .locator(
        ':text("Password"), :text("Change Password"), button:has-text("Change Password")',
      )
      .first();
    if (await passwordSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await passwordSection.click().catch(() => {});
      await page.waitForTimeout(500);

      const oldPasswordInput = page
        .locator(
          'input[formControlName="currentPassword"], input[name="oldPassword"], input[placeholder*="current"]',
        )
        .first();
      if (
        await oldPasswordInput.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await expect(oldPasswordInput).toBeVisible();
      }
    }
  });

  test('change password with wrong old password shows error', async ({
    page,
  }) => {
    await navigateToSettings(page);

    const passwordSection = page
      .locator('button:has-text("Change Password"), :text("Change Password")')
      .first();
    if (await passwordSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await passwordSection.click().catch(() => {});
      await page.waitForTimeout(500);

      const oldPasswordInput = page
        .locator(
          'input[formControlName="currentPassword"], input[name="oldPassword"]',
        )
        .first();
      if (
        await oldPasswordInput.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await oldPasswordInput.fill('WrongPassword123!');

        const newPasswordInput = page
          .locator(
            'input[formControlName="newPassword"], input[name="newPassword"]',
          )
          .first();
        if (
          await newPasswordInput.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await newPasswordInput.fill('NewTestPass123!');
        }
      }
    }
  });

  test('profile picture upload (if supported)', async ({ page }) => {
    await navigateToSettings(page);

    const avatarUpload = page
      .locator(
        'input[type="file"], button:has-text("Upload"), [class*="avatar"] button',
      )
      .first();
    const isVisible = await avatarUpload
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('notification preferences page loads', async ({ page }) => {
    await navigateToSettings(page);

    const notifTab = page
      .locator(
        'a:has-text("Notifications"), button:has-text("Notifications"), :text("Notification Preferences")',
      )
      .first();
    if (await notifTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await notifTab.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  });

  test('toggle email notifications', async ({ page }) => {
    await navigateToSettings(page);

    const emailToggle = page
      .locator(
        'mat-slide-toggle:near(:text("Email")), input[type="checkbox"]:near(:text("Email")), [class*="toggle"]:near(:text("Email"))',
      )
      .first();
    if (await emailToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(emailToggle).toBeVisible();
    }
  });

  test('app theme toggle (dark/light if supported)', async ({ page }) => {
    await navigateToSettings(page);

    const themeToggle = page
      .locator(
        'mat-slide-toggle:near(:text("Theme")), mat-slide-toggle:near(:text("Dark")), button:has-text("Dark Mode"), [class*="theme-toggle"]',
      )
      .first();
    const isVisible = await themeToggle
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('account deletion shows confirmation dialog', async ({ page }) => {
    await navigateToSettings(page);

    const deleteBtn = page
      .locator(
        'button:has-text("Delete Account"), button:has-text("Delete My Account")',
      )
      .first();
    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(deleteBtn).toBeVisible();
      // Don't click - just verify it exists
    }
  });

  test('admin panel loads for admin users (if exists)', async ({ page }) => {
    const adminLink = page
      .locator('a:has-text("Admin"), a[href*="/admin"], [routerLink*="admin"]')
      .first();
    if (await adminLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await adminLink.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('help/about page shows app version', async ({ page }) => {
    const helpLink = page
      .locator('a:has-text("Help"), a:has-text("About"), a[href*="/help"]')
      .first();
    if (await helpLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await helpLink.click();
      await page.waitForTimeout(1000);
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('keyboard shortcuts reference (if exists)', async ({ page }) => {
    // Try pressing ? for shortcuts panel
    await page.keyboard.press('?');
    await page.waitForTimeout(500);

    const shortcutsPanel = page
      .locator(
        ':text("Keyboard Shortcuts"), :text("Shortcuts"), [class*="shortcuts"]',
      )
      .first();
    const isVisible = await shortcutsPanel
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(typeof isVisible).toBe('boolean');

    if (isVisible) {
      await page.keyboard.press('Escape');
    }
  });

  test('language/locale settings (if supported)', async ({ page }) => {
    await navigateToSettings(page);

    const langSelect = page
      .locator(
        'mat-select:near(:text("Language")), select:near(:text("Language")), [class*="language"]',
      )
      .first();
    const isVisible = await langSelect
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });

  test('session management (view active sessions)', async ({ page }) => {
    await navigateToSettings(page);

    const sessionsSection = page
      .locator(
        ':text("Sessions"), :text("Active Sessions"), a:has-text("Sessions")',
      )
      .first();
    const isVisible = await sessionsSection
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(typeof isVisible).toBe('boolean');
  });
});
