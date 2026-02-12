import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { signUpAndOnboard, TEST_NAME } from './helpers/auth';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await signUpAndOnboard(page, 'Settings WS');
  });

  test('profile settings page loads with heading', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();
  });

  test('name field is pre-populated with current user name', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await expect(settings.nameInput).toHaveValue(TEST_NAME, { timeout: 10000 });
  });

  test('email field shows current email and is read-only', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    // Email field should be visible and contain a value
    await expect(settings.emailField).toBeVisible({ timeout: 10000 });
    const emailValue = await settings.emailField.inputValue();
    expect(emailValue).toContain('@');

    // Email field should be readonly
    await expect(settings.emailField).toHaveAttribute('readonly', '');
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

    // Wait for success snackbar or save button to become disabled again (pristine)
    await expect(settings.saveButton).toBeDisabled({ timeout: 15000 });
  });

  test('phone number field is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await expect(settings.phoneInput).toBeVisible({ timeout: 10000 });
  });

  test('avatar URL field is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await expect(settings.avatarUrlInput).toBeVisible({ timeout: 10000 });
  });

  test('notification preferences link is visible', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await expect(settings.notificationsLink).toBeVisible({ timeout: 10000 });
  });

  test('clicking notification link navigates to notifications page', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();
    await settings.expectLoaded();

    await settings.notificationsLink.click();
    await expect(page).toHaveURL(/\/settings\/notifications/, { timeout: 15000 });
  });
});
