import { test, expect } from '@playwright/test';

test.describe('Email Verification Flow', () => {
  test.describe('Verify Email Page', () => {
    test('should display verification required message without token', async ({ page }) => {
      await page.goto('/verify-email');

      await expect(page.locator('[data-testid="verify-email-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="verify-email-title"]')).toContainText(
        'Verification Required'
      );
      await expect(page.locator('[data-testid="verify-email-no-token"]')).toBeVisible();
    });

    test('should have back to login button when no token', async ({ page }) => {
      await page.goto('/verify-email');

      const backButton = page.locator('[data-testid="back-to-login-button"]');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Back to Login');
    });

    test('should show loading state when token is provided', async ({ page }) => {
      // Navigate with a token - it will briefly show loading before error
      await page.goto('/verify-email?token=test_token_12345');

      // Either loading or error state should be visible
      await expect(
        page.locator('[data-testid="verify-email-loading"], [data-testid="verify-email-error"]')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should show error for invalid token', async ({ page }) => {
      await page.goto('/verify-email?token=invalid_token_12345');

      // Should show error state after API call
      await expect(page.locator('[data-testid="verify-email-error"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator('[data-testid="verify-email-error-message"]')).toBeVisible();
    });

    test('should have back to login button on error', async ({ page }) => {
      await page.goto('/verify-email?token=invalid_token_12345');

      await expect(page.locator('[data-testid="verify-email-error"]')).toBeVisible({
        timeout: 10000,
      });

      const backButton = page.locator('[data-testid="error-back-to-login-button"]');
      await expect(backButton).toBeVisible();
    });

    test('should display card with proper heading', async ({ page }) => {
      await page.goto('/verify-email');

      await expect(page.locator('[data-testid="verify-email-heading"]')).toContainText(
        'Email Verification'
      );
      await expect(page.locator('[data-testid="verify-email-card"]')).toBeVisible();
    });
  });

  test.describe('Navigation Flow', () => {
    test('should navigate to login from verify email page (no token)', async ({ page }) => {
      await page.goto('/verify-email');

      await page.locator('[data-testid="back-to-login-button"]').click();
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should navigate to login from error state', async ({ page }) => {
      await page.goto('/verify-email?token=invalid_token');

      await expect(page.locator('[data-testid="verify-email-error"]')).toBeVisible({
        timeout: 10000,
      });

      await page.locator('[data-testid="error-back-to-login-button"]').click();
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Error Handling', () => {
    test('should show error message for expired token', async ({ page }) => {
      await page.goto('/verify-email?token=expired_token_12345');

      await expect(page.locator('[data-testid="verify-email-error"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator('[data-testid="verify-email-error-message"]')).toBeVisible();
    });

    test('should show appropriate error for malformed token', async ({ page }) => {
      await page.goto('/verify-email?token=!@#$%^&*()');

      await expect(page.locator('[data-testid="verify-email-error"]')).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('Email Verification Banner', () => {
    // Note: These tests require an authenticated user with unverified email
    // In a real scenario, you would need to set up test fixtures for this

    test.describe('Banner Display', () => {
      test.skip('should display verification banner for unverified user', async () => {
        // This test requires authentication setup with an unverified user
        // Implementation depends on test fixtures and auth setup
      });

      test.skip('should show email address in banner', async () => {
        // This test requires authentication setup with an unverified user
      });
    });

    test.describe('Resend Functionality', () => {
      test.skip('should have resend verification button', async () => {
        // This test requires authentication setup with an unverified user
      });

      test.skip('should show loading state when resending', async () => {
        // This test requires authentication setup with an unverified user
      });

      test.skip('should show success message after resend', async () => {
        // This test requires authentication setup with an unverified user
      });
    });

    test.describe('Dismiss Functionality', () => {
      test.skip('should have dismiss button', async () => {
        // This test requires authentication setup with an unverified user
      });

      test.skip('should hide banner when dismissed', async () => {
        // This test requires authentication setup with an unverified user
      });
    });
  });

  test.describe('Security', () => {
    test('should not reveal valid tokens in error messages', async ({ page }) => {
      await page.goto('/verify-email?token=potentially_valid_token');

      await expect(page.locator('[data-testid="verify-email-error"]')).toBeVisible({
        timeout: 10000,
      });

      // Error message should not reveal token details
      const errorMessage = page.locator('[data-testid="verify-email-error-message"]');
      await expect(errorMessage).toBeVisible();
      const errorText = await errorMessage.textContent();

      // Should not contain the token
      expect(errorText).not.toContain('potentially_valid_token');
    });

    test('should handle XSS attempts in token parameter', async ({ page }) => {
      // URL encode XSS attempt
      await page.goto('/verify-email?token=%3Cscript%3Ealert(1)%3C/script%3E');

      // Page should render without executing script
      await expect(
        page.locator('[data-testid="verify-email-error"], [data-testid="verify-email-page"]')
      ).toBeVisible({ timeout: 10000 });

      // Verify no script tag is rendered
      const bodyContent = await page.locator('body').innerHTML();
      expect(bodyContent).not.toContain('<script>alert(1)</script>');
    });
  });

  test.describe('URL Parameter Handling', () => {
    test('should handle empty token parameter', async ({ page }) => {
      await page.goto('/verify-email?token=');

      // Should show verification required (no token state)
      await expect(page.locator('[data-testid="verify-email-page"]')).toBeVisible();
    });

    test('should handle multiple token parameters', async ({ page }) => {
      await page.goto('/verify-email?token=first&token=second');

      // Should process only the first token
      await expect(
        page.locator('[data-testid="verify-email-loading"], [data-testid="verify-email-error"]')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should handle token with special characters', async ({ page }) => {
      await page.goto('/verify-email?token=token-with-dashes_and_underscores.and.dots');

      await expect(
        page.locator('[data-testid="verify-email-loading"], [data-testid="verify-email-error"]')
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
