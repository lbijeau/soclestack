import { test, expect, Browser } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';

test.describe('Organization Access Control', () => {
  let testData: Awaited<ReturnType<typeof DatabaseHelpers.setupTestOrganization>>;

  test.beforeEach(async () => {
    testData = await DatabaseHelpers.setupTestOrganization();
  });

  test.afterEach(async () => {
    await DatabaseHelpers.cleanupTestOrganizations();
  });

  test('should redirect non-member from organization pages', async ({ page }) => {
    await test.step('Login as non-member user', async () => {
      await AuthHelpers.loginAsNonMember(page);
    });

    await test.step('Attempt to access organization main page', async () => {
      await page.goto('/organization');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify redirect to dashboard', async () => {
      await expect(page).toHaveURL(/\/(dashboard|login)/);
    });

    await test.step('Attempt to access members page', async () => {
      await page.goto('/organization/members');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify redirect from members page', async () => {
      await expect(page).toHaveURL(/\/(dashboard|login)/);
    });

    await test.step('Attempt to access invites page', async () => {
      await page.goto('/organization/invites');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify redirect from invites page', async () => {
      await expect(page).toHaveURL(/\/(dashboard|organization|login)/);
    });
  });

  test('should allow member to view organization pages', async ({ page }) => {
    await test.step('Login as organization member', async () => {
      await AuthHelpers.loginAsOrgMember(page);
    });

    await test.step('Access organization main page', async () => {
      await page.goto('/organization');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify organization page is accessible', async () => {
      await expect(page).toHaveURL(/\/organization/);
      await expect(page.locator('h1')).toContainText('Organization');
    });

    await test.step('Verify role is displayed', async () => {
      await expect(page.locator('[data-testid="org-role-display"]')).toBeVisible();
    });

    await test.step('Access members page', async () => {
      await page.goto('/organization/members');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify members page is accessible', async () => {
      await expect(page).toHaveURL(/\/organization\/members/);
      await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
    });
  });

  test('should restrict invites page to admins and owners', async ({ page }) => {
    await test.step('Login as organization member', async () => {
      await AuthHelpers.loginAsOrgMember(page);
    });

    await test.step('Attempt to access invites page as member', async () => {
      await page.goto('/organization/invites');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify member is redirected from invites page', async () => {
      await expect(page).toHaveURL(/\/organization(?!\/invites)/);
    });

    await test.step('Logout and login as admin', async () => {
      await AuthHelpers.logout(page);
      await AuthHelpers.loginAsOrgAdmin(page);
    });

    await test.step('Access invites page as admin', async () => {
      await page.goto('/organization/invites');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify admin can access invites page', async () => {
      await expect(page).toHaveURL(/\/organization\/invites/);
      await expect(page.locator('[data-testid="invite-email-input"]')).toBeVisible();
    });

    await test.step('Logout and login as owner', async () => {
      await AuthHelpers.logout(page);
      await AuthHelpers.loginAsOrgOwner(page);
    });

    await test.step('Access invites page as owner', async () => {
      await page.goto('/organization/invites');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify owner can access invites page', async () => {
      await expect(page).toHaveURL(/\/organization\/invites/);
      await expect(page.locator('[data-testid="invite-email-input"]')).toBeVisible();
    });
  });

  test('should enforce cross-org isolation', async ({ browser }) => {
    let secondOwner: Awaited<ReturnType<typeof DatabaseHelpers.createTestUser>>;
    let secondOrg: Awaited<ReturnType<typeof DatabaseHelpers.createTestOrganization>>;

    await test.step('Create a second organization with a different owner', async () => {
      secondOwner = await DatabaseHelpers.createTestUser({
        email: 'second-org-owner@test.com',
        password: 'SecondOwnerTest123!',
        username: 'secondowner',
        firstName: 'Second',
        lastName: 'Owner',
      });

      secondOrg = await DatabaseHelpers.createTestOrganization({
        name: 'Second Test Organization',
        slug: `second-test-org-${Date.now()}`,
        ownerEmail: 'second-org-owner@test.com',
      });
    });

    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      await test.step('Login first owner in context1', async () => {
        await AuthHelpers.authenticateUser(page1, 'org-owner@test.com', 'OwnerTest123!');
      });

      await test.step('Login second owner in context2', async () => {
        await AuthHelpers.authenticateUser(page2, 'second-org-owner@test.com', 'SecondOwnerTest123!');
      });

      await test.step('First owner navigates to their organization', async () => {
        await page1.goto('/organization');
        await page1.waitForLoadState('networkidle');
      });

      await test.step('Verify first owner sees their organization name', async () => {
        const org1Name = await page1.locator('[data-testid="org-name-input"]').inputValue();
        expect(org1Name).toBe('Test Organization');
      });

      await test.step('Second owner navigates to their organization', async () => {
        await page2.goto('/organization');
        await page2.waitForLoadState('networkidle');
      });

      await test.step('Verify second owner sees their organization name', async () => {
        const org2Name = await page2.locator('[data-testid="org-name-input"]').inputValue();
        expect(org2Name).toBe('Second Test Organization');
      });

      await test.step('Verify API isolation for first owner', async () => {
        const firstOwnerMembersResponse = await page1.evaluate(async () => {
          const res = await fetch('/api/organizations/current/members');
          return res.json();
        });

        const firstOrgMemberEmails = firstOwnerMembersResponse.members?.map(
          (m: { email: string }) => m.email
        ) || [];
        expect(firstOrgMemberEmails).toContain('org-owner@test.com');
        expect(firstOrgMemberEmails).not.toContain('second-org-owner@test.com');
      });

      await test.step('Verify API isolation for second owner', async () => {
        const secondOwnerMembersResponse = await page2.evaluate(async () => {
          const res = await fetch('/api/organizations/current/members');
          return res.json();
        });

        const secondOrgMemberEmails = secondOwnerMembersResponse.members?.map(
          (m: { email: string }) => m.email
        ) || [];
        expect(secondOrgMemberEmails).toContain('second-org-owner@test.com');
        expect(secondOrgMemberEmails).not.toContain('org-owner@test.com');
      });

      await page1.close();
      await page2.close();
    } finally {
      await context1.close();
      await context2.close();

      // Clean up second organization and its owner
      if (secondOrg?.id) {
        await DatabaseHelpers.deleteTestOrganization(secondOrg.id);
      }
      if (secondOwner?.id) {
        await DatabaseHelpers.deleteTestUser(secondOwner.id);
      }
    }
  });

  test('should enforce role-based button visibility', async ({ page }) => {
    await test.step('Login as owner and navigate to organization page', async () => {
      await AuthHelpers.loginAsOrgOwner(page);
      await page.goto('/organization');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify owner sees all controls', async () => {
      await expect(page.locator('[data-testid="org-save-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-delete-button"]')).toBeVisible();
      await expect(page.locator('a[href="/organization/invites"]')).toBeVisible();
    });

    await test.step('Logout and login as admin', async () => {
      await AuthHelpers.logout(page);
      await AuthHelpers.loginAsOrgAdmin(page);
      await page.goto('/organization');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify admin sees edit controls but not delete button', async () => {
      await expect(page.locator('[data-testid="org-save-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="org-delete-button"]')).not.toBeVisible();
      await expect(page.locator('a[href="/organization/invites"]')).toBeVisible();
    });

    await test.step('Logout and login as member', async () => {
      await AuthHelpers.logout(page);
      await AuthHelpers.loginAsOrgMember(page);
      await page.goto('/organization');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify member sees no edit controls', async () => {
      await expect(page.locator('[data-testid="org-save-button"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="org-delete-button"]')).not.toBeVisible();
      await expect(page.locator('a[href="/organization/invites"]')).not.toBeVisible();
    });

    await test.step('Navigate to members page as member', async () => {
      await page.goto('/organization/members');
      await page.waitForLoadState('networkidle');
    });

    await test.step('Verify member sees no management controls on members page', async () => {
      await expect(page.locator('[data-testid="invite-members-button"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="member-role-select"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="member-remove-button"]')).not.toBeVisible();
    });

    await test.step('Verify member sees role badges instead of dropdowns', async () => {
      await expect(page.locator('[data-testid="member-role-badge"]').first()).toBeVisible();
    });
  });
});
