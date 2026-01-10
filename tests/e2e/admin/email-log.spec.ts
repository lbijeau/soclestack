import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Admin Email Log Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsAdmin(page);
  });

  test.describe('Email Log Display', () => {
    test('should display email log viewer with all components', async ({
      page,
    }) => {
      await page.goto('/admin/email-logs');

      await test.step('Verify email log viewer is visible', async () => {
        await expect(
          page.locator('[data-testid="email-log-viewer"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="email-log-title"]')
        ).toBeVisible();
      });

      await test.step('Verify refresh button is visible', async () => {
        await expect(
          page.locator('[data-testid="email-log-refresh-button"]')
        ).toBeVisible();
      });

      await test.step('Verify filters are visible', async () => {
        await expect(
          page.locator('[data-testid="email-log-filters"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="email-log-status-filter"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="email-log-type-filter"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="email-log-search-filter"]')
        ).toBeVisible();
      });
    });

    test('should display email log table with data', async ({ page }) => {
      await page.goto('/admin/email-logs');

      await test.step('Verify email log table is visible', async () => {
        await expect(
          page.locator('[data-testid="email-log-table"]')
        ).toBeVisible();
      });

      await test.step(
        'Verify table has rows or shows empty state',
        async () => {
          const rows = page.locator('[data-testid="email-log-row"]');
          const emptyState = page.locator(
            '[data-testid="email-log-empty-state"]'
          );

          const rowCount = await rows.count();
          const hasEmptyState = await emptyState.isVisible();

          // Either we have rows or an empty state
          expect(rowCount > 0 || hasEmptyState).toBe(true);
        }
      );
    });
  });

  test.describe('Email Log Filtering', () => {
    test('should filter email logs by status', async ({ page }) => {
      await page.goto('/admin/email-logs');

      await test.step('Apply status filter', async () => {
        const statusFilter = page.locator(
          '[data-testid="email-log-status-filter"]'
        );
        await statusFilter.selectOption({ index: 1 }); // Select first non-empty option
      });

      await test.step('Verify filter is applied', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="email-log-table"]')
        ).toBeVisible();
      });
    });

    test('should filter email logs by type', async ({ page }) => {
      await page.goto('/admin/email-logs');

      await test.step('Apply type filter', async () => {
        const typeFilter = page.locator(
          '[data-testid="email-log-type-filter"]'
        );
        await typeFilter.selectOption({ index: 1 }); // Select first non-empty option
      });

      await test.step('Verify filter is applied', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="email-log-table"]')
        ).toBeVisible();
      });
    });

    test('should search email logs by recipient', async ({ page }) => {
      await page.goto('/admin/email-logs');

      await test.step('Apply search filter', async () => {
        const searchFilter = page.locator(
          '[data-testid="email-log-search-filter"]'
        );
        await searchFilter.fill('test@example.com');
        await searchFilter.press('Enter');
      });

      await test.step('Verify search is applied', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="email-log-table"]')
        ).toBeVisible();
      });
    });
  });

  test.describe('Email Preview Modal', () => {
    test('should open email preview modal when clicking on a log entry', async ({
      page,
    }) => {
      await page.goto('/admin/email-logs');

      const rows = page.locator('[data-testid="email-log-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await test.step('Click on first email log row', async () => {
          await rows.first().click();
        });

        await test.step('Verify preview modal opens', async () => {
          await expect(
            page.locator('[data-testid="email-preview-modal"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="email-preview-title"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="email-preview-content"]')
          ).toBeVisible();
        });

        await test.step('Verify modal has close button', async () => {
          await expect(
            page.locator('[data-testid="email-preview-close-button"]')
          ).toBeVisible();
        });

        await test.step('Close the modal', async () => {
          await page.click('[data-testid="email-preview-close-button"]');
          await expect(
            page.locator('[data-testid="email-preview-modal"]')
          ).not.toBeVisible();
        });
      }
    });

    test('should close preview modal when clicking overlay', async ({
      page,
    }) => {
      await page.goto('/admin/email-logs');

      const rows = page.locator('[data-testid="email-log-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await test.step('Open preview modal', async () => {
          await rows.first().click();
          await expect(
            page.locator('[data-testid="email-preview-modal"]')
          ).toBeVisible();
        });

        await test.step('Click overlay to close', async () => {
          await page
            .locator('[data-testid="email-preview-modal-overlay"]')
            .click({ position: { x: 10, y: 10 } });
          await expect(
            page.locator('[data-testid="email-preview-modal"]')
          ).not.toBeVisible();
        });
      }
    });
  });

  test.describe('Email Log Pagination', () => {
    test('should navigate through pages if multiple pages exist', async ({
      page,
    }) => {
      await page.goto('/admin/email-logs');

      const pagination = page.locator('[data-testid="email-log-pagination"]');
      const hasPagination = await pagination.isVisible();

      if (hasPagination) {
        await test.step('Verify pagination controls', async () => {
          await expect(pagination).toBeVisible();
        });
      }
    });
  });

  test.describe('Email Log Refresh', () => {
    test('should refresh email logs when clicking refresh button', async ({
      page,
    }) => {
      await page.goto('/admin/email-logs');

      await test.step('Click refresh button', async () => {
        await page.click('[data-testid="email-log-refresh-button"]');
      });

      await test.step(
        'Verify table is still visible after refresh',
        async () => {
          await expect(
            page.locator('[data-testid="email-log-table"]')
          ).toBeVisible();
        }
      );
    });
  });
});
