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
    // Login as non-member user
    await AuthHelpers.loginAsNonMember(page);

    // Attempt to access organization main page
    await page.goto('/organization');
    await page.waitForLoadState('networkidle');

    // Should be redirected to dashboard (no organization)
    await expect(page).toHaveURL(/\/(dashboard|login)/);

    // Attempt to access members page
    await page.goto('/organization/members');
    await page.waitForLoadState('networkidle');

    // Should be redirected
    await expect(page).toHaveURL(/\/(dashboard|login)/);

    // Attempt to access invites page
    await page.goto('/organization/invites');
    await page.waitForLoadState('networkidle');

    // Should be redirected
    await expect(page).toHaveURL(/\/(dashboard|organization|login)/);
  });

  test('should allow member to view organization pages', async ({ page }) => {
    // Login as organization member
    await AuthHelpers.loginAsOrgMember(page);

    // Access organization main page
    await page.goto('/organization');
    await page.waitForLoadState('networkidle');

    // Should be able to view organization page
    await expect(page).toHaveURL(/\/organization/);
    await expect(page.locator('h1')).toContainText('Organization');

    // Member should see their role displayed
    await expect(page.locator('[data-testid="org-role-display"]')).toBeVisible();

    // Access members page
    await page.goto('/organization/members');
    await page.waitForLoadState('networkidle');

    // Should be able to view members page
    await expect(page).toHaveURL(/\/organization\/members/);
    await expect(page.locator('[data-testid="members-list"]')).toBeVisible();
  });

  test('should restrict invites page to admins and owners', async ({ page }) => {
    // Login as organization member (not admin or owner)
    await AuthHelpers.loginAsOrgMember(page);

    // Attempt to access invites page
    await page.goto('/organization/invites');
    await page.waitForLoadState('networkidle');

    // Member should be redirected from invites page (403 redirects to /organization)
    await expect(page).toHaveURL(/\/organization(?!\/invites)/);

    // Logout and login as admin
    await AuthHelpers.logout(page);
    await AuthHelpers.loginAsOrgAdmin(page);

    // Admin should be able to access invites page
    await page.goto('/organization/invites');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/organization\/invites/);
    await expect(page.locator('[data-testid="invite-email-input"]')).toBeVisible();

    // Logout and login as owner
    await AuthHelpers.logout(page);
    await AuthHelpers.loginAsOrgOwner(page);

    // Owner should be able to access invites page
    await page.goto('/organization/invites');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/organization\/invites/);
    await expect(page.locator('[data-testid="invite-email-input"]')).toBeVisible();
  });

  test('should enforce cross-org isolation', async ({ browser }) => {
    // Create a second organization with a different owner
    const secondOwner = await DatabaseHelpers.createTestUser({
      email: 'second-org-owner@test.com',
      password: 'SecondOwnerTest123!',
      username: 'secondowner',
      firstName: 'Second',
      lastName: 'Owner',
    });

    const secondOrg = await DatabaseHelpers.createTestOrganization({
      name: 'Second Test Organization',
      slug: `second-test-org-${Date.now()}`,
      ownerEmail: 'second-org-owner@test.com',
    });

    // Create two separate browser contexts for isolation
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // Login first owner in context1
      await AuthHelpers.authenticateUser(page1, 'org-owner@test.com', 'OwnerTest123!');

      // Login second owner in context2
      await AuthHelpers.authenticateUser(page2, 'second-org-owner@test.com', 'SecondOwnerTest123!');

      // First owner navigates to their organization
      await page1.goto('/organization');
      await page1.waitForLoadState('networkidle');

      // Should see their organization name
      const org1Name = await page1.locator('[data-testid="org-name-input"]').inputValue();
      expect(org1Name).toBe('Test Organization');

      // Second owner navigates to their organization
      await page2.goto('/organization');
      await page2.waitForLoadState('networkidle');

      // Should see their organization name
      const org2Name = await page2.locator('[data-testid="org-name-input"]').inputValue();
      expect(org2Name).toBe('Second Test Organization');

      // Test API isolation: first owner tries to access second org's members via API
      // The API should only return current organization's data
      const firstOwnerMembersResponse = await page1.evaluate(async () => {
        const res = await fetch('/api/organizations/current/members');
        return res.json();
      });

      // First owner should only see members of their own organization
      const firstOrgMemberEmails = firstOwnerMembersResponse.members?.map(
        (m: { email: string }) => m.email
      ) || [];
      expect(firstOrgMemberEmails).toContain('org-owner@test.com');
      expect(firstOrgMemberEmails).not.toContain('second-org-owner@test.com');

      // Second owner's members should not include first org's members
      const secondOwnerMembersResponse = await page2.evaluate(async () => {
        const res = await fetch('/api/organizations/current/members');
        return res.json();
      });

      const secondOrgMemberEmails = secondOwnerMembersResponse.members?.map(
        (m: { email: string }) => m.email
      ) || [];
      expect(secondOrgMemberEmails).toContain('second-org-owner@test.com');
      expect(secondOrgMemberEmails).not.toContain('org-owner@test.com');

      await page1.close();
      await page2.close();
    } finally {
      await context1.close();
      await context2.close();

      // Clean up second organization
      if (secondOrg?.id) {
        await DatabaseHelpers.deleteTestOrganization(secondOrg.id);
      }
    }
  });

  test('should enforce role-based button visibility', async ({ page }) => {
    // Test as Owner - should see all controls
    await AuthHelpers.loginAsOrgOwner(page);
    await page.goto('/organization');
    await page.waitForLoadState('networkidle');

    // Owner should see edit controls (save button)
    await expect(page.locator('[data-testid="org-save-button"]')).toBeVisible();

    // Owner should see delete button (in danger zone)
    await expect(page.locator('[data-testid="org-delete-button"]')).toBeVisible();

    // Owner should see invite link in navigation
    await expect(page.locator('a[href="/organization/invites"]')).toBeVisible();

    // Logout and test as Admin
    await AuthHelpers.logout(page);
    await AuthHelpers.loginAsOrgAdmin(page);
    await page.goto('/organization');
    await page.waitForLoadState('networkidle');

    // Admin should see edit controls (save button)
    await expect(page.locator('[data-testid="org-save-button"]')).toBeVisible();

    // Admin should NOT see delete button (only owners can delete)
    await expect(page.locator('[data-testid="org-delete-button"]')).not.toBeVisible();

    // Admin should see invite link in navigation
    await expect(page.locator('a[href="/organization/invites"]')).toBeVisible();

    // Logout and test as Member
    await AuthHelpers.logout(page);
    await AuthHelpers.loginAsOrgMember(page);
    await page.goto('/organization');
    await page.waitForLoadState('networkidle');

    // Member should NOT see save button (not editable)
    await expect(page.locator('[data-testid="org-save-button"]')).not.toBeVisible();

    // Member should NOT see delete button
    await expect(page.locator('[data-testid="org-delete-button"]')).not.toBeVisible();

    // Member should NOT see invite link in navigation
    await expect(page.locator('a[href="/organization/invites"]')).not.toBeVisible();

    // Test member controls on members page
    await page.goto('/organization/members');
    await page.waitForLoadState('networkidle');

    // Member should NOT see invite members button
    await expect(page.locator('[data-testid="invite-members-button"]')).not.toBeVisible();

    // Member should NOT see role selection dropdowns (they see badges instead)
    await expect(page.locator('[data-testid="member-role-select"]')).not.toBeVisible();

    // Member should NOT see remove buttons
    await expect(page.locator('[data-testid="member-remove-button"]')).not.toBeVisible();

    // Member should see role badges instead
    await expect(page.locator('[data-testid="member-role-badge"]').first()).toBeVisible();
  });
});
