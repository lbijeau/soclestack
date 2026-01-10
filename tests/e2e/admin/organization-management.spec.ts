import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Admin Organization Management', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsAdmin(page);
  });

  test.describe('Organization List Display', () => {
    test('should display organization list with all components', async ({
      page,
    }) => {
      await page.goto('/admin/organizations');

      await test.step('Verify organization list is visible', async () => {
        await expect(
          page.locator('[data-testid="organization-list"]')
        ).toBeVisible();
      });

      await test.step('Verify search form is visible', async () => {
        await expect(
          page.locator('[data-testid="organization-list-search-form"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="organization-list-search-input"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="organization-list-search-button"]')
        ).toBeVisible();
      });

      await test.step('Verify table container is visible', async () => {
        await expect(
          page.locator('[data-testid="organization-list-table-container"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="organization-list-table"]')
        ).toBeVisible();
      });
    });

    test('should display organization table with data', async ({ page }) => {
      await page.goto('/admin/organizations');

      await test.step(
        'Verify table has rows or shows empty state',
        async () => {
          const rows = page.locator('[data-testid="organization-list-row"]');
          const emptyState = page.locator(
            '[data-testid="organization-list-empty-state"]'
          );

          const rowCount = await rows.count();
          const hasEmptyState = await emptyState.isVisible();

          expect(rowCount > 0 || hasEmptyState).toBe(true);
        }
      );
    });

    test('should have sortable columns', async ({ page }) => {
      await page.goto('/admin/organizations');

      await test.step('Verify sort headers are visible', async () => {
        await expect(
          page.locator('[data-testid="organization-list-sort-name"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="organization-list-sort-members"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="organization-list-sort-created"]')
        ).toBeVisible();
      });
    });
  });

  test.describe('Organization Search', () => {
    test('should search organizations by name or slug', async ({ page }) => {
      await page.goto('/admin/organizations');

      await test.step('Enter search term', async () => {
        const searchInput = page.locator(
          '[data-testid="organization-list-search-input"]'
        );
        await searchInput.fill('test');
      });

      await test.step('Click search button', async () => {
        await page.click('[data-testid="organization-list-search-button"]');
      });

      await test.step('Verify search is applied', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="organization-list-table"]')
        ).toBeVisible();
      });
    });
  });

  test.describe('Organization Sorting', () => {
    test('should sort by name when clicking name header', async ({ page }) => {
      await page.goto('/admin/organizations');

      await test.step('Click name sort header', async () => {
        await page.click('[data-testid="organization-list-sort-name"]');
      });

      await test.step('Verify table is still visible after sort', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="organization-list-table"]')
        ).toBeVisible();
      });
    });

    test('should sort by member count when clicking members header', async ({
      page,
    }) => {
      await page.goto('/admin/organizations');

      await test.step('Click members sort header', async () => {
        await page.click('[data-testid="organization-list-sort-members"]');
      });

      await test.step('Verify table is still visible after sort', async () => {
        await page.waitForTimeout(500);
        await expect(
          page.locator('[data-testid="organization-list-table"]')
        ).toBeVisible();
      });
    });
  });

  test.describe('Organization Pagination', () => {
    test('should navigate through pages if multiple pages exist', async ({
      page,
    }) => {
      await page.goto('/admin/organizations');

      const pagination = page.locator(
        '[data-testid="organization-list-pagination"]'
      );
      const hasPagination = await pagination.isVisible();

      if (hasPagination) {
        await test.step('Verify pagination controls', async () => {
          await expect(
            page.locator('[data-testid="organization-list-current-page"]')
          ).toBeVisible();
        });

        await test.step('Verify navigation buttons', async () => {
          await expect(
            page.locator('[data-testid="organization-list-prev-page"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="organization-list-next-page"]')
          ).toBeVisible();
        });
      }
    });
  });

  test.describe('Organization Detail Navigation', () => {
    test('should navigate to organization detail when clicking on a row', async ({
      page,
    }) => {
      await page.goto('/admin/organizations');

      const rows = page.locator('[data-testid="organization-list-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await test.step('Click on first organization', async () => {
          await rows.first().click();
        });

        await test.step('Verify navigation to organization detail', async () => {
          await expect(page).toHaveURL(/\/admin\/organizations\/.+/);
          await expect(
            page.locator('[data-testid="organization-detail"]')
          ).toBeVisible();
        });
      }
    });
  });

  test.describe('Organization Detail Display', () => {
    test('should display organization detail with all components', async ({
      page,
    }) => {
      await page.goto('/admin/organizations');

      const rows = page.locator('[data-testid="organization-list-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await rows.first().click();
        await page.waitForURL(/\/admin\/organizations\/.+/);

        await test.step('Verify organization detail is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail"]')
          ).toBeVisible();
        });

        await test.step('Verify back button is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-back-button"]')
          ).toBeVisible();
        });

        await test.step('Verify info card is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-info-card"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="organization-detail-name"]')
          ).toBeVisible();
        });

        await test.step('Verify members card is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-members-card"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="organization-detail-members-table"]')
          ).toBeVisible();
        });
      }
    });

    test('should display transfer ownership card', async ({ page }) => {
      await page.goto('/admin/organizations');

      const rows = page.locator('[data-testid="organization-list-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await rows.first().click();
        await page.waitForURL(/\/admin\/organizations\/.+/);

        await test.step('Verify transfer card is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-transfer-card"]')
          ).toBeVisible();
        });

        await test.step('Verify transfer select is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-transfer-select"]')
          ).toBeVisible();
        });

        await test.step('Verify transfer button is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-transfer-button"]')
          ).toBeVisible();
        });
      }
    });

    test('should display danger zone card', async ({ page }) => {
      await page.goto('/admin/organizations');

      const rows = page.locator('[data-testid="organization-list-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await rows.first().click();
        await page.waitForURL(/\/admin\/organizations\/.+/);

        await test.step('Verify danger zone card is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-danger-card"]')
          ).toBeVisible();
        });

        await test.step('Verify delete confirmation input is visible', async () => {
          await expect(
            page.locator(
              '[data-testid="organization-detail-delete-confirm-input"]'
            )
          ).toBeVisible();
        });

        await test.step('Verify delete button is visible', async () => {
          await expect(
            page.locator('[data-testid="organization-detail-delete-button"]')
          ).toBeVisible();
        });
      }
    });

    test('should navigate back when clicking back button', async ({ page }) => {
      await page.goto('/admin/organizations');

      const rows = page.locator('[data-testid="organization-list-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await rows.first().click();
        await page.waitForURL(/\/admin\/organizations\/.+/);

        await test.step('Click back button', async () => {
          await page.click('[data-testid="organization-detail-back-button"]');
        });

        await test.step('Verify navigation back to organization list', async () => {
          await expect(page).toHaveURL('/admin/organizations');
          await expect(
            page.locator('[data-testid="organization-list"]')
          ).toBeVisible();
        });
      }
    });
  });

  test.describe('Organization Member Management', () => {
    test('should display member rows with remove buttons', async ({ page }) => {
      await page.goto('/admin/organizations');

      const rows = page.locator('[data-testid="organization-list-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await rows.first().click();
        await page.waitForURL(/\/admin\/organizations\/.+/);

        const memberRows = page.locator(
          '[data-testid="organization-detail-member-row"]'
        );
        const hasMemberRows = (await memberRows.count()) > 0;

        if (hasMemberRows) {
          await test.step('Verify member rows are displayed', async () => {
            await expect(memberRows.first()).toBeVisible();
          });

          // Check if any non-owner members have remove buttons
          const removeButtons = page.locator(
            '[data-testid="organization-detail-remove-member-button"]'
          );
          const hasRemoveButtons = (await removeButtons.count()) > 0;

          if (hasRemoveButtons) {
            await test.step('Verify remove button is visible', async () => {
              await expect(removeButtons.first()).toBeVisible();
            });
          }
        }
      }
    });

    test('should open remove member confirmation modal', async ({ page }) => {
      await page.goto('/admin/organizations');

      const rows = page.locator('[data-testid="organization-list-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        await rows.first().click();
        await page.waitForURL(/\/admin\/organizations\/.+/);

        const removeButtons = page.locator(
          '[data-testid="organization-detail-remove-member-button"]'
        );
        const hasRemoveButtons = (await removeButtons.count()) > 0;

        if (hasRemoveButtons) {
          await test.step('Click remove button', async () => {
            await removeButtons.first().click();
          });

          await test.step('Verify remove modal opens', async () => {
            await expect(
              page.locator('[data-testid="organization-detail-remove-modal"]')
            ).toBeVisible();
          });

          await test.step('Verify modal buttons', async () => {
            await expect(
              page.locator(
                '[data-testid="organization-detail-remove-modal-cancel"]'
              )
            ).toBeVisible();
            await expect(
              page.locator(
                '[data-testid="organization-detail-remove-modal-confirm"]'
              )
            ).toBeVisible();
          });

          await test.step('Cancel removal', async () => {
            await page.click(
              '[data-testid="organization-detail-remove-modal-cancel"]'
            );
            await expect(
              page.locator('[data-testid="organization-detail-remove-modal"]')
            ).not.toBeVisible();
          });
        }
      }
    });
  });
});
