import { test, expect } from '@playwright/test';

test.describe('Account Unlock Flow', () => {
  test.describe('Request Unlock Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/request-unlock');
    });

    test('should display request unlock form', async ({ page }) => {
      await expect(page.locator('[data-testid="request-unlock-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="request-unlock-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();
    });

    test('should have back to login link', async ({ page }) => {
      const backLink = page.locator('[data-testid="back-to-login-link"]');
      await expect(backLink).toBeVisible();
      await expect(backLink).toContainText('Back to Login');
    });

    test('should require email field', async ({ page }) => {
      await page.locator('[data-testid="submit-button"]').click();
      // HTML5 validation should prevent submission
      const emailInput = page.locator('[data-testid="email-input"]');
      await expect(emailInput).toHaveAttribute('required', '');
    });

    test('should submit unlock request with email', async ({ page }) => {
      const testEmail = 'test@example.com';

      await page.locator('[data-testid="email-input"]').fill(testEmail);
      await page.locator('[data-testid="submit-button"]').click();

      // Wait for either success or error state
      // Success shows the success page, error shows error message
      await expect(
        page.locator('[data-testid="request-unlock-success"], [data-testid="error-message"]')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show success message after submission', async ({ page }) => {
      // Use a generic email - the system shows success regardless of whether account exists
      // to prevent email enumeration
      await page.locator('[data-testid="email-input"]').fill('test@example.com');
      await page.locator('[data-testid="submit-button"]').click();

      // Should show success page (system doesn't reveal if email exists)
      await expect(page.locator('[data-testid="request-unlock-success"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator('[data-testid="success-title"]')).toContainText('Check Your Email');
    });

    test('should have back to login button on success page', async ({ page }) => {
      await page.locator('[data-testid="email-input"]').fill('test@example.com');
      await page.locator('[data-testid="submit-button"]').click();

      await expect(page.locator('[data-testid="request-unlock-success"]')).toBeVisible({
        timeout: 10000,
      });

      const backButton = page.locator('[data-testid="back-to-login-button"]');
      await expect(backButton).toBeVisible();
    });

    test('should pre-fill email from query parameter', async ({ page }) => {
      const testEmail = 'prefilled@example.com';
      await page.goto(`/request-unlock?email=${encodeURIComponent(testEmail)}`);

      const emailInput = page.locator('[data-testid="email-input"]');
      await expect(emailInput).toHaveValue(testEmail);
    });
  });

  test.describe('Unlock Account Page', () => {
    test('should show invalid link message without token', async ({ page }) => {
      await page.goto('/unlock-account');

      await expect(page.locator('[data-testid="unlock-no-token"]')).toBeVisible();
      await expect(page.locator('[data-testid="no-token-title"]')).toContainText('Invalid Link');
    });

    test('should have request new link button when no token', async ({ page }) => {
      await page.goto('/unlock-account');

      const requestButton = page.locator('[data-testid="request-new-link-button"]');
      await expect(requestButton).toBeVisible();
      await expect(requestButton).toContainText('Request New Unlock Link');
    });

    test('should show error for invalid token', async ({ page }) => {
      await page.goto('/unlock-account?token=invalid_token_12345');

      // Should show error state
      await expect(page.locator('[data-testid="unlock-error"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="error-title"]')).toContainText('Unlock Failed');
    });

    test('should have request new link and back to login buttons on error', async ({ page }) => {
      await page.goto('/unlock-account?token=invalid_token_12345');

      await expect(page.locator('[data-testid="unlock-error"]')).toBeVisible({ timeout: 10000 });

      await expect(page.locator('[data-testid="request-new-link-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="back-to-login-button"]')).toBeVisible();
    });

    test('should display error message for expired token', async ({ page }) => {
      // Using a token that would be expired
      await page.goto('/unlock-account?token=expired_token_12345');

      await expect(page.locator('[data-testid="unlock-error"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });
  });

  test.describe('Navigation Flow', () => {
    test('should navigate to login from request unlock page', async ({ page }) => {
      await page.goto('/request-unlock');

      await page.locator('[data-testid="back-to-login-link"]').click();
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should navigate to request unlock from unlock error page', async ({ page }) => {
      await page.goto('/unlock-account?token=invalid_token');

      await expect(page.locator('[data-testid="unlock-error"]')).toBeVisible({ timeout: 10000 });

      await page.locator('[data-testid="request-new-link-button"]').click();
      await expect(page).toHaveURL(/.*\/request-unlock/);
    });

    test('should navigate to login from unlock error page', async ({ page }) => {
      await page.goto('/unlock-account?token=invalid_token');

      await expect(page.locator('[data-testid="unlock-error"]')).toBeVisible({ timeout: 10000 });

      await page.locator('[data-testid="back-to-login-button"]').click();
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should navigate to request unlock from no token page', async ({ page }) => {
      await page.goto('/unlock-account');

      await expect(page.locator('[data-testid="unlock-no-token"]')).toBeVisible();

      await page.locator('[data-testid="request-new-link-button"]').click();
      await expect(page).toHaveURL(/.*\/request-unlock/);
    });
  });

  test.describe('Form Validation', () => {
    test('should validate email format', async ({ page }) => {
      await page.goto('/request-unlock');

      const emailInput = page.locator('[data-testid="email-input"]');
      await emailInput.fill('invalid-email');

      await page.locator('[data-testid="submit-button"]').click();

      // HTML5 email validation should prevent submission
      // Check that we're still on the request unlock page
      await expect(page.locator('[data-testid="request-unlock-page"]')).toBeVisible();
    });

    test('should accept valid email format', async ({ page }) => {
      await page.goto('/request-unlock');

      await page.locator('[data-testid="email-input"]').fill('valid@example.com');
      await page.locator('[data-testid="submit-button"]').click();

      // Should proceed to success state
      await expect(
        page.locator('[data-testid="request-unlock-success"], [data-testid="error-message"]')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Security', () => {
    test('should not reveal if email exists in system', async ({ page }) => {
      await page.goto('/request-unlock');

      // Submit with non-existent email
      await page.locator('[data-testid="email-input"]').fill('nonexistent@example.com');
      await page.locator('[data-testid="submit-button"]').click();

      // Should still show success message (no email enumeration)
      await expect(page.locator('[data-testid="request-unlock-success"]')).toBeVisible({
        timeout: 10000,
      });
    });
  });
});
