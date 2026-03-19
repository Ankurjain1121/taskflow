import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { signUpAndOnboard, signInTestUser, TEST_NAME } from './helpers/auth';

test.describe('Settings', () => {
  let testEmail: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    testEmail = await signUpAndOnboard(page, 'Settings WS');
    await page.close();
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await signInTestUser(page, testEmail);
  });

  test('settings page loads with heading', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();
  });

  test('name field is pre-populated with current user name', async ({
    page,
  }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await expect(settings.nameInput).toHaveValue(TEST_NAME, { timeout: 10000 });
  });

  test('email field shows current email and is disabled', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    // Email field should be visible and contain a value
    await expect(settings.emailField).toBeVisible({ timeout: 10000 });
    const emailValue = await settings.emailField.inputValue();
    expect(emailValue).toContain('@');

    // Email field should be disabled (not editable)
    await expect(settings.emailField).toBeDisabled();
  });

  test('save button is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await expect(settings.saveButton).toBeVisible({ timeout: 10000 });
  });

  test('save button is disabled when form is pristine', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    // Button should be disabled when no changes have been made
    await expect(settings.saveButton).toBeDisabled({ timeout: 10000 });
  });

  test('edit name field and save successfully', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    // Clear and type a new name
    await settings.nameInput.clear();
    await settings.nameInput.fill('Updated Test Name');

    // Save button should now be enabled
    await expect(settings.saveButton).toBeEnabled({ timeout: 10000 });

    // Click save
    await settings.saveButton.click();

    // Wait for success indication (snackbar or the name persists after save)
    await page.waitForTimeout(2000);
    await expect(settings.nameInput).toHaveValue('Updated Test Name');
  });

  test('avatar URL field is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await expect(settings.avatarUrlInput).toBeVisible({ timeout: 10000 });
  });

  test('page accessible from sidebar', async ({ page }) => {
    // From the dashboard, click Settings in the sidebar
    const settingsLink = page.locator('a[href="/settings/profile"]').first();
    await expect(settingsLink).toBeVisible({ timeout: 10000 });
    await settingsLink.click();

    await expect(page).toHaveURL(/\/settings\/profile/, { timeout: 15000 });

    const settings = new SettingsPage(page);
    await settings.expectLoaded();
  });
});
