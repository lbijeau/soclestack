import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { MembersPage } from '../../pages/MembersPage';

test.describe('Member Management', () => {
  test.beforeEach(async () => {
    await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test('should display member list for owner', async ({ page }) => {
    // Login as organization owner
    await AuthHelpers.loginAsOrgOwner(page);

    const membersPage = new MembersPage(page);
    await membersPage.goto();

    // Verify all members are displayed
    await membersPage.assertMemberExists('org-owner@test.com');
    await membersPage.assertMemberExists('org-admin@test.com');
    await membersPage.assertMemberExists('org-member@test.com');

    // Verify correct roles are shown
    await membersPage.assertMemberRole('org-owner@test.com', 'OWNER');
    await membersPage.assertMemberRole('org-admin@test.com', 'ADMIN');
    await membersPage.assertMemberRole('org-member@test.com', 'MEMBER');

    // Verify invite button is visible for owner
    await membersPage.assertInviteButtonVisible();
  });

  test('should allow owner to change member role', async ({ page }) => {
    // Login as organization owner
    await AuthHelpers.loginAsOrgOwner(page);

    const membersPage = new MembersPage(page);
    await membersPage.goto();

    // Change admin to member
    await membersPage.changeRole('org-admin@test.com', 'MEMBER');
    await membersPage.assertMemberRole('org-admin@test.com', 'MEMBER');

    // Change back to admin
    await membersPage.changeRole('org-admin@test.com', 'ADMIN');
    await membersPage.assertMemberRole('org-admin@test.com', 'ADMIN');
  });

  test('should allow owner to remove member', async ({ page }) => {
    // Login as organization owner
    await AuthHelpers.loginAsOrgOwner(page);

    const membersPage = new MembersPage(page);
    await membersPage.goto();

    // Get initial member count
    const initialCount = await membersPage.getMemberCount();

    // Remove regular member
    await membersPage.removeMember('org-member@test.com');

    // Verify member is removed
    await membersPage.assertMemberNotExists('org-member@test.com');

    // Verify count decreased
    const newCount = await membersPage.getMemberCount();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should not allow owner to be removed', async ({ page }) => {
    // Login as organization admin
    await AuthHelpers.loginAsOrgAdmin(page);

    const membersPage = new MembersPage(page);
    await membersPage.goto();

    // Owner should be visible but not manageable by admin
    await membersPage.assertMemberExists('org-owner@test.com');
    await membersPage.assertCannotManageMember('org-owner@test.com');
  });

  test('should not allow admin to manage other admins', async ({ page }) => {
    // Create a second admin user
    const secondAdmin = await DatabaseHelpers.createTestUser({
      email: 'org-admin2@test.com',
      password: 'Admin2Test123!',
      username: 'orgadmin2',
      firstName: 'Second',
      lastName: 'Admin',
    });

    // Get the test organization and add second admin
    const testOrg = await DatabaseHelpers.setupTestOrganization();
    await DatabaseHelpers.addMemberToOrganization(testOrg.org.id, secondAdmin.id, 'ADMIN');

    // Login as first admin
    await AuthHelpers.loginAsOrgAdmin(page);

    const membersPage = new MembersPage(page);
    await membersPage.goto();

    // Admin should not be able to manage other admin
    await membersPage.assertMemberExists('org-admin2@test.com');
    await membersPage.assertCannotManageMember('org-admin2@test.com');

    // Also verify they cannot manage themselves
    await membersPage.assertCannotManageMember('org-admin@test.com');
  });

  test('should not show management controls to member', async ({ page }) => {
    // Login as regular member
    await AuthHelpers.loginAsOrgMember(page);

    const membersPage = new MembersPage(page);
    await membersPage.goto();

    // Member should see other members but not manage them
    await membersPage.assertMemberExists('org-owner@test.com');
    await membersPage.assertMemberExists('org-admin@test.com');
    await membersPage.assertMemberExists('org-member@test.com');

    // Member cannot manage anyone
    await membersPage.assertCannotManageMember('org-owner@test.com');
    await membersPage.assertCannotManageMember('org-admin@test.com');
    await membersPage.assertCannotManageMember('org-member@test.com');

    // Invite button should be hidden for regular members
    await membersPage.assertInviteButtonHidden();
  });

  test('should allow admin to remove member', async ({ page }) => {
    // Login as organization admin
    await AuthHelpers.loginAsOrgAdmin(page);

    const membersPage = new MembersPage(page);
    await membersPage.goto();

    // Admin should be able to manage regular members
    await membersPage.assertMemberExists('org-member@test.com');
    await membersPage.assertCanManageMember('org-member@test.com');

    // Get initial count
    const initialCount = await membersPage.getMemberCount();

    // Remove the regular member
    await membersPage.removeMember('org-member@test.com');

    // Verify member is removed
    await membersPage.assertMemberNotExists('org-member@test.com');

    // Verify count decreased
    const newCount = await membersPage.getMemberCount();
    expect(newCount).toBe(initialCount - 1);
  });
});
