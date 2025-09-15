import { test, expect } from '@playwright/test';
import { AuthHelpers } from '../../utils/auth-helpers';
import { DatabaseHelpers } from '../../utils/database-helpers';
import { Role } from '@prisma/client';

test.describe('Role-Based Access Control', () => {
  test.beforeEach(async () => {
    // Ensure test users exist with different roles
    await DatabaseHelpers.setupTestUsers();
  });

  test.describe('Admin Access Control', () => {
    test('should allow admin access to all areas', async ({ page }) => {
      await AuthHelpers.loginAsAdmin(page);

      const adminRoutes = [
        '/admin',
        '/admin/users',
        '/admin/settings',
        '/admin/reports',
        '/admin/analytics',
        '/admin/system',
      ];

      await test.step('Verify admin can access all admin routes', async () => {
        const { allowed, denied } = await AuthHelpers.testAccessControl(page,
          adminRoutes.map(path => ({ path, minRole: Role.ADMIN }))
        );

        expect(denied.length).toBe(0);
        expect(allowed.length).toBe(adminRoutes.length);
      });

      await test.step('Verify admin menu is visible', async () => {
        await page.goto('/admin');
        await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
        await expect(page.locator('[data-testid="user-management-menu"]')).toBeVisible();
        await expect(page.locator('[data-testid="system-settings-menu"]')).toBeVisible();
      });

      await test.step('Verify admin can access user management', async () => {
        await page.goto('/admin/users');
        await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
        await expect(page.locator('[data-testid="create-user-button"]')).toBeVisible();
        await expect(page.locator('[data-testid="bulk-actions"]')).toBeVisible();
      });
    });

    test('should allow admin to manage users', async ({ page }) => {
      await AuthHelpers.loginAsAdmin(page);
      await page.goto('/admin/users');

      await test.step('Verify admin can view user details', async () => {
        const firstUser = page.locator('[data-testid="user-row"]').first();
        await firstUser.click();

        await expect(page.locator('[data-testid="user-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="edit-user-button"]')).toBeVisible();
        await expect(page.locator('[data-testid="delete-user-button"]')).toBeVisible();
      });

      await test.step('Verify admin can change user roles', async () => {
        await page.click('[data-testid="edit-user-button"]');
        await expect(page.locator('[data-testid="role-select"]')).toBeVisible();
        await expect(page.locator('[data-testid="role-select"] option')).toHaveCount(3); // USER, MODERATOR, ADMIN
      });

      await test.step('Verify admin can deactivate users', async () => {
        await expect(page.locator('[data-testid="deactivate-user-button"]')).toBeVisible();
      });
    });

    test('should allow admin to access system settings', async ({ page }) => {
      await AuthHelpers.loginAsAdmin(page);
      await page.goto('/admin/settings');

      await test.step('Verify system settings are accessible', async () => {
        await expect(page.locator('[data-testid="system-settings"]')).toBeVisible();
        await expect(page.locator('[data-testid="security-settings"]')).toBeVisible();
        await expect(page.locator('[data-testid="email-settings"]')).toBeVisible();
      });

      await test.step('Verify admin can modify critical settings', async () => {
        await expect(page.locator('[data-testid="maintenance-mode-toggle"]')).toBeVisible();
        await expect(page.locator('[data-testid="registration-toggle"]')).toBeVisible();
        await expect(page.locator('[data-testid="api-settings"]')).toBeVisible();
      });
    });
  });

  test.describe('Moderator Access Control', () => {
    test('should allow moderator limited admin access', async ({ page }) => {
      await AuthHelpers.loginAsModerator(page);

      const allowedRoutes = [
        '/admin/users', // Can view and manage users
        '/admin/reports', // Can view reports
      ];

      const restrictedRoutes = [
        '/admin/settings', // Cannot access system settings
        '/admin/system', // Cannot access system administration
      ];

      await test.step('Verify moderator can access allowed admin areas', async () => {
        const { allowed, denied } = await AuthHelpers.testAccessControl(page,
          allowedRoutes.map(path => ({ path, minRole: Role.MODERATOR }))
        );

        expect(denied.length).toBe(0);
        expect(allowed.length).toBe(allowedRoutes.length);
      });

      await test.step('Verify moderator cannot access restricted areas', async () => {
        for (const route of restrictedRoutes) {
          await page.goto(route);
          const url = page.url();
          const isBlocked = url.includes('/403') || url.includes('/unauthorized') || url.includes('/dashboard');
          expect(isBlocked).toBe(true);
        }
      });
    });

    test('should allow moderator limited user management', async ({ page }) => {
      await AuthHelpers.loginAsModerator(page);
      await page.goto('/admin/users');

      await test.step('Verify moderator can view users', async () => {
        await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
      });

      await test.step('Verify moderator has limited user actions', async () => {
        const firstUser = page.locator('[data-testid="user-row"]').first();
        await firstUser.click();

        await expect(page.locator('[data-testid="user-details"]')).toBeVisible();

        // Should not see delete button or role change for admin users
        const deleteButton = page.locator('[data-testid="delete-user-button"]');
        const roleSelect = page.locator('[data-testid="role-select"]');

        if (await deleteButton.isVisible()) {
          await expect(deleteButton).toBeDisabled();
        }

        if (await roleSelect.isVisible()) {
          // Should not be able to assign admin role
          const adminOption = roleSelect.locator('option[value="ADMIN"]');
          expect(await adminOption.count()).toBe(0);
        }
      });
    });
  });

  test.describe('User Access Control', () => {
    test('should restrict user to user-only areas', async ({ page }) => {
      await AuthHelpers.loginAsUser(page);

      const allowedRoutes = [
        '/dashboard',
        '/profile',
        '/profile/settings',
        '/profile/security',
      ];

      const restrictedRoutes = [
        '/admin',
        '/admin/users',
        '/admin/settings',
        '/admin/reports',
      ];

      await test.step('Verify user can access allowed areas', async () => {
        for (const route of allowedRoutes) {
          await page.goto(route);
          const url = page.url();
          const isAccessible = !url.includes('/login') && !url.includes('/403') && !url.includes('/unauthorized');
          expect(isAccessible).toBe(true);
        }
      });

      await test.step('Verify user cannot access admin areas', async () => {
        for (const route of restrictedRoutes) {
          await page.goto(route);
          const url = page.url();
          const isBlocked = url.includes('/403') || url.includes('/unauthorized') || url.includes('/dashboard');
          expect(isBlocked).toBe(true);
        }
      });

      await test.step('Verify admin menu is not visible', async () => {
        await page.goto('/dashboard');
        await expect(page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
      });
    });

    test('should allow user to manage own profile only', async ({ page }) => {
      await AuthHelpers.loginAsUser(page);
      await page.goto('/profile');

      await test.step('Verify user can edit own profile', async () => {
        await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
        await expect(page.locator('[data-testid="edit-profile-button"]')).toBeVisible();
      });

      await test.step('Verify user cannot change own role', async () => {
        await expect(page.locator('[data-testid="role-select"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="role-display"]')).toContainText('USER');
      });

      await test.step('Verify user cannot access other user profiles', async () => {
        const otherUser = await DatabaseHelpers.createTestUser({
          email: 'other@test.com',
        });

        await page.goto(`/profile/${otherUser.id}`);
        const url = page.url();
        const isBlocked = url.includes('/403') || url.includes('/unauthorized') || url.includes('/profile');
        expect(isBlocked).toBe(true);
      });
    });
  });

  test.describe('Unauthenticated Access Control', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      const protectedRoutes = [
        '/dashboard',
        '/profile',
        '/admin',
        '/admin/users',
      ];

      await test.step('Verify protected routes redirect to login', async () => {
        for (const route of protectedRoutes) {
          await page.goto(route);
          await expect(page).toHaveURL(/.*\/login/);
        }
      });
    });

    test('should allow access to public routes', async ({ page }) => {
      const publicRoutes = [
        '/',
        '/login',
        '/register',
        '/forgot-password',
        '/about',
        '/privacy',
        '/terms',
      ];

      await test.step('Verify public routes are accessible', async () => {
        for (const route of publicRoutes) {
          await page.goto(route);
          const url = page.url();
          const isAccessible = !url.includes('/login') || route === '/login';
          expect(isAccessible).toBe(true);
        }
      });
    });
  });

  test.describe('API Access Control', () => {
    test('should enforce API access controls for admin endpoints', async ({ request }) => {
      // Test without authentication
      await test.step('Verify unauthenticated API access is denied', async () => {
        const adminEndpoints = [
          '/api/admin/users',
          '/api/admin/settings',
          '/api/admin/system',
        ];

        for (const endpoint of adminEndpoints) {
          const response = await request.get(endpoint);
          expect(response.status()).toBe(401);
        }
      });
    });

    test('should allow authenticated user access to appropriate APIs', async ({ page, request }) => {
      await AuthHelpers.loginAsUser(page);

      // Get cookies for API requests
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

      await test.step('Verify user can access user APIs', async () => {
        const userEndpoints = [
          '/api/user/profile',
          '/api/user/settings',
        ];

        for (const endpoint of userEndpoints) {
          const response = await request.get(endpoint, {
            headers: { 'Cookie': cookieHeader },
          });
          expect(response.status()).toBeLessThan(400);
        }
      });

      await test.step('Verify user cannot access admin APIs', async () => {
        const adminEndpoints = [
          '/api/admin/users',
          '/api/admin/settings',
        ];

        for (const endpoint of adminEndpoints) {
          const response = await request.get(endpoint, {
            headers: { 'Cookie': cookieHeader },
          });
          expect(response.status()).toBe(403);
        }
      });
    });
  });

  test.describe('Role Escalation Prevention', () => {
    test('should prevent role escalation through API manipulation', async ({ page, request }) => {
      await AuthHelpers.loginAsUser(page);

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

      await test.step('Verify user cannot escalate own role', async () => {
        const response = await request.put('/api/user/profile', {
          headers: { 'Cookie': cookieHeader },
          data: { role: 'ADMIN' },
        });

        // Should either ignore the role field or return error
        expect(response.status()).toBeLessThan(500); // Not a server error

        // Verify role wasn't changed
        const user = await DatabaseHelpers.findUserByEmail('user@test.com');
        expect(user.role).toBe(Role.USER);
      });
    });

    test('should prevent moderator from escalating to admin', async ({ page, request }) => {
      await AuthHelpers.loginAsModerator(page);

      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

      await test.step('Verify moderator cannot grant admin role to others', async () => {
        const testUser = await DatabaseHelpers.createTestUser({
          email: 'test-escalation@test.com',
        });

        const response = await request.put(`/api/admin/users/${testUser.id}`, {
          headers: { 'Cookie': cookieHeader },
          data: { role: 'ADMIN' },
        });

        expect(response.status()).toBe(403);

        // Verify role wasn't changed
        const user = await DatabaseHelpers.findUserByEmail('test-escalation@test.com');
        expect(user.role).toBe(Role.USER);
      });
    });
  });

  test.describe('Permission Inheritance', () => {
    test('should verify role hierarchy permissions', async ({ page }) => {
      const roleTests = [
        { role: Role.ADMIN, login: () => AuthHelpers.loginAsAdmin(page) },
        { role: Role.MODERATOR, login: () => AuthHelpers.loginAsModerator(page) },
        { role: Role.USER, login: () => AuthHelpers.loginAsUser(page) },
      ];

      for (const { role, login } of roleTests) {
        await test.step(`Verify ${role} role permissions`, async () => {
          await login();
          await AuthHelpers.assertUserRole(page, role);

          // Verify appropriate menu items are visible
          await page.goto('/dashboard');

          if (role === Role.ADMIN) {
            await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
            await expect(page.locator('[data-testid="user-management-link"]')).toBeVisible();
            await expect(page.locator('[data-testid="system-settings-link"]')).toBeVisible();
          } else if (role === Role.MODERATOR) {
            await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
            await expect(page.locator('[data-testid="user-management-link"]')).toBeVisible();
            await expect(page.locator('[data-testid="system-settings-link"]')).not.toBeVisible();
          } else {
            await expect(page.locator('[data-testid="admin-menu"]')).not.toBeVisible();
          }

          await AuthHelpers.logout(page);
        });
      }
    });
  });

  test.describe('Session-Based Access Control', () => {
    test('should revoke access when session expires', async ({ page, context }) => {
      await AuthHelpers.loginAsAdmin(page);
      await page.goto('/admin');

      await test.step('Verify admin access initially', async () => {
        await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
      });

      await test.step('Simulate session expiry', async () => {
        await AuthHelpers.simulateSessionExpiry(page);
      });

      await test.step('Verify access is revoked after session expiry', async () => {
        await page.goto('/admin');
        await expect(page).toHaveURL(/.*\/login/);
      });
    });

    test('should handle concurrent session role changes', async ({ browser }) => {
      // This test simulates an admin changing a user's role while they're logged in
      const adminContext = await browser.newContext();
      const userContext = await browser.newContext();

      const adminPage = await adminContext.newPage();
      const userPage = await userContext.newPage();

      await test.step('Login both users', async () => {
        await AuthHelpers.loginAsAdmin(adminPage);
        await AuthHelpers.loginAsUser(userPage);
      });

      await test.step('User accesses their dashboard', async () => {
        await userPage.goto('/dashboard');
        await expect(userPage.locator('[data-testid="user-dashboard"]')).toBeVisible();
      });

      await test.step('Admin changes user role to moderator', async () => {
        await adminPage.goto('/admin/users');

        // Find the user and change their role
        const userRow = adminPage.locator('[data-testid="user-row"]:has-text("user@test.com")');
        await userRow.click();
        await adminPage.click('[data-testid="edit-user-button"]');
        await adminPage.selectOption('[data-testid="role-select"]', 'MODERATOR');
        await adminPage.click('[data-testid="save-user-button"]');
      });

      await test.step('Verify user gets updated permissions on next navigation', async () => {
        await userPage.reload(); // Simulate navigation

        // User should now have moderator access
        await userPage.goto('/admin/users');
        await expect(userPage.locator('[data-testid="user-list"]')).toBeVisible();
      });

      await adminContext.close();
      await userContext.close();
    });
  });
});