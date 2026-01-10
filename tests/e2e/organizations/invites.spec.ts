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
      await test.step('Login as organization owner', async () => {
        await AuthHelpers.loginAsOrgOwner(page);
      });

      const invitesPage = new InvitesPage(page);

      await test.step('Navigate to invites page', async () => {
        await invitesPage.goto();
      });

      const newInviteEmail = 'new-invite@test.com';

      await test.step('Send invite to new member', async () => {
        await invitesPage.sendInvite(newInviteEmail, 'MEMBER');
      });

      await test.step('Verify success message and pending invite', async () => {
        await invitesPage.assertSuccessMessageVisible();
        await invitesPage.assertInvitePending(newInviteEmail);
      });
    });

    test('should send invite with admin role', async ({ page }) => {
      await test.step('Login as organization owner', async () => {
        await AuthHelpers.loginAsOrgOwner(page);
      });

      const invitesPage = new InvitesPage(page);

      await test.step('Navigate to invites page', async () => {
        await invitesPage.goto();
      });

      const adminInviteEmail = 'admin-invite@test.com';

      await test.step('Send invite with admin role', async () => {
        await invitesPage.sendInvite(adminInviteEmail, 'ADMIN');
      });

      await test.step('Verify success message and pending invite', async () => {
        await invitesPage.assertSuccessMessageVisible();
        await invitesPage.assertInvitePending(adminInviteEmail);
      });
    });

    test('should cancel pending invite', async ({ page }) => {
      await test.step('Login as organization owner', async () => {
        await AuthHelpers.loginAsOrgOwner(page);
      });

      const invitesPage = new InvitesPage(page);

      await test.step('Navigate to invites page', async () => {
        await invitesPage.goto();
      });

      const pendingEmail = 'pending-invite@test.com';

      await test.step('Verify the pending invite exists', async () => {
        await invitesPage.assertInvitePending(pendingEmail);
      });

      await test.step('Cancel the invite', async () => {
        await invitesPage.cancelInvite(pendingEmail);
      });

      await test.step('Verify invite is removed from the list', async () => {
        await invitesPage.assertInviteNotPending(pendingEmail);
      });
    });

    test('should show expired badge on expired invite', async ({ page }) => {
      await test.step('Login as organization owner', async () => {
        await AuthHelpers.loginAsOrgOwner(page);
      });

      const invitesPage = new InvitesPage(page);

      await test.step('Navigate to invites page', async () => {
        await invitesPage.goto();
      });

      await test.step('Verify the expired invite shows expired badge', async () => {
        const expiredEmail = 'expired-invite@test.com';
        await invitesPage.assertInviteExpired(expiredEmail);
      });
    });
  });

  test.describe('Accepting Invites', () => {
    test('should accept invite when logged in as correct user', async ({ page }) => {
      let invitedUser: Awaited<ReturnType<typeof DatabaseHelpers.createTestUser>>;

      await test.step('Create user with matching email', async () => {
        invitedUser = await DatabaseHelpers.createTestUser({
          email: 'pending-invite@test.com',
          password: 'InvitedUser123!',
          username: 'inviteduser',
          firstName: 'Invited',
          lastName: 'User',
        });
      });

      await test.step('Login as the invited user', async () => {
        await AuthHelpers.authenticateUser(page, invitedUser.email, invitedUser.plainPassword);
      });

      const inviteAcceptPage = new InviteAcceptPage(page);

      await test.step('Navigate to the invite acceptance page', async () => {
        await inviteAcceptPage.goto(testOrg.pendingInvite.token);
      });

      await test.step('Verify invite details are shown', async () => {
        await inviteAcceptPage.assertOrgName(testOrg.org.name);
        await inviteAcceptPage.assertInviteEmail('pending-invite@test.com');
      });

      await test.step('Accept the invite', async () => {
        await inviteAcceptPage.assertAcceptButtonVisible();
        await inviteAcceptPage.acceptInvite();
      });

      await test.step('Verify redirect to organization page', async () => {
        await expect(page).toHaveURL(/.*\/organization/);
      });
    });

    test('should show mismatch warning when logged in as different user', async ({ page }) => {
      await test.step('Login as non-member user', async () => {
        await AuthHelpers.loginAsNonMember(page);
      });

      const inviteAcceptPage = new InviteAcceptPage(page);

      await test.step('Navigate to the pending invite', async () => {
        await inviteAcceptPage.goto(testOrg.pendingInvite.token);
      });

      await test.step('Verify email mismatch warning is shown', async () => {
        await inviteAcceptPage.assertEmailMismatch();
      });
    });

    test('should show login/register options when not logged in', async ({ page }) => {
      const inviteAcceptPage = new InviteAcceptPage(page);

      await test.step('Navigate directly to invite page without logging in', async () => {
        await inviteAcceptPage.goto(testOrg.pendingInvite.token);
      });

      await test.step('Verify logged out state with login/register options', async () => {
        await inviteAcceptPage.assertLoggedOutState();
      });
    });

    test('should show error for expired invite', async ({ page }) => {
      let expiredUser: Awaited<ReturnType<typeof DatabaseHelpers.createTestUser>>;

      await test.step('Create user with matching email for expired invite', async () => {
        expiredUser = await DatabaseHelpers.createTestUser({
          email: 'expired-invite@test.com',
          password: 'ExpiredUser123!',
          username: 'expireduser',
          firstName: 'Expired',
          lastName: 'User',
        });
      });

      await test.step('Login as the user', async () => {
        await AuthHelpers.authenticateUser(page, expiredUser.email, expiredUser.plainPassword);
      });

      const inviteAcceptPage = new InviteAcceptPage(page);

      await test.step('Navigate to the expired invite page', async () => {
        await page.goto(`/invite/${testOrg.expiredInvite.token}`);
      });

      await test.step('Verify expired error message is shown', async () => {
        await inviteAcceptPage.assertExpiredInvite();
      });
    });

    test('should show error for invalid token', async ({ page }) => {
      await test.step('Login as any user', async () => {
        await AuthHelpers.loginAsOrgOwner(page);
      });

      const inviteAcceptPage = new InviteAcceptPage(page);

      await test.step('Navigate to an invalid invite token', async () => {
        await page.goto('/invite/invalid-token-12345');
      });

      await test.step('Verify invalid invite error is shown', async () => {
        await inviteAcceptPage.assertInvalidInvite();
      });
    });
  });
});
