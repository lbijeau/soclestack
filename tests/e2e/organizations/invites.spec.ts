import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { InvitesPage } from '../../pages/InvitesPage';
import { InviteAcceptPage } from '../../pages/InviteAcceptPage';

test.describe('Organization Invites', () => {
  let testOrg: Awaited<ReturnType<typeof DatabaseHelpers.setupTestOrganization>>;

  test.beforeEach(async () => {
    testOrg = await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test.describe('Sending Invites', () => {
    test('should send invite as owner', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      const newInviteEmail = 'new-invite@test.com';
      await invitesPage.sendInvite(newInviteEmail, 'MEMBER');

      await invitesPage.assertSuccessMessageVisible();
      await invitesPage.assertInvitePending(newInviteEmail);
    });

    test('should send invite with admin role', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      const adminInviteEmail = 'admin-invite@test.com';
      await invitesPage.sendInvite(adminInviteEmail, 'ADMIN');

      await invitesPage.assertSuccessMessageVisible();
      await invitesPage.assertInvitePending(adminInviteEmail);
    });

    test('should cancel pending invite', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      // Verify the pending invite exists
      const pendingEmail = 'pending-invite@test.com';
      await invitesPage.assertInvitePending(pendingEmail);

      // Cancel the invite
      await invitesPage.cancelInvite(pendingEmail);

      // Verify it's removed from the list
      await invitesPage.assertInviteNotPending(pendingEmail);
    });

    test('should show expired badge on expired invite', async ({ page }) => {
      await AuthHelpers.loginAsOrgOwner(page);
      const invitesPage = new InvitesPage(page);
      await invitesPage.goto();

      // Verify the expired invite shows the expired badge
      const expiredEmail = 'expired-invite@test.com';
      await invitesPage.assertInviteExpired(expiredEmail);
    });
  });

  test.describe('Accepting Invites', () => {
    test('should accept invite when logged in as correct user', async ({ page }) => {
      // Create user with matching email
      const invitedUser = await DatabaseHelpers.createTestUser({
        email: 'pending-invite@test.com',
        password: 'InvitedUser123!',
        username: 'inviteduser',
        firstName: 'Invited',
        lastName: 'User',
      });

      // Login as the invited user
      await AuthHelpers.authenticateUser(page, invitedUser.email, invitedUser.plainPassword);

      // Navigate to the invite acceptance page
      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto(testOrg.pendingInvite.token);

      // Verify invite details are shown
      await inviteAcceptPage.assertOrgName(testOrg.org.name);
      await inviteAcceptPage.assertInviteEmail('pending-invite@test.com');

      // Accept the invite
      await inviteAcceptPage.assertAcceptButtonVisible();
      await inviteAcceptPage.acceptInvite();

      // Should be redirected to organization page
      await expect(page).toHaveURL(/.*\/organization/);
    });

    test('should show mismatch warning when logged in as different user', async ({ page }) => {
      // Login as non-member (different email than the invite)
      await AuthHelpers.loginAsNonMember(page);

      // Navigate to the pending invite (for pending-invite@test.com)
      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto(testOrg.pendingInvite.token);

      // Should show email mismatch warning
      await inviteAcceptPage.assertEmailMismatch();
    });

    test('should show login/register options when not logged in', async ({ page }) => {
      // Navigate directly to invite page without logging in
      const inviteAcceptPage = new InviteAcceptPage(page);
      await inviteAcceptPage.goto(testOrg.pendingInvite.token);

      // Should show login and create account buttons, but not accept button
      await inviteAcceptPage.assertLoggedOutState();
    });

    test('should show error for expired invite', async ({ page }) => {
      // Create user with matching email for the expired invite
      const expiredUser = await DatabaseHelpers.createTestUser({
        email: 'expired-invite@test.com',
        password: 'ExpiredUser123!',
        username: 'expireduser',
        firstName: 'Expired',
        lastName: 'User',
      });

      // Login as the user
      await AuthHelpers.authenticateUser(page, expiredUser.email, expiredUser.plainPassword);

      // Navigate to the expired invite page
      const inviteAcceptPage = new InviteAcceptPage(page);
      await page.goto(`/invite/${testOrg.expiredInvite.token}`);

      // Should show expired error message
      await inviteAcceptPage.assertExpiredInvite();
    });

    test('should show error for invalid token', async ({ page }) => {
      // Login as any user
      await AuthHelpers.loginAsOrgOwner(page);

      // Navigate to an invalid invite token
      const inviteAcceptPage = new InviteAcceptPage(page);
      await page.goto('/invite/invalid-token-12345');

      // Should show invalid invite error
      await inviteAcceptPage.assertInvalidInvite();
    });
  });
});
