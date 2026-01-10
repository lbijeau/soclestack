import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Admin Role Management', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsAdmin(page);
  });

  test.describe('Role List Display', () => {
    test('should display role list with all components', async ({ page }) => {
      await page.goto('/admin/roles');

      await test.step('Verify role list is visible', async () => {
        await expect(page.locator('[data-testid="role-list"]')).toBeVisible();
      });

      await test.step(
        'Verify role list has items or shows empty state',
        async () => {
          const items = page.locator('[data-testid="role-list-item"]');
          const emptyState = page.locator(
            '[data-testid="role-list-empty-state"]'
          );

          const itemCount = await items.count();
          const hasEmptyState = await emptyState.isVisible();

          expect(itemCount > 0 || hasEmptyState).toBe(true);
        }
      );
    });

    test('should display role details in list items', async ({ page }) => {
      await page.goto('/admin/roles');

      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        await test.step('Verify role name is displayed', async () => {
          await expect(
            items.first().locator('[data-testid="role-list-item-name"]')
          ).toBeVisible();
        });

        await test.step('Verify user count is displayed', async () => {
          await expect(
            items.first().locator('[data-testid="role-list-item-user-count"]')
          ).toBeVisible();
        });
      }
    });

    test('should identify system roles with badge', async ({ page }) => {
      await page.goto('/admin/roles');

      const systemBadges = page.locator(
        '[data-testid="role-list-item-system-badge"]'
      );
      const hasBadges = (await systemBadges.count()) > 0;

      if (hasBadges) {
        await test.step('Verify system badge is visible', async () => {
          await expect(systemBadges.first()).toBeVisible();
        });
      }
    });

    test('should navigate to role editor when clicking on a role', async ({
      page,
    }) => {
      await page.goto('/admin/roles');

      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        await test.step('Click on first role', async () => {
          await items.first().click();
        });

        await test.step('Verify navigation to role editor', async () => {
          await expect(page).toHaveURL(/\/admin\/roles\/.+/);
          await expect(
            page.locator('[data-testid="role-editor"]')
          ).toBeVisible();
        });
      }
    });
  });

  test.describe('Role Editor Display', () => {
    test('should display role editor with all components', async ({ page }) => {
      await page.goto('/admin/roles');

      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        await items.first().click();
        await page.waitForURL(/\/admin\/roles\/.+/);

        await test.step('Verify role editor is visible', async () => {
          await expect(
            page.locator('[data-testid="role-editor"]')
          ).toBeVisible();
        });

        await test.step('Verify back button is visible', async () => {
          await expect(
            page.locator('[data-testid="role-editor-back-button"]')
          ).toBeVisible();
        });

        await test.step('Verify title is visible', async () => {
          await expect(
            page.locator('[data-testid="role-editor-title"]')
          ).toBeVisible();
        });

        await test.step('Verify card content is visible', async () => {
          await expect(
            page.locator('[data-testid="role-editor-card"]')
          ).toBeVisible();
        });
      }
    });

    test('should display action buttons in role editor', async ({ page }) => {
      await page.goto('/admin/roles');

      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        await items.first().click();
        await page.waitForURL(/\/admin\/roles\/.+/);

        await test.step('Verify actions section is visible', async () => {
          await expect(
            page.locator('[data-testid="role-editor-actions"]')
          ).toBeVisible();
        });

        await test.step('Verify cancel button is visible', async () => {
          await expect(
            page.locator('[data-testid="role-editor-cancel-button"]')
          ).toBeVisible();
        });

        await test.step('Verify save button is visible', async () => {
          await expect(
            page.locator('[data-testid="role-editor-save-button"]')
          ).toBeVisible();
        });
      }
    });

    test('should navigate back when clicking back button', async ({ page }) => {
      await page.goto('/admin/roles');

      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        await items.first().click();
        await page.waitForURL(/\/admin\/roles\/.+/);

        await test.step('Click back button', async () => {
          await page.click('[data-testid="role-editor-back-button"]');
        });

        await test.step('Verify navigation back to role list', async () => {
          await expect(page).toHaveURL('/admin/roles');
          await expect(
            page.locator('[data-testid="role-list"]')
          ).toBeVisible();
        });
      }
    });
  });

  test.describe('Role Delete Modal', () => {
    test('should show delete button for non-system roles', async ({ page }) => {
      await page.goto('/admin/roles');

      // Find a non-system role (one without the system badge)
      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        // Try to find a role without system badge
        for (let i = 0; i < (await items.count()); i++) {
          const item = items.nth(i);
          const hasBadge = await item
            .locator('[data-testid="role-list-item-system-badge"]')
            .isVisible();

          if (!hasBadge) {
            await item.click();
            await page.waitForURL(/\/admin\/roles\/.+/);

            await test.step('Verify delete button is visible', async () => {
              await expect(
                page.locator('[data-testid="role-editor-delete-button"]')
              ).toBeVisible();
            });
            break;
          }
        }
      }
    });

    test('should open delete confirmation modal', async ({ page }) => {
      await page.goto('/admin/roles');

      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        // Try to find a non-system role
        for (let i = 0; i < (await items.count()); i++) {
          const item = items.nth(i);
          const hasBadge = await item
            .locator('[data-testid="role-list-item-system-badge"]')
            .isVisible();

          if (!hasBadge) {
            await item.click();
            await page.waitForURL(/\/admin\/roles\/.+/);

            const deleteButton = page.locator(
              '[data-testid="role-editor-delete-button"]'
            );
            if (await deleteButton.isVisible()) {
              await test.step('Click delete button', async () => {
                await deleteButton.click();
              });

              await test.step('Verify delete modal opens', async () => {
                await expect(
                  page.locator('[data-testid="role-editor-delete-modal"]')
                ).toBeVisible();
                await expect(
                  page.locator(
                    '[data-testid="role-editor-delete-modal-confirm"]'
                  )
                ).toBeVisible();
                await expect(
                  page.locator(
                    '[data-testid="role-editor-delete-modal-cancel"]'
                  )
                ).toBeVisible();
              });

              await test.step('Cancel delete', async () => {
                await page.click(
                  '[data-testid="role-editor-delete-modal-cancel"]'
                );
                await expect(
                  page.locator('[data-testid="role-editor-delete-modal"]')
                ).not.toBeVisible();
              });
            }
            break;
          }
        }
      }
    });
  });

  test.describe('System Role Protection', () => {
    test('should show system badge for system roles', async ({ page }) => {
      await page.goto('/admin/roles');

      const items = page.locator('[data-testid="role-list-item"]');
      const hasItems = (await items.count()) > 0;

      if (hasItems) {
        // Try to find a system role
        for (let i = 0; i < (await items.count()); i++) {
          const item = items.nth(i);
          const badge = item.locator(
            '[data-testid="role-list-item-system-badge"]'
          );
          const hasBadge = await badge.isVisible();

          if (hasBadge) {
            await item.click();
            await page.waitForURL(/\/admin\/roles\/.+/);

            await test.step('Verify system badge in editor', async () => {
              await expect(
                page.locator('[data-testid="role-editor-system-badge"]')
              ).toBeVisible();
            });
            break;
          }
        }
      }
    });
  });
});
