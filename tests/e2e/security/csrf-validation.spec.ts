import { test, expect } from '@playwright/test';

/**
 * CSRF Token Validation E2E Tests
 *
 * These tests verify the Double-Submit Cookie pattern implementation:
 * - CSRF cookie is set during authentication
 * - Protected routes require matching CSRF token in header
 * - Pre-auth routes are excluded from CSRF validation
 * - Safe HTTP methods (GET, HEAD, OPTIONS) don't require CSRF
 * - API key header bypasses CSRF validation
 */
test.describe('CSRF Token Validation', () => {
  const CSRF_HEADER_NAME = 'X-CSRF-Token';

  test.describe('Pre-auth Routes (Excluded from CSRF)', () => {
    test('login endpoint should not require CSRF token', async ({ request }) => {
      // Login endpoint is excluded from CSRF validation
      const response = await request.post('/api/auth/login', {
        data: {
          email: 'invalid@example.com',
          password: 'invalid',
        },
      });

      // Should get 401 (invalid credentials) or other error, not 403 (CSRF error)
      expect(response.status()).not.toBe(403);

      // Verify error is not CSRF-related
      const body = await response.json();
      expect(body.error).not.toBe('CSRF_ERROR');
    });

    test('register endpoint should not require CSRF token', async ({
      request,
    }) => {
      const response = await request.post('/api/auth/register', {
        data: {
          name: 'Test User',
          email: `test-csrf-${Date.now()}@example.com`,
          password: 'TestPassword123!',
        },
      });

      // Should not get 403 CSRF error
      expect(response.status()).not.toBe(403);

      // Verify error is not CSRF-related
      if (!response.ok()) {
        const body = await response.json();
        expect(body.error).not.toBe('CSRF_ERROR');
      }
    });

    test('forgot-password endpoint should not require CSRF token', async ({
      request,
    }) => {
      const response = await request.post('/api/auth/forgot-password', {
        data: {
          email: 'test@example.com',
        },
      });

      // Should not get 403 CSRF error
      expect(response.status()).not.toBe(403);
    });

    test('reset-password endpoint should not require CSRF token', async ({
      request,
    }) => {
      const response = await request.post('/api/auth/reset-password', {
        data: {
          token: 'invalid-token',
          password: 'NewPassword123!',
        },
      });

      // Should not get 403 CSRF error (will get different error for invalid token)
      expect(response.status()).not.toBe(403);
    });

    test('verify-email endpoint should not require CSRF token', async ({
      request,
    }) => {
      const response = await request.post('/api/auth/verify-email', {
        data: {
          token: 'invalid-token',
        },
      });

      expect(response.status()).not.toBe(403);
    });
  });

  test.describe('Protected Routes - CSRF Required', () => {
    test('POST to protected route without CSRF token returns 403', async ({
      request,
    }) => {
      // Attempt POST without CSRF header (and no cookie)
      const response = await request.post('/api/auth/logout');

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF_ERROR');
      expect(body.message).toContain('CSRF token');
    });

    test('POST with mismatched CSRF token returns 403', async ({ request }) => {
      // Send request with invalid CSRF token (no matching cookie)
      const response = await request.post('/api/auth/logout', {
        headers: {
          [CSRF_HEADER_NAME]: 'invalid-token-with-no-matching-cookie',
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF_ERROR');
    });

    test('DELETE request without CSRF token returns 403', async ({
      request,
    }) => {
      const response = await request.delete('/api/users/test-id/sessions', {
        params: { series: 'test-series' },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF_ERROR');
    });

    test('PATCH request without CSRF token returns 403', async ({
      request,
    }) => {
      const response = await request.patch('/api/users/test-id/profile', {
        data: { name: 'Test' },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF_ERROR');
    });

    test('PUT request without CSRF token returns 403', async ({ request }) => {
      const response = await request.put('/api/users/test-id/settings', {
        data: { theme: 'dark' },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF_ERROR');
    });
  });

  test.describe('Safe HTTP Methods - No CSRF Required', () => {
    test('GET requests do not require CSRF token', async ({ request }) => {
      const response = await request.get('/api/auth/session');

      // GET should not trigger CSRF validation
      // May get 401 (not authenticated) but not 403 (CSRF)
      expect(response.status()).not.toBe(403);

      if (!response.ok()) {
        const body = await response.json();
        expect(body.error).not.toBe('CSRF_ERROR');
      }
    });

    test('HEAD requests do not require CSRF token', async ({ request }) => {
      const response = await request.head('/api/auth/session');

      expect(response.status()).not.toBe(403);
    });

    test('OPTIONS requests do not require CSRF token', async ({ request }) => {
      const response = await request.fetch('/api/auth/session', {
        method: 'OPTIONS',
      });

      expect(response.status()).not.toBe(403);
    });
  });

  test.describe('API Key Bypass', () => {
    test('requests with X-API-Key header bypass CSRF validation', async ({
      request,
    }) => {
      // Request with API key header (even invalid) should bypass CSRF check
      // The API key validation happens in route handlers, not middleware
      const response = await request.post('/api/users/test-id/profile', {
        headers: {
          'X-API-Key': 'test-api-key',
        },
        data: { name: 'Test' },
      });

      // Should not get 403 CSRF error (may get different error like 401 or 404)
      expect(response.status()).not.toBe(403);

      if (!response.ok()) {
        const body = await response.json();
        expect(body.error).not.toBe('CSRF_ERROR');
      }
    });

    test('API key bypass works for DELETE requests', async ({ request }) => {
      const response = await request.delete('/api/users/test-id/sessions', {
        headers: {
          'X-API-Key': 'test-api-key',
        },
        params: { series: 'test-series' },
      });

      // Should not get 403 CSRF error
      expect(response.status()).not.toBe(403);
    });
  });

  test.describe('CSRF Error Response Format', () => {
    test('CSRF error returns proper JSON structure', async ({ request }) => {
      const response = await request.post('/api/auth/logout');

      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('error', 'CSRF_ERROR');
      expect(body).toHaveProperty('message');
      expect(typeof body.message).toBe('string');
    });

    test('CSRF error includes descriptive message', async ({ request }) => {
      const response = await request.post('/api/auth/logout');

      const body = await response.json();
      expect(body.message).toMatch(/CSRF token/i);
    });
  });
});
