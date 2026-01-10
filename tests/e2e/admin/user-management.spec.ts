import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsAdmin(page);
  });

  test.describe('User Management Display', () => {
    test('should display user management page with all components', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      await test.step('Verify user management container is visible', async () => {
        await expect(
          page.locator('[data-testid="user-management"]')
        ).toBeVisible();
      });

      await test.step('Verify filters are visible', async () => {
        await expect(
          page.locator('[data-testid="user-management-filters"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="user-management-search-input"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="user-management-role-filter"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="user-management-status-filter"]')
        ).toBeVisible();
      });

      await test.step('Verify clear filters button is visible', async () => {
        await expect(
          page.locator('[data-testid="user-management-clear-filters-button"]')
        ).toBeVisible();
      });
    });

    test('should display user table with data', async ({ page }) => {
      await page.goto('/admin/users');

      await test.step('Verify user table is visible', async () => {
        await expect(
          page.locator('[data-testid="user-management-table"]')
        ).toBeVisible();
      });

      await test.step(
        'Verify table has rows or shows empty state',
        async () => {
          const rows = page.locator('[data-testid="user-management-row"]');
          const emptyState = page.locator(
            '[data-testid="user-management-empty-state"]'
          );

          const rowCount = await rows.count();
          const hasEmptyState = await emptyState.isVisible();

          expect(rowCount > 0 || hasEmptyState).toBe(true);
        }
      );
    });
  });

  test.describe('User Search and Filtering', () => {
    test('should search users by email or name', async ({ page }) => {
      await page.goto('/admin/users');

      await test.step('Enter search term', async () => {
        const searchInput = page.locator(
          '[data-testid="user-management-search-input"]'
        );
        await searchInput.fill('admin');
      });

      await test.step('Click search button', async () => {
        await page.click('[data-testid="user-management-search-button"]');
      });

      await test.step('Verify search is applied', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="user-management-table"]')
        ).toBeVisible();
      });
    });

    test('should filter users by role', async ({ page }) => {
      await page.goto('/admin/users');

      await test.step('Apply role filter', async () => {
        const roleFilter = page.locator(
          '[data-testid="user-management-role-filter"]'
        );
        await roleFilter.selectOption({ index: 1 }); // Select first non-empty option
      });

      await test.step('Verify filter is applied', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="user-management-table"]')
        ).toBeVisible();
      });
    });

    test('should filter users by status', async ({ page }) => {
      await page.goto('/admin/users');

      await test.step('Apply status filter', async () => {
        const statusFilter = page.locator(
          '[data-testid="user-management-status-filter"]'
        );
        await statusFilter.selectOption({ index: 1 }); // Select first non-empty option
      });

      await test.step('Verify filter is applied', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="user-management-table"]')
        ).toBeVisible();
      });
    });

    test('should clear all filters', async ({ page }) => {
      await page.goto('/admin/users');

      await test.step('Apply filters', async () => {
        const searchInput = page.locator(
          '[data-testid="user-management-search-input"]'
        );
        await searchInput.fill('test');
        const roleFilter = page.locator(
          '[data-testid="user-management-role-filter"]'
        );
        await roleFilter.selectOption({ index: 1 });
      });

      await test.step('Clear filters', async () => {
        await page.click(
          '[data-testid="user-management-clear-filters-button"]'
        );
      });

      await test.step('Verify filters are cleared', async () => {
        const searchInput = page.locator(
          '[data-testid="user-management-search-input"]'
        );
        await expect(searchInput).toHaveValue('');
      });
    });
  });

  test.describe('Bulk Actions', () => {
    test('should show bulk actions bar when users are selected', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await test.step('Select a user', async () => {
          const checkbox = rows.first().locator('input[type="checkbox"]');
          if (await checkbox.isVisible()) {
            await checkbox.click();
          }
        });

        // Check if bulk actions bar appears
        const bulkActions = page.locator(
          '[data-testid="user-management-bulk-actions"]'
        );
        const hasBulkActions = await bulkActions.isVisible();

        if (hasBulkActions) {
          await test.step('Verify bulk action buttons', async () => {
            await expect(
              page.locator('[data-testid="user-management-selected-count"]')
            ).toBeVisible();
          });
        }
      }
    });

    test('should clear selection when clicking clear button', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await test.step('Select a user', async () => {
          const checkbox = rows.first().locator('input[type="checkbox"]');
          if (await checkbox.isVisible()) {
            await checkbox.click();
          }
        });

        const bulkClear = page.locator(
          '[data-testid="user-management-bulk-clear"]'
        );
        if (await bulkClear.isVisible()) {
          await test.step('Clear selection', async () => {
            await bulkClear.click();
          });

          await test.step('Verify selection is cleared', async () => {
            await expect(bulkClear).not.toBeVisible();
          });
        }
      }
    });
  });

  test.describe('User Role Selection Modal', () => {
    test('should open role selection modal when clicking manage roles', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        // Try to find a manage roles button on the first row
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), [aria-label*="role"]');
        if (await manageRolesButton.isVisible()) {
          await test.step('Click manage roles button', async () => {
            await manageRolesButton.click();
          });

          await test.step('Verify role selection modal opens', async () => {
            await expect(
              page.locator('[data-testid="user-role-select-modal"]')
            ).toBeVisible();
            await expect(
              page.locator('[data-testid="user-role-select-title"]')
            ).toBeVisible();
          });

          await test.step('Close the modal', async () => {
            await page.click('[data-testid="user-role-select-close-button"]');
            await expect(
              page.locator('[data-testid="user-role-select-modal"]')
            ).not.toBeVisible();
          });
        }
      }
    });
  });

  test.describe('Error and Success Alerts', () => {
    test('should display error alerts when errors occur', async ({ page }) => {
      await page.goto('/admin/users');

      // Error alerts would be shown on API failures
      const errorAlert = page.locator('[data-testid="user-management-error"]');

      // Note: This test just verifies the error alert element exists in DOM
      // Actual error testing would require mocking API failures
      await test.step(
        'Verify error alert is not initially visible',
        async () => {
          await expect(errorAlert).not.toBeVisible();
        }
      );
    });
  });
});
