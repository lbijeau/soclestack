import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { OrganizationPage } from '../../pages/OrganizationPage';

test.describe('Organization CRUD', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test('should display organization details for owner', async ({ page }) => {
    await test.step('Login as organization owner', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
    });

    const orgPage = new OrganizationPage(page);

    await test.step('Navigate to organization page', async () => {
      await orgPage.goto();
    });

    await test.step('Verify organization name is displayed', async () => {
      await expect(orgPage.nameInput).toHaveValue('Test Organization');
    });

    await test.step('Verify owner role is displayed', async () => {
      await orgPage.assertRole('OWNER');
    });

    await test.step('Verify member count shows 3 members', async () => {
      // Owner, admin, and member = 3 members
      await orgPage.assertMemberCount(3);
    });

    await test.step('Verify owner can edit organization', async () => {
      await orgPage.assertNameInputEditable();
      await orgPage.assertSaveButtonVisible();
    });

    await test.step('Verify owner can delete organization', async () => {
      await orgPage.assertDeleteButtonVisible();
    });
  });

  test('should display organization details for admin', async ({ page }) => {
    await test.step('Login as organization admin', async () => {
      await AuthHelpers.loginAsOrgAdmin(page);
    });

    const orgPage = new OrganizationPage(page);

    await test.step('Navigate to organization page', async () => {
      await orgPage.goto();
    });

    await test.step('Verify admin role is displayed', async () => {
      await orgPage.assertRole('ADMIN');
    });

    await test.step('Verify admin can edit organization', async () => {
      await orgPage.assertNameInputEditable();
      await orgPage.assertSaveButtonVisible();
    });

    await test.step('Verify admin cannot delete organization', async () => {
      await orgPage.assertDeleteButtonHidden();
    });
  });

  test('should display organization details for member', async ({ page }) => {
    await test.step('Login as organization member', async () => {
      await AuthHelpers.loginAsOrgMember(page);
    });

    const orgPage = new OrganizationPage(page);

    await test.step('Navigate to organization page', async () => {
      await orgPage.goto();
    });

    await test.step('Verify member role is displayed', async () => {
      await orgPage.assertRole('MEMBER');
    });

    await test.step('Verify member cannot edit organization', async () => {
      await orgPage.assertNameInputReadonly();
      await orgPage.assertSaveButtonHidden();
    });

    await test.step('Verify member cannot delete organization', async () => {
      await orgPage.assertDeleteButtonHidden();
    });
  });

  test('should update organization name as owner', async ({ page }) => {
    const newName = 'Updated Organization Name';

    await test.step('Login as organization owner', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
    });

    const orgPage = new OrganizationPage(page);

    await test.step('Navigate to organization page', async () => {
      await orgPage.goto();
    });

    await test.step('Update organization name', async () => {
      await orgPage.updateName(newName);
    });

    await test.step('Verify success message is displayed', async () => {
      await orgPage.assertSuccessMessageVisible();
    });

    await test.step('Reload page and verify name persisted', async () => {
      await page.reload();
      await expect(orgPage.nameInput).toHaveValue(newName);
    });
  });

  test('should update organization name as admin', async ({ page }) => {
    const newName = 'Admin Updated Organization';

    await test.step('Login as organization admin', async () => {
      await AuthHelpers.loginAsOrgAdmin(page);
    });

    const orgPage = new OrganizationPage(page);

    await test.step('Navigate to organization page', async () => {
      await orgPage.goto();
    });

    await test.step('Update organization name', async () => {
      await orgPage.updateName(newName);
    });

    await test.step('Verify success message is displayed', async () => {
      await orgPage.assertSuccessMessageVisible();
    });

    await test.step('Reload page and verify name persisted', async () => {
      await page.reload();
      await expect(orgPage.nameInput).toHaveValue(newName);
    });
  });

  test('should delete organization as owner', async ({ page }) => {
    await test.step('Login as organization owner', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
    });

    const orgPage = new OrganizationPage(page);

    await test.step('Navigate to organization page', async () => {
      await orgPage.goto();
    });

    await test.step('Delete organization', async () => {
      await orgPage.deleteOrganization();
    });

    await test.step('Verify redirect to dashboard', async () => {
      await expect(page).toHaveURL(/.*\/dashboard/);
    });
  });

  test('should redirect non-member to dashboard', async ({ page }) => {
    await test.step('Login as non-member user', async () => {
      await AuthHelpers.loginAsNonMember(page);
    });

    await test.step('Attempt to access organization page', async () => {
      await page.goto('/organization');
    });

    await test.step('Verify redirect to dashboard', async () => {
      await expect(page).toHaveURL(/.*\/dashboard/);
    });
  });
});
