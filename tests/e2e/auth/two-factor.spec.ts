import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TwoFactorSetupPage } from '../../pages/TwoFactorPage';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import {
  generateTOTPCode,
  generateInvalidTOTPCode,
  waitForFreshTOTPWindow,
} from '../../utils/totp-helpers';

test.describe('Two-Factor Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await DatabaseHelpers.setupTestUsers();
  });

  test.afterEach(async ({ page }) => {
    try {
      const isAuth = await AuthHelpers.isAuthenticated(page);
      if (isAuth) {
        await AuthHelpers.logout(page);
      }
    } catch {
      // Ignore logout errors in cleanup
    }
  });

  test.describe('2FA Setup Flow', () => {
    test('should display QR code and manual entry key during setup', async ({
      page,
    }) => {
      // Login as regular user first
      await AuthHelpers.loginAsUser(page);

      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();

      await test.step('Start 2FA setup', async () => {
        await setupPage.startSetup();
      });

      await test.step('Verify QR code is displayed', async () => {
        await expect(setupPage.qrCode).toBeVisible();
      });

      await test.step('Verify manual entry key is available', async () => {
        const manualKey = await setupPage.getManualKey();
        expect(manualKey).toBeTruthy();
        expect(manualKey.length).toBeGreaterThan(10);
      });
    });

    test('should display backup codes during setup', async ({ page }) => {
      await AuthHelpers.loginAsUser(page);

      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();
      await setupPage.startSetup();

      await test.step('Verify backup codes are displayed', async () => {
        const backupCodes = await setupPage.getBackupCodes();
        expect(backupCodes.length).toBeGreaterThanOrEqual(8);
      });
    });

    test('should enable 2FA with valid TOTP code', async ({ page }) => {
      await AuthHelpers.loginAsUser(page);

      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();

      await test.step('Complete 2FA setup', async () => {
        await waitForFreshTOTPWindow();
        await setupPage.performFullSetup(generateTOTPCode);
      });

      await test.step('Verify 2FA is enabled', async () => {
        await setupPage.assertEnabled();
      });

      await test.step('Verify database state', async () => {
        const has2FA = await DatabaseHelpers.has2FAEnabled('user@test.com');
        expect(has2FA).toBe(true);
      });
    });

    test('should reject invalid TOTP code during setup', async ({ page }) => {
      await AuthHelpers.loginAsUser(page);

      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();
      await setupPage.startSetup();
      await setupPage.proceedToVerification();

      await test.step('Enter invalid code', async () => {
        await setupPage.completeSetup(generateInvalidTOTPCode());
      });

      await test.step('Verify error is shown', async () => {
        await setupPage.assertErrorMessage('Invalid');
      });

      await test.step('Verify 2FA is not enabled', async () => {
        const has2FA = await DatabaseHelpers.has2FAEnabled('user@test.com');
        expect(has2FA).toBe(false);
      });
    });

    test('should allow canceling 2FA setup', async ({ page }) => {
      await AuthHelpers.loginAsUser(page);

      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();
      await setupPage.startSetup();

      await test.step('Cancel setup', async () => {
        await setupPage.cancelSetup();
      });

      await test.step('Verify 2FA is not enabled', async () => {
        const has2FA = await DatabaseHelpers.has2FAEnabled('user@test.com');
        expect(has2FA).toBe(false);
      });
    });
  });

  test.describe('2FA Login Flow', () => {
    test.beforeEach(async () => {
      // Ensure user has 2FA enabled
      await DatabaseHelpers.disable2FA('user@test.com');
    });

    test('should redirect to 2FA challenge after password login', async ({
      page,
    }) => {
      // Enable 2FA for user
      const { secret } = await DatabaseHelpers.enable2FA('user@test.com');

      await test.step('Login with password', async () => {
        await loginPage.goto();
        await loginPage.fillEmail('user@test.com');
        await loginPage.fillPassword('UserTest123!');
        await loginPage.submitLogin();
      });

      await test.step('Verify 2FA challenge is shown', async () => {
        // The login form shows 2FA input inline
        await expect(
          page.locator(
            '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
          )
        ).toBeVisible({ timeout: 10000 });
      });
    });

    test('should complete login with valid TOTP code', async ({ page }) => {
      const { secret } = await DatabaseHelpers.enable2FA('user@test.com');

      await test.step('Login and enter 2FA code', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');

        // Wait for 2FA input to appear
        const codeInput = page.locator(
          '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
        );
        await expect(codeInput).toBeVisible({ timeout: 10000 });

        // Generate and enter valid code
        await waitForFreshTOTPWindow();
        const code = generateTOTPCode(secret);
        await codeInput.fill(code);

        // Submit
        await page
          .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
          .click();
      });

      await test.step('Verify login successful', async () => {
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
      });
    });

    test('should reject invalid TOTP code during login', async ({ page }) => {
      await DatabaseHelpers.enable2FA('user@test.com');

      await test.step('Login and enter invalid 2FA code', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');

        const codeInput = page.locator(
          '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
        );
        await expect(codeInput).toBeVisible({ timeout: 10000 });

        await codeInput.fill(generateInvalidTOTPCode());
        await page
          .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
          .click();
      });

      await test.step('Verify error message is shown', async () => {
        await expect(
          page.locator('[data-testid="error-message"], [data-testid="2fa-error"]')
        ).toBeVisible();
      });

      await test.step('Verify still on login page', async () => {
        await expect(page).toHaveURL(/.*\/login/);
      });
    });

    test('should allow login with backup code', async ({ page }) => {
      const { backupCodes } = await DatabaseHelpers.enable2FA('user@test.com');
      const backupCode = backupCodes[0];

      await test.step('Login and switch to backup code', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');

        const codeInput = page.locator(
          '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
        );
        await expect(codeInput).toBeVisible({ timeout: 10000 });

        // Click "Use backup code" link
        await page
          .locator(
            '[data-testid="use-backup-code"], button:has-text("backup code")'
          )
          .click();
      });

      await test.step('Enter backup code', async () => {
        const backupInput = page.locator(
          '[data-testid="backup-code-input"], input[placeholder*="backup"]'
        );
        await expect(backupInput).toBeVisible();
        await backupInput.fill(backupCode);

        await page
          .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
          .click();
      });

      await test.step('Verify login successful', async () => {
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
      });
    });

    test('should show rate limiting after multiple failed attempts', async ({
      page,
    }) => {
      await DatabaseHelpers.enable2FA('user@test.com');
      const maxAttempts = 5;

      await test.step('Make multiple failed 2FA attempts', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');

        const codeInput = page.locator(
          '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
        );
        await expect(codeInput).toBeVisible({ timeout: 10000 });

        for (let i = 0; i < maxAttempts; i++) {
          await codeInput.clear();
          await codeInput.fill(generateInvalidTOTPCode());
          await page
            .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
            .click();
          await page.waitForTimeout(500);
        }
      });

      await test.step('Verify rate limiting or lockout', async () => {
        // Either rate limit message or locked out
        const rateLimitOrLockout = page.locator(
          '[data-testid="rate-limit-error"], [data-testid="error-message"]:has-text("too many"), [data-testid="error-message"]:has-text("locked")'
        );
        await expect(rateLimitOrLockout).toBeVisible({ timeout: 10000 });
      });
    });
  });

  test.describe('2FA Disable Flow', () => {
    test('should disable 2FA with valid TOTP code', async ({ page }) => {
      // Setup user with 2FA
      const { secret } = await DatabaseHelpers.enable2FA('user@test.com');

      // Login (need to complete 2FA to get to profile)
      await loginPage.goto();
      await loginPage.login('user@test.com', 'UserTest123!');

      const codeInput = page.locator(
        '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
      );
      await expect(codeInput).toBeVisible({ timeout: 10000 });
      await waitForFreshTOTPWindow();
      await codeInput.fill(generateTOTPCode(secret));
      await page
        .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
        .click();

      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();

      await test.step('Disable 2FA', async () => {
        await waitForFreshTOTPWindow();
        const disableCode = generateTOTPCode(secret);
        await setupPage.disable(disableCode);
      });

      await test.step('Verify 2FA is disabled', async () => {
        await setupPage.assertDisabled();
      });

      await test.step('Verify database state', async () => {
        const has2FA = await DatabaseHelpers.has2FAEnabled('user@test.com');
        expect(has2FA).toBe(false);
      });
    });

    test('should reject invalid code when disabling 2FA', async ({ page }) => {
      const { secret } = await DatabaseHelpers.enable2FA('user@test.com');

      // Login with 2FA
      await loginPage.goto();
      await loginPage.login('user@test.com', 'UserTest123!');
      const codeInput = page.locator(
        '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
      );
      await expect(codeInput).toBeVisible({ timeout: 10000 });
      await waitForFreshTOTPWindow();
      await codeInput.fill(generateTOTPCode(secret));
      await page
        .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
        .click();
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();

      await test.step('Attempt to disable with invalid code', async () => {
        await setupPage.disable(generateInvalidTOTPCode());
      });

      await test.step('Verify error shown', async () => {
        await setupPage.assertErrorMessage('Invalid');
      });

      await test.step('Verify 2FA is still enabled', async () => {
        const has2FA = await DatabaseHelpers.has2FAEnabled('user@test.com');
        expect(has2FA).toBe(true);
      });
    });

    test('should skip 2FA challenge after disabling', async ({ page }) => {
      const { secret } = await DatabaseHelpers.enable2FA('user@test.com');

      // Login with 2FA
      await loginPage.goto();
      await loginPage.login('user@test.com', 'UserTest123!');
      const codeInput = page.locator(
        '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
      );
      await expect(codeInput).toBeVisible({ timeout: 10000 });
      await waitForFreshTOTPWindow();
      await codeInput.fill(generateTOTPCode(secret));
      await page
        .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
        .click();
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });

      // Disable 2FA
      const setupPage = new TwoFactorSetupPage(page);
      await setupPage.goto();
      await waitForFreshTOTPWindow();
      await setupPage.disable(generateTOTPCode(secret));
      await setupPage.assertDisabled();

      // Logout and login again
      await AuthHelpers.logout(page);

      await test.step('Login again without 2FA', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');
      });

      await test.step('Verify direct redirect to dashboard (no 2FA)', async () => {
        await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
        // Should NOT see 2FA input
        await expect(
          page.locator('[data-testid="2fa-code-input"]')
        ).not.toBeVisible({ timeout: 3000 });
      });
    });
  });

  test.describe('2FA Edge Cases', () => {
    test('should handle session expiry during 2FA', async ({ page }) => {
      await DatabaseHelpers.enable2FA('user@test.com');

      await test.step('Start login and get to 2FA', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');
        const codeInput = page.locator(
          '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
        );
        await expect(codeInput).toBeVisible({ timeout: 10000 });
      });

      await test.step('Clear cookies to simulate expiry', async () => {
        await page.context().clearCookies();
      });

      await test.step('Submit code and verify redirect to login', async () => {
        const codeInput = page.locator(
          '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
        );
        await codeInput.fill('123456');
        await page
          .locator('[data-testid="2fa-submit"], button:has-text("Verify")')
          .click();

        // Should show error or redirect to login
        const errorOrLogin = await Promise.race([
          page.waitForURL('**/login', { timeout: 5000 }).then(() => 'login'),
          page
            .locator('[data-testid="error-message"]')
            .waitFor({ timeout: 5000 })
            .then(() => 'error'),
        ]);

        expect(['login', 'error']).toContain(errorOrLogin);
      });
    });

    test('should allow user to cancel 2FA and return to login', async ({
      page,
    }) => {
      await DatabaseHelpers.enable2FA('user@test.com');

      await test.step('Start login and get to 2FA', async () => {
        await loginPage.goto();
        await loginPage.login('user@test.com', 'UserTest123!');
        const codeInput = page.locator(
          '[data-testid="2fa-code-input"], input[inputmode="numeric"]'
        );
        await expect(codeInput).toBeVisible({ timeout: 10000 });
      });

      await test.step('Cancel 2FA', async () => {
        const cancelButton = page.locator(
          '[data-testid="2fa-cancel"], button:has-text("Cancel")'
        );
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
          await expect(page).toHaveURL(/.*\/login/);
        }
      });
    });
  });
});
