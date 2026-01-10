import { Page, BrowserContext, expect } from '@playwright/test';
import { DatabaseHelpers } from './database-helpers';
import { ORG_TEST_USERS } from './org-test-constants';
import { TEST_USERS } from '../fixtures/test-users';
import { ROLE_NAMES as Role } from '@/lib/constants/roles';

export interface AuthenticatedState {
  user: any;
  context: BrowserContext;
  cookies: any;
}

export class AuthHelpers {
  /**
   * Authenticate as a specific user and return browser context with auth state
   */
  static async authenticateUser(
    page: Page,
    email: string,
    password: string
  ): Promise<void> {
    try {
      await page.goto('/login');
      await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });

      await page.fill('[data-testid="email-input"]', email);
      await page.fill('[data-testid="password-input"]', password);
      await page.click('[data-testid="login-submit"]');

      // Wait for successful login
      await page.waitForURL(/\/(dashboard|admin|profile)/, { timeout: 15000 });

      console.log(`✅ Successfully authenticated as ${email}`);
    } catch (error) {
      console.error(`❌ Failed to authenticate as ${email}:`, error);
      throw error;
    }
  }

  /**
   * Quick login as admin user
   */
  static async loginAsAdmin(page: Page): Promise<void> {
    const { email, password } = TEST_USERS.admin;
    await this.authenticateUser(page, email, password);
    await expect(page).toHaveURL(/.*\/admin/);
  }

  /**
   * Quick login as regular user
   */
  static async loginAsUser(page: Page): Promise<void> {
    const { email, password } = TEST_USERS.user;
    await this.authenticateUser(page, email, password);
    await expect(page).toHaveURL(/.*\/dashboard/);
  }

  /**
   * Quick login as moderator
   */
  static async loginAsModerator(page: Page): Promise<void> {
    const { email, password } = TEST_USERS.moderator;
    await this.authenticateUser(page, email, password);
    await expect(page).toHaveURL(/.*\/(dashboard|admin)/);
  }

  /**
   * Login as organization owner
   */
  static async loginAsOrgOwner(page: Page): Promise<void> {
    const { email, password } = ORG_TEST_USERS.owner;
    await this.authenticateUser(page, email, password);
    await expect(page).toHaveURL(/.*\/(dashboard|admin)/);
  }

  /**
   * Login as organization admin
   */
  static async loginAsOrgAdmin(page: Page): Promise<void> {
    const { email, password } = ORG_TEST_USERS.admin;
    await this.authenticateUser(page, email, password);
    await expect(page).toHaveURL(/.*\/(dashboard|admin)/);
  }

  /**
   * Login as organization member
   */
  static async loginAsOrgMember(page: Page): Promise<void> {
    const { email, password } = ORG_TEST_USERS.member;
    await this.authenticateUser(page, email, password);
    await expect(page).toHaveURL(/.*\/(dashboard|admin)/);
  }

  /**
   * Login as non-member (user not in any org)
   */
  static async loginAsNonMember(page: Page): Promise<void> {
    const { email, password } = ORG_TEST_USERS.nonMember;
    await this.authenticateUser(page, email, password);
    await expect(page).toHaveURL(/.*\/(dashboard|admin)/);
  }

  /**
   * Logout current user
   */
  static async logout(page: Page): Promise<void> {
    try {
      // Try to find and click logout button in various locations
      const logoutSelectors = [
        '[data-testid="logout-button"]',
        '[data-testid="user-menu-logout"]',
        'button[aria-label="Logout"]',
        'a[href="/logout"]',
        'button:has-text("Logout")',
        'button:has-text("Sign Out")',
      ];

      let logoutSuccessful = false;

      for (const selector of logoutSelectors) {
        try {
          const element = page.locator(selector);
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            logoutSuccessful = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!logoutSuccessful) {
        // Call logout API via page.evaluate (POST request)
        await page.evaluate(async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
        });
        // Navigate to login page after API logout
        await page.goto('/login');
      }

      // Wait for redirect to login page
      await page.waitForURL('**/login', { timeout: 10000 });
      console.log('✅ Successfully logged out');
    } catch (error) {
      console.error('❌ Failed to logout:', error);
      throw error;
    }
  }

  /**
   * Create a new user and authenticate
   */
  static async createAndLoginUser(
    page: Page,
    userData: {
      email?: string;
      password?: string;
      role?: Role;
      username?: string;
      firstName?: string;
      lastName?: string;
    } = {}
  ): Promise<any> {
    const user = await DatabaseHelpers.createTestUser(userData);
    await this.authenticateUser(page, user.email, user.plainPassword);
    return user;
  }

  /**
   * Check if user is authenticated by checking for authenticated elements
   */
  static async isAuthenticated(page: Page): Promise<boolean> {
    try {
      // Look for elements that only appear when authenticated
      const authenticatedSelectors = [
        '[data-testid="user-menu"]',
        '[data-testid="logout-button"]',
        '[data-testid="user-profile"]',
        '.user-avatar',
      ];

      for (const selector of authenticatedSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 })) {
          return true;
        }
      }

      // Check URL patterns that indicate authentication
      const url = page.url();
      return !(url.includes('/login') || url.includes('/register'));
    } catch {
      return false;
    }
  }

  /**
   * Assert user has specific role by checking UI elements or redirects
   */
  static async assertUserRole(page: Page, expectedRole: Role): Promise<void> {
    switch (expectedRole) {
      case Role.ADMIN:
        await expect(page).toHaveURL(/.*\/admin/);
        await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible({ timeout: 10000 });
        break;
      case Role.MODERATOR:
        // Moderators can access admin area but with limited features
        await expect(page.locator('[data-testid="moderator-badge"], [data-testid="admin-menu"]')).toBeVisible({ timeout: 10000 });
        break;
      case Role.USER:
        await expect(page).toHaveURL(/.*\/dashboard/);
        await expect(page.locator('[data-testid="user-dashboard"]')).toBeVisible({ timeout: 10000 });
        break;
      default:
        throw new Error(`Unknown role: ${expectedRole}`);
    }
  }

  /**
   * Test access control by attempting to access protected routes
   */
  static async testAccessControl(
    page: Page,
    protectedRoutes: { path: string; minRole: Role }[]
  ): Promise<{ allowed: string[]; denied: string[] }> {
    const allowed: string[] = [];
    const denied: string[] = [];

    for (const route of protectedRoutes) {
      try {
        await page.goto(route.path);
        await page.waitForLoadState('networkidle', { timeout: 5000 });

        const currentUrl = page.url();

        if (currentUrl.includes('/login') || currentUrl.includes('/403') || currentUrl.includes('/unauthorized')) {
          denied.push(route.path);
        } else {
          allowed.push(route.path);
        }
      } catch (error) {
        denied.push(route.path);
      }
    }

    return { allowed, denied };
  }

  /**
   * Simulate session expiry
   */
  static async simulateSessionExpiry(page: Page): Promise<void> {
    // Clear session cookies
    await page.context().clearCookies();

    // Or alternatively, set cookies to expired values
    await page.context().addCookies([
      {
        name: 'soclestack-session',
        value: 'expired',
        domain: 'localhost',
        path: '/',
        expires: Date.now() - 86400, // Yesterday
      },
    ]);

    // Navigate to a protected page to trigger session check
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });
  }

  /**
   * Test authentication with various invalid credentials
   */
  static async testInvalidAuthentication(page: Page): Promise<{
    results: Array<{ credentials: any; success: boolean; error?: string }>;
  }> {
    const testCases = [
      { email: '', password: '', description: 'empty credentials' },
      { email: 'invalid@test.com', password: 'ValidPassword123!', description: 'invalid email' },
      { email: TEST_USERS.user.email, password: 'wrongpassword', description: 'wrong password' },
      { email: TEST_USERS.unverified.email, password: TEST_USERS.unverified.password, description: 'unverified account' },
      { email: TEST_USERS.inactive.email, password: TEST_USERS.inactive.password, description: 'inactive account' },
      { email: 'invalid-email', password: 'ValidPassword123!', description: 'malformed email' },
    ];

    const results = [];

    for (const testCase of testCases) {
      try {
        await page.goto('/login');
        await page.waitForSelector('[data-testid="login-form"]');

        if (testCase.email) await page.fill('[data-testid="email-input"]', testCase.email);
        if (testCase.password) await page.fill('[data-testid="password-input"]', testCase.password);

        await page.click('[data-testid="login-submit"]');

        // Wait a moment for response
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        const success = !currentUrl.includes('/login');

        let error;
        if (!success) {
          try {
            const errorElement = page.locator('[data-testid="error-message"]');
            error = await errorElement.textContent({ timeout: 2000 });
          } catch {
            // No error message found
          }
        }

        results.push({
          credentials: { email: testCase.email, description: testCase.description },
          success,
          error,
        });

        console.log(`${success ? '✅' : '❌'} ${testCase.description}: ${success ? 'succeeded' : 'failed'}`);
      } catch (error) {
        results.push({
          credentials: { email: testCase.email, description: testCase.description },
          success: false,
          error: error.message,
        });
      }
    }

    return { results };
  }

  /**
   * Test remember me functionality
   */
  static async testRememberMe(page: Page, context: BrowserContext): Promise<void> {
    // Login with remember me
    await page.goto('/login');
    await page.waitForSelector('[data-testid="login-form"]');

    await page.fill('[data-testid="email-input"]', TEST_USERS.user.email);
    await page.fill('[data-testid="password-input"]', TEST_USERS.user.password);
    await page.check('[data-testid="remember-me-checkbox"]');
    await page.click('[data-testid="login-submit"]');

    await page.waitForURL('**/dashboard');

    // Check that persistent session cookie is set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'soclestack-session');

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000 + 86400); // More than 1 day

    // Close and reopen browser to test persistence
    await page.close();
    const newPage = await context.newPage();

    await newPage.goto('/dashboard');

    // Should still be logged in
    await expect(newPage).not.toHaveURL('**/login');
    await expect(newPage.locator('[data-testid="user-menu"]')).toBeVisible();

    await newPage.close();
  }

  /**
   * Get current user information from the page
   */
  static async getCurrentUser(page: Page): Promise<{
    email?: string;
    username?: string;
    role?: string;
    isAuthenticated: boolean;
  }> {
    try {
      const isAuth = await this.isAuthenticated(page);

      if (!isAuth) {
        return { isAuthenticated: false };
      }

      // Try to extract user info from various sources
      let email: string | undefined;
      let username: string | undefined;
      let role: string | undefined;

      try {
        email = await page.locator('[data-testid="user-email"]').textContent({ timeout: 2000 }) || undefined;
      } catch {}

      try {
        username = await page.locator('[data-testid="user-username"]').textContent({ timeout: 2000 }) || undefined;
      } catch {}

      try {
        role = await page.locator('[data-testid="user-role"]').textContent({ timeout: 2000 }) || undefined;
      } catch {}

      return {
        email,
        username,
        role,
        isAuthenticated: true,
      };
    } catch {
      return { isAuthenticated: false };
    }
  }
}