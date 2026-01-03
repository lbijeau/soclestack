import { test, expect } from '@playwright/test';

/**
 * CSRF Authenticated Flow E2E Tests
 *
 * These tests verify the complete CSRF protection flow with authenticated users:
 * - CSRF cookie is set during login
 * - Protected requests succeed with valid CSRF token
 * - CSRF cookie persists across navigations
 * - CSRF cookie is cleared on logout
 */
test.describe('CSRF Authenticated Flow', () => {
  const CSRF_COOKIE_NAME = 'csrf_token';
  const CSRF_HEADER_NAME = 'X-CSRF-Token';

  // Test user credentials (should exist in test database)
  const TEST_USER = {
    email: 'admin@example.com',
    password: 'admin123',
  };

  test.describe('Login sets CSRF cookie', () => {
    test('CSRF cookie is set after successful login', async ({ page }) => {
      // Navigate to login page
      await page.goto('/login');

      // Fill in credentials
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);

      // Submit login form
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });

      // Check that CSRF cookie is set
      const cookies = await page.context().cookies();
      const csrfCookie = cookies.find((c) => c.name === CSRF_COOKIE_NAME);

      expect(csrfCookie).toBeDefined();
      expect(csrfCookie?.value).toHaveLength(64); // 32 bytes hex = 64 chars
      expect(csrfCookie?.httpOnly).toBe(false); // Must be readable by JS
      expect(csrfCookie?.sameSite).toBe('Strict');
    });
  });

  test.describe('Protected requests with valid CSRF token', () => {
    test('profile update succeeds with valid CSRF token', async ({
      page,
      request,
    }) => {
      // Login first
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard', { timeout: 10000 });

      // Get CSRF token from cookie
      const cookies = await page.context().cookies();
      const csrfCookie = cookies.find((c) => c.name === CSRF_COOKIE_NAME);
      expect(csrfCookie).toBeDefined();

      // Get all cookies for the request
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Make a protected request with CSRF token
      const response = await request.patch('/api/users/profile', {
        headers: {
          [CSRF_HEADER_NAME]: csrfCookie!.value,
          Cookie: cookieHeader,
        },
        data: {
          firstName: 'Test',
          lastName: 'User',
        },
      });

      // Should not get 403 CSRF error
      expect(response.status()).not.toBe(403);

      // If we get an error, it should not be CSRF-related
      if (!response.ok()) {
        const body = await response.json();
        expect(body.error).not.toBe('CSRF_ERROR');
      }
    });
  });

  test.describe('CSRF cookie persistence', () => {
    test('CSRF cookie persists across page navigations', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard', { timeout: 10000 });

      // Get initial CSRF cookie
      let cookies = await page.context().cookies();
      const initialCsrfCookie = cookies.find((c) => c.name === CSRF_COOKIE_NAME);
      expect(initialCsrfCookie).toBeDefined();

      // Navigate to profile page
      await page.goto('/profile');
      await page.waitForLoadState('networkidle');

      // Check cookie still exists
      cookies = await page.context().cookies();
      const afterNavigateCookie = cookies.find(
        (c) => c.name === CSRF_COOKIE_NAME
      );
      expect(afterNavigateCookie).toBeDefined();
      expect(afterNavigateCookie?.value).toBe(initialCsrfCookie?.value);

      // Navigate to another page
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');

      // Cookie should still be the same
      cookies = await page.context().cookies();
      const finalCsrfCookie = cookies.find((c) => c.name === CSRF_COOKIE_NAME);
      expect(finalCsrfCookie).toBeDefined();
      expect(finalCsrfCookie?.value).toBe(initialCsrfCookie?.value);
    });
  });

  test.describe('Logout clears CSRF cookie', () => {
    test('CSRF cookie is cleared after logout', async ({ page, request }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/dashboard', { timeout: 10000 });

      // Verify CSRF cookie exists
      let cookies = await page.context().cookies();
      const csrfCookie = cookies.find((c) => c.name === CSRF_COOKIE_NAME);
      expect(csrfCookie).toBeDefined();

      // Get all cookies for logout request
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

      // Logout via API (need CSRF token for logout)
      await request.post('/api/auth/logout', {
        headers: {
          [CSRF_HEADER_NAME]: csrfCookie!.value,
          Cookie: cookieHeader,
        },
      });

      // Navigate to trigger cookie check
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      // CSRF cookie should be cleared
      cookies = await page.context().cookies();
      const clearedCsrfCookie = cookies.find((c) => c.name === CSRF_COOKIE_NAME);

      // Cookie should either not exist or be empty/expired
      if (clearedCsrfCookie) {
        // If cookie exists, it might be set to empty or have past expiry
        // The important thing is it's not the same valid token
        expect(clearedCsrfCookie.value).not.toBe(csrfCookie?.value);
      }
    });
  });

  test.describe('CSRF Rate Limiting', () => {
    test('returns 429 after too many CSRF failures', async ({ request }) => {
      // Make many requests without CSRF token to trigger rate limit
      // Note: Default limit is 10 failures per 5 minutes
      const responses: number[] = [];

      for (let i = 0; i < 15; i++) {
        const response = await request.post('/api/auth/logout');
        responses.push(response.status());
      }

      // First few should be 403 (CSRF error)
      expect(responses.slice(0, 5).every((s) => s === 403)).toBe(true);

      // Eventually should get 429 (rate limited)
      expect(responses.includes(429)).toBe(true);
    });
  });
});
