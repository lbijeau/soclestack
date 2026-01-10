import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { MembersPage } from '../../pages/MembersPage';

test.describe('Member Management', () => {
  let testOrg: Awaited<ReturnType<typeof DatabaseHelpers.setupTestOrganization>>;

  test.beforeEach(async () => {
    testOrg = await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test('should display member list for owner', async ({ page }) => {
    await test.step('Login as organization owner', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
    });

    const membersPage = new MembersPage(page);

    await test.step('Navigate to members page', async () => {
      await membersPage.goto();
    });

    await test.step('Verify all members are displayed', async () => {
      await membersPage.assertMemberExists('org-owner@test.com');
      await membersPage.assertMemberExists('org-admin@test.com');
      await membersPage.assertMemberExists('org-member@test.com');
    });

    await test.step('Verify correct roles are shown', async () => {
      await membersPage.assertMemberRole('org-owner@test.com', 'OWNER');
      await membersPage.assertMemberRole('org-admin@test.com', 'ADMIN');
      await membersPage.assertMemberRole('org-member@test.com', 'MEMBER');
    });

    await test.step('Verify invite button is visible for owner', async () => {
      await membersPage.assertInviteButtonVisible();
    });
  });

  test('should allow owner to change member role', async ({ page }) => {
    await test.step('Login as organization owner', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
    });

    const membersPage = new MembersPage(page);

    await test.step('Navigate to members page', async () => {
      await membersPage.goto();
    });

    await test.step('Change admin to member', async () => {
      await membersPage.changeRole('org-admin@test.com', 'MEMBER');
      await membersPage.assertMemberRole('org-admin@test.com', 'MEMBER');
    });

    await test.step('Change back to admin', async () => {
      await membersPage.changeRole('org-admin@test.com', 'ADMIN');
      await membersPage.assertMemberRole('org-admin@test.com', 'ADMIN');
    });
  });

  test('should allow owner to remove member', async ({ page }) => {
    await test.step('Login as organization owner', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
    });

    const membersPage = new MembersPage(page);

    await test.step('Navigate to members page', async () => {
      await membersPage.goto();
    });

    let initialCount: number;
    await test.step('Get initial member count', async () => {
      initialCount = await membersPage.getMemberCount();
    });

    await test.step('Remove regular member', async () => {
      await membersPage.removeMember('org-member@test.com');
    });

    await test.step('Verify member is removed', async () => {
      await membersPage.assertMemberNotExists('org-member@test.com');
    });

    await test.step('Verify count decreased', async () => {
      const newCount = await membersPage.getMemberCount();
      expect(newCount).toBe(initialCount - 1);
    });
  });

  test('should not allow owner to be removed', async ({ page }) => {
    await test.step('Login as organization admin', async () => {
      await AuthHelpers.loginAsOrgAdmin(page);
    });

    const membersPage = new MembersPage(page);

    await test.step('Navigate to members page', async () => {
      await membersPage.goto();
    });

    await test.step('Verify owner is visible but not manageable by admin', async () => {
      await membersPage.assertMemberExists('org-owner@test.com');
      await membersPage.assertCannotManageMember('org-owner@test.com');
    });
  });

  test('should not allow admin to manage other admins', async ({ page }) => {
    let secondAdmin: Awaited<ReturnType<typeof DatabaseHelpers.createTestUser>>;

    await test.step('Create a second admin user', async () => {
      secondAdmin = await DatabaseHelpers.createTestUser({
        email: 'org-admin2@test.com',
        password: 'Admin2Test123!',
        username: 'orgadmin2',
        firstName: 'Second',
        lastName: 'Admin',
      });
    });

    await test.step('Add second admin to the organization', async () => {
      // Use testOrg from beforeEach instead of calling setupTestOrganization() again
      await DatabaseHelpers.addMemberToOrganization(testOrg.org.id, secondAdmin.id, 'ADMIN');
    });

    await test.step('Login as first admin', async () => {
      await AuthHelpers.loginAsOrgAdmin(page);
    });

    const membersPage = new MembersPage(page);

    await test.step('Navigate to members page', async () => {
      await membersPage.goto();
    });

    await test.step('Verify admin cannot manage other admin', async () => {
      await membersPage.assertMemberExists('org-admin2@test.com');
      await membersPage.assertCannotManageMember('org-admin2@test.com');
    });

    await test.step('Verify admin cannot manage themselves', async () => {
      await membersPage.assertCannotManageMember('org-admin@test.com');
    });
  });

  test('should not show management controls to member', async ({ page }) => {
    await test.step('Login as regular member', async () => {
      await AuthHelpers.loginAsOrgMember(page);
    });

    const membersPage = new MembersPage(page);

    await test.step('Navigate to members page', async () => {
      await membersPage.goto();
    });

    await test.step('Verify member can see other members', async () => {
      await membersPage.assertMemberExists('org-owner@test.com');
      await membersPage.assertMemberExists('org-admin@test.com');
      await membersPage.assertMemberExists('org-member@test.com');
    });

    await test.step('Verify member cannot manage anyone', async () => {
      await membersPage.assertCannotManageMember('org-owner@test.com');
      await membersPage.assertCannotManageMember('org-admin@test.com');
      await membersPage.assertCannotManageMember('org-member@test.com');
    });

    await test.step('Verify invite button is hidden for regular members', async () => {
      await membersPage.assertInviteButtonHidden();
    });
  });

  test('should allow admin to remove member', async ({ page }) => {
    await test.step('Login as organization admin', async () => {
      await AuthHelpers.loginAsOrgAdmin(page);
    });

    const membersPage = new MembersPage(page);

    await test.step('Navigate to members page', async () => {
      await membersPage.goto();
    });

    await test.step('Verify admin can manage regular members', async () => {
      await membersPage.assertMemberExists('org-member@test.com');
      await membersPage.assertCanManageMember('org-member@test.com');
    });

    let initialCount: number;
    await test.step('Get initial member count', async () => {
      initialCount = await membersPage.getMemberCount();
    });

    await test.step('Remove the regular member', async () => {
      await membersPage.removeMember('org-member@test.com');
    });

    await test.step('Verify member is removed', async () => {
      await membersPage.assertMemberNotExists('org-member@test.com');
    });

    await test.step('Verify count decreased', async () => {
      const newCount = await membersPage.getMemberCount();
      expect(newCount).toBe(initialCount - 1);
    });
  });
});
