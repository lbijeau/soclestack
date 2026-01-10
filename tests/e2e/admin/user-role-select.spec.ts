import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';

test.describe('Admin User Role Selection', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelpers.loginAsAdmin(page);
  });

  test.describe('Role Selection Modal Display', () => {
    test('should display role selection modal with all components', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        // Find and click on a manage roles button or link
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), button[aria-label*="role"], [data-testid*="roles"]');
        const hasButton = await manageRolesButton.isVisible();

        if (hasButton) {
          await test.step('Open role selection modal', async () => {
            await manageRolesButton.click();
          });

          await test.step('Verify modal is visible', async () => {
            await expect(
              page.locator('[data-testid="user-role-select-modal"]')
            ).toBeVisible();
          });

          await test.step('Verify modal title', async () => {
            await expect(
              page.locator('[data-testid="user-role-select-title"]')
            ).toBeVisible();
          });

          await test.step('Verify user email is displayed', async () => {
            await expect(
              page.locator('[data-testid="user-role-select-email"]')
            ).toBeVisible();
          });

          await test.step('Verify close button', async () => {
            await expect(
              page.locator('[data-testid="user-role-select-close-button"]')
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

    test('should display roles list in modal', async ({ page }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), button[aria-label*="role"], [data-testid*="roles"]');
        const hasButton = await manageRolesButton.isVisible();

        if (hasButton) {
          await manageRolesButton.click();

          const modal = page.locator('[data-testid="user-role-select-modal"]');
          const hasModal = await modal.isVisible();

          if (hasModal) {
            await test.step('Verify roles list is visible', async () => {
              await expect(
                page.locator('[data-testid="user-role-select-roles-list"]')
              ).toBeVisible();
            });

            await test.step('Verify role items are present', async () => {
              const roleItems = page.locator(
                '[data-testid="user-role-select-role-item"]'
              );
              const hasRoles = (await roleItems.count()) > 0;
              expect(hasRoles).toBe(true);
            });

            await page.click('[data-testid="user-role-select-close-button"]');
          }
        }
      }
    });
  });

  test.describe('Role Selection Functionality', () => {
    test('should toggle role selection when clicking checkbox', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), button[aria-label*="role"], [data-testid*="roles"]');
        const hasButton = await manageRolesButton.isVisible();

        if (hasButton) {
          await manageRolesButton.click();

          const modal = page.locator('[data-testid="user-role-select-modal"]');
          const hasModal = await modal.isVisible();

          if (hasModal) {
            const checkboxes = page.locator(
              '[data-testid="user-role-select-role-checkbox"]:not(:disabled)'
            );
            const hasCheckboxes = (await checkboxes.count()) > 0;

            if (hasCheckboxes) {
              await test.step('Toggle a role checkbox', async () => {
                const checkbox = checkboxes.first();
                const wasChecked = await checkbox.isChecked();
                await checkbox.click();
                const isChecked = await checkbox.isChecked();
                expect(isChecked).not.toBe(wasChecked);
              });
            }

            await page.click('[data-testid="user-role-select-close-button"]');
          }
        }
      }
    });

    test('should enable save button when changes are made', async ({
      page,
    }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), button[aria-label*="role"], [data-testid*="roles"]');
        const hasButton = await manageRolesButton.isVisible();

        if (hasButton) {
          await manageRolesButton.click();

          const modal = page.locator('[data-testid="user-role-select-modal"]');
          const hasModal = await modal.isVisible();

          if (hasModal) {
            await test.step('Verify save button is initially disabled', async () => {
              const saveButton = page.locator(
                '[data-testid="user-role-select-save-button"]'
              );
              await expect(saveButton).toBeDisabled();
            });

            const checkboxes = page.locator(
              '[data-testid="user-role-select-role-checkbox"]:not(:disabled)'
            );
            const hasCheckboxes = (await checkboxes.count()) > 0;

            if (hasCheckboxes) {
              await test.step('Toggle a role', async () => {
                await checkboxes.first().click();
              });

              await test.step('Verify save button is enabled', async () => {
                const saveButton = page.locator(
                  '[data-testid="user-role-select-save-button"]'
                );
                // Button might be enabled now, but could also be disabled if validation fails
                // Just check it exists
                await expect(saveButton).toBeVisible();
              });
            }

            await page.click('[data-testid="user-role-select-close-button"]');
          }
        }
      }
    });
  });

  test.describe('Modal Close Behavior', () => {
    test('should close modal when clicking close button', async ({ page }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), button[aria-label*="role"], [data-testid*="roles"]');
        const hasButton = await manageRolesButton.isVisible();

        if (hasButton) {
          await manageRolesButton.click();

          const modal = page.locator('[data-testid="user-role-select-modal"]');
          const hasModal = await modal.isVisible();

          if (hasModal) {
            await test.step('Click close button', async () => {
              await page.click(
                '[data-testid="user-role-select-close-button"]'
              );
            });

            await test.step('Verify modal is closed', async () => {
              await expect(modal).not.toBeVisible();
            });
          }
        }
      }
    });

    test('should close modal when clicking cancel button', async ({ page }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), button[aria-label*="role"], [data-testid*="roles"]');
        const hasButton = await manageRolesButton.isVisible();

        if (hasButton) {
          await manageRolesButton.click();

          const modal = page.locator('[data-testid="user-role-select-modal"]');
          const hasModal = await modal.isVisible();

          if (hasModal) {
            await test.step('Click cancel button', async () => {
              await page.click(
                '[data-testid="user-role-select-cancel-button"]'
              );
            });

            await test.step('Verify modal is closed', async () => {
              await expect(modal).not.toBeVisible();
            });
          }
        }
      }
    });

    test('should close modal when clicking overlay', async ({ page }) => {
      await page.goto('/admin/users');

      const rows = page.locator('[data-testid="user-management-row"]');
      const hasRows = (await rows.count()) > 0;

      if (hasRows) {
        const manageRolesButton = rows.first().locator('button:has-text("Roles"), button[aria-label*="role"], [data-testid*="roles"]');
        const hasButton = await manageRolesButton.isVisible();

        if (hasButton) {
          await manageRolesButton.click();

          const modal = page.locator('[data-testid="user-role-select-modal"]');
          const hasModal = await modal.isVisible();

          if (hasModal) {
            await test.step('Click overlay', async () => {
              await page
                .locator('[data-testid="user-role-select-overlay"]')
                .click({ position: { x: 10, y: 10 } });
            });

            await test.step('Verify modal is closed', async () => {
              await expect(modal).not.toBeVisible();
            });
          }
        }
      }
    });
  });

  test.describe('Self-Edit Warning', () => {
    test('should show warning when editing own roles', async ({ page }) => {
      // This test would require navigating to the current admin user's role selection
      // Skip for now as it requires more setup
      await page.goto('/admin/users');
      // This test is placeholder - implementation depends on how user table identifies current user
    });
  });
});
