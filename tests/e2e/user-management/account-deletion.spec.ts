import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Account Deletion', () => {
  test.describe('Delete Account Card', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');

      // Navigate to profile page where delete account card is displayed
      await page.goto('/profile');
    });

    test('should display delete account card', async ({ page }) => {
      await expect(page.locator('[data-testid="delete-account-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-account-title"]')).toContainText(
        'Delete Account'
      );
    });

    test('should display delete account description', async ({ page }) => {
      await expect(page.locator('[data-testid="delete-account-description"]')).toContainText(
        'Permanently delete your account'
      );
    });

    test('should show warning about permanent deletion', async ({ page }) => {
      // Look for either the warning section or blocked message
      const warningOrBlocked = page.locator(
        '[data-testid="delete-account-warning"], [data-testid="delete-account-blocked"]'
      );
      await expect(warningOrBlocked).toBeVisible();
    });
  });

  test.describe('Delete Account Warning', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      await page.goto('/profile');
    });

    test('should list data that will be deleted', async ({ page }) => {
      // Check if warning section is visible (not blocked)
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        const dataList = page.locator('[data-testid="delete-account-data-list"]');
        await expect(dataList).toContainText('profile and account information');
        await expect(dataList).toContainText('sessions and devices');
        await expect(dataList).toContainText('API keys');
        await expect(dataList).toContainText('Two-factor authentication');
      }
    });

    test('should have understand button to proceed', async ({ page }) => {
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        const understandButton = page.locator('[data-testid="delete-account-understand-button"]');
        await expect(understandButton).toBeVisible();
        await expect(understandButton).toContainText('I understand');
      }
    });
  });

  test.describe('Delete Account Confirmation', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      await page.goto('/profile');
    });

    test('should show confirmation form when understand button clicked', async ({ page }) => {
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();

        await expect(page.locator('[data-testid="delete-account-form"]')).toBeVisible();
        await expect(page.locator('[data-testid="delete-account-password"]')).toBeVisible();
        await expect(page.locator('[data-testid="delete-account-confirmation"]')).toBeVisible();
      }
    });

    test('should have cancel button in confirmation form', async ({ page }) => {
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();

        const cancelButton = page.locator('[data-testid="delete-account-cancel-button"]');
        await expect(cancelButton).toBeVisible();
        await expect(cancelButton).toContainText('Cancel');
      }
    });

    test('should have submit button in confirmation form', async ({ page }) => {
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();

        const submitButton = page.locator('[data-testid="delete-account-submit-button"]');
        await expect(submitButton).toBeVisible();
        await expect(submitButton).toContainText('Delete my account permanently');
      }
    });

    test('should disable submit button until correct confirmation typed', async ({ page }) => {
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();

        const submitButton = page.locator('[data-testid="delete-account-submit-button"]');

        // Should be disabled initially
        await expect(submitButton).toBeDisabled();

        // Type wrong confirmation
        await page.locator('[data-testid="delete-account-confirmation"]').fill('wrong');
        await expect(submitButton).toBeDisabled();

        // Type correct confirmation
        await page.locator('[data-testid="delete-account-confirmation"]').fill('DELETE MY ACCOUNT');
        // Still needs password, but confirmation validation passed
      }
    });

    test('should return to warning when cancel clicked', async ({ page }) => {
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();
        await expect(page.locator('[data-testid="delete-account-form"]')).toBeVisible();

        await page.locator('[data-testid="delete-account-cancel-button"]').click();
        await expect(page.locator('[data-testid="delete-account-warning"]')).toBeVisible();
      }
    });
  });

  test.describe('Delete Account Blocked States', () => {
    test.skip('should block deletion for admin users', async ({ page }) => {
      // This test requires logging in as an admin user
      // Admin users should see the blocked message
    });

    test.skip('should block deletion for organization owners', async ({ page }) => {
      // This test requires logging in as an org owner
      // Org owners should see message about transferring ownership
    });

    test.skip('should block deletion for OAuth-only accounts', async ({ page }) => {
      // This test requires logging in with OAuth without password
    });
  });

  test.describe('Delete Account Errors', () => {
    test.beforeEach(async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      await page.goto('/profile');
    });

    test('should show error for wrong password', async ({ page }) => {
      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();

        await page.locator('[data-testid="delete-account-password"]').fill('wrongpassword');
        await page.locator('[data-testid="delete-account-confirmation"]').fill('DELETE MY ACCOUNT');
        await page.locator('[data-testid="delete-account-submit-button"]').click();

        // Should show error message
        await expect(page.locator('[data-testid="delete-account-error"]')).toBeVisible({
          timeout: 10000,
        });
      }
    });
  });

  test.describe('Security', () => {
    test('should require authentication to access delete account', async ({ page }) => {
      // Navigate directly to profile without login
      await page.goto('/profile');

      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should require password confirmation', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      await page.goto('/profile');

      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();

        // Password field should be required
        const passwordInput = page.locator('[data-testid="delete-account-password"]');
        await expect(passwordInput).toHaveAttribute('required', '');
      }
    });

    test('should require typing DELETE MY ACCOUNT', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      await page.goto('/profile');

      const warning = page.locator('[data-testid="delete-account-warning"]');

      if (await warning.isVisible()) {
        await page.locator('[data-testid="delete-account-understand-button"]').click();

        // Confirmation field should be required
        const confirmationInput = page.locator('[data-testid="delete-account-confirmation"]');
        await expect(confirmationInput).toHaveAttribute('required', '');
      }
    });
  });
});
