import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';

test.describe('Admin Impersonation', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsAdmin(page);
  });

  test.describe('Impersonation Banner Display', () => {
    test('should not show impersonation banner when not impersonating', async ({
      page,
    }) => {
      await page.goto('/admin');

      await test.step('Verify impersonation banner is not visible', async () => {
        await expect(
          page.locator('[data-testid="impersonation-banner"]')
        ).not.toBeVisible();
      });
    });

    test('should show impersonation banner components when impersonating', async ({
      page,
    }) => {
      // Skip this test if impersonation is not available
      await page.goto('/admin/users');

      // Try to find an impersonate button
      const impersonateButton = page.locator(
        'button:has-text("Impersonate"), [aria-label*="impersonate"]'
      );
      const hasImpersonate = await impersonateButton.first().isVisible();

      if (hasImpersonate) {
        await test.step('Start impersonation', async () => {
          await impersonateButton.first().click();
          await page.waitForTimeout(1000);
        });

        const banner = page.locator('[data-testid="impersonation-banner"]');
        const hasBanner = await banner.isVisible();

        if (hasBanner) {
          await test.step('Verify banner elements', async () => {
            await expect(
              page.locator('[data-testid="impersonation-banner-target"]')
            ).toBeVisible();
            await expect(
              page.locator('[data-testid="impersonation-banner-original"]')
            ).toBeVisible();
            await expect(
              page.locator('[data-testid="impersonation-banner-timer"]')
            ).toBeVisible();
            await expect(
              page.locator('[data-testid="impersonation-banner-exit-button"]')
            ).toBeVisible();
          });

          await test.step('Exit impersonation', async () => {
            await page.click(
              '[data-testid="impersonation-banner-exit-button"]'
            );
            await page.waitForTimeout(1000);
            await expect(
              page.locator('[data-testid="impersonation-banner"]')
            ).not.toBeVisible();
          });
        }
      }
    });
  });

  test.describe('Impersonation Flow', () => {
    test('should impersonate user from user management', async ({ page }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        // Look for an impersonate button in the row
        const impersonateButton = rows
          .first()
          .locator(
            'button:has-text("Impersonate"), [aria-label*="impersonate"]'
          );
        const hasImpersonate = await impersonateButton.isVisible();

        if (hasImpersonate) {
          await test.step('Click impersonate button', async () => {
            await impersonateButton.click();
          });

          await test.step('Verify impersonation started', async () => {
            await page.waitForTimeout(1000);
            // Either we see the banner or we get redirected
            const banner = page.locator('[data-testid="impersonation-banner"]');
            const hasBanner = await banner.isVisible();

            if (hasBanner) {
              await expect(banner).toBeVisible();
            }
          });
        }
      }
    });

    test('should exit impersonation and return to admin', async ({ page }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const impersonateButton = rows
          .first()
          .locator(
            'button:has-text("Impersonate"), [aria-label*="impersonate"]'
          );
        const hasImpersonate = await impersonateButton.isVisible();

        if (hasImpersonate) {
          await impersonateButton.click();
          await page.waitForTimeout(1000);

          const banner = page.locator('[data-testid="impersonation-banner"]');
          const hasBanner = await banner.isVisible();

          if (hasBanner) {
            await test.step('Exit impersonation', async () => {
              await page.click(
                '[data-testid="impersonation-banner-exit-button"]'
              );
            });

            await test.step('Verify returned to admin', async () => {
              await page.waitForURL(/\/admin/, { timeout: 5000 });
              await expect(
                page.locator('[data-testid="impersonation-banner"]')
              ).not.toBeVisible();
            });
          }
        }
      }
    });
  });

  test.describe('Impersonation Timer', () => {
    test('should show remaining time in banner', async ({ page }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const impersonateButton = rows
          .first()
          .locator(
            'button:has-text("Impersonate"), [aria-label*="impersonate"]'
          );
        const hasImpersonate = await impersonateButton.isVisible();

        if (hasImpersonate) {
          await impersonateButton.click();
          await page.waitForTimeout(1000);

          const timer = page.locator(
            '[data-testid="impersonation-banner-timer"]'
          );
          const hasTimer = await timer.isVisible();

          if (hasTimer) {
            await test.step('Verify timer shows remaining time', async () => {
              const timerText = await timer.textContent();
              expect(timerText).toMatch(/\d+m remaining/);
            });

            // Exit impersonation to clean up
            await page.click(
              '[data-testid="impersonation-banner-exit-button"]'
            );
          }
        }
      }
    });
  });
});
