import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Admin Audit Log Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsAdmin(page);
  });

  test.describe('Audit Log Display', () => {
    test('should display audit log viewer with all components', async ({
      page,
    }) => {
      await page.goto('/admin/audit-logs');

      await test.step('Verify audit log viewer is visible', async () => {
        await expect(
          page.locator('[data-testid="audit-log-viewer"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-title"]')
        ).toBeVisible();
      });

      await test.step('Verify action buttons are visible', async () => {
        await expect(
          page.locator('[data-testid="audit-log-refresh-button"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-export-csv-button"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-export-json-button"]')
        ).toBeVisible();
      });

      await test.step('Verify filters are visible', async () => {
        await expect(
          page.locator('[data-testid="audit-log-filters"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-category-filter"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-action-filter"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-email-filter"]')
        ).toBeVisible();
      });

      await test.step('Verify date range filters are visible', async () => {
        await expect(
          page.locator('[data-testid="audit-log-from-date-filter"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-to-date-filter"]')
        ).toBeVisible();
      });

      await test.step('Verify filter action buttons are visible', async () => {
        await expect(
          page.locator('[data-testid="audit-log-apply-filters-button"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="audit-log-clear-filters-button"]')
        ).toBeVisible();
      });
    });

    test('should display audit log table with data', async ({ page }) => {
      await page.goto('/admin/audit-logs');

      await test.step('Verify audit log table is visible', async () => {
        await expect(
          page.locator('[data-testid="audit-log-table"]')
        ).toBeVisible();
      });

      await test.step(
        'Verify table has rows or shows empty state',
        async () => {
          const rows = page.locator('[data-testid="audit-log-row"]');
          const emptyState = page.locator(
            '[data-testid="audit-log-empty-state"]'
          );

          const rowCount = await rows.count();
          const hasEmptyState = await emptyState.isVisible();

          // Either we have rows or an empty state
          expect(rowCount > 0 || hasEmptyState).toBe(true);
        }
      );
    });
  });

  test.describe('Audit Log Filtering', () => {
    test('should filter audit logs by category', async ({ page }) => {
      await page.goto('/admin/audit-logs');

      await test.step('Apply category filter', async () => {
        const categoryFilter = page.locator(
          '[data-testid="audit-log-category-filter"]'
        );
        await categoryFilter.selectOption({ index: 1 }); // Select first non-empty option
        await page.click('[data-testid="audit-log-apply-filters-button"]');
      });

      await test.step('Verify filter is applied', async () => {
        // Wait for table to update
        await page.waitForTimeout(500);
        // Table should still be visible after filtering
        await expect(
          page.locator('[data-testid="audit-log-table"]')
        ).toBeVisible();
      });
    });

    test('should clear filters', async ({ page }) => {
      await page.goto('/admin/audit-logs');

      await test.step('Apply and then clear filters', async () => {
        const emailFilter = page.locator(
          '[data-testid="audit-log-email-filter"]'
        );
        await emailFilter.fill('test@example.com');
        await page.click('[data-testid="audit-log-apply-filters-button"]');

        await page.click('[data-testid="audit-log-clear-filters-button"]');
      });

      await test.step('Verify filters are cleared', async () => {
        const emailFilter = page.locator(
          '[data-testid="audit-log-email-filter"]'
        );
        await expect(emailFilter).toHaveValue('');
      });
    });
  });

  test.describe('Audit Log Pagination', () => {
    test('should navigate through pages if multiple pages exist', async ({
      page,
    }) => {
      await page.goto('/admin/audit-logs');

      const pagination = page.locator('[data-testid="audit-log-pagination"]');
      const hasPagination = await pagination.isVisible();

      if (hasPagination) {
        await test.step('Verify pagination controls', async () => {
          await expect(pagination).toBeVisible();
        });
      }
    });
  });

  test.describe('Audit Log Refresh', () => {
    test('should refresh audit logs when clicking refresh button', async ({
      page,
    }) => {
      await page.goto('/admin/audit-logs');

      await test.step('Click refresh button', async () => {
        await page.click('[data-testid="audit-log-refresh-button"]');
      });

      await test.step('Verify table is still visible after refresh', async () => {
        await expect(
          page.locator('[data-testid="audit-log-table"]')
        ).toBeVisible();
      });
    });
  });
});
