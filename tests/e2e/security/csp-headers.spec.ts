import { test, expect } from '@playwright/test';

test.describe('Content Security Policy Headers', () => {
  test('should include CSP header with nonce on all pages', async ({
    request,
  }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test('should include nonce in script-src directive', async ({ request }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];

    // Verify nonce is present in script-src
    // Nonce format: base64-encoded UUID
    const noncePattern = /script-src\s+'self'\s+'nonce-[A-Za-z0-9+/=]+'/;
    expect(csp).toMatch(noncePattern);
  });

  test('should NOT include unsafe-inline in script-src', async ({ request }) => {
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];

    // Extract script-src directive
    const scriptSrcMatch = csp?.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).toBeTruthy();

    const scriptSrc = scriptSrcMatch![1];
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  test('production build should NOT include unsafe-eval in script-src', async ({
    request,
  }) => {
    // This test runs against production build (webServer runs npm build && npm start)
    const response = await request.get('/');
    const csp = response.headers()['content-security-policy'];

    // Extract script-src directive
    const scriptSrcMatch = csp?.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).toBeTruthy();

    const scriptSrc = scriptSrcMatch![1];
    // In production, unsafe-eval should NOT be present
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  test('should generate unique nonces per request', async ({ request }) => {
    // Make two requests and verify nonces are different
    const response1 = await request.get('/');
    const response2 = await request.get('/');

    const csp1 = response1.headers()['content-security-policy'];
    const csp2 = response2.headers()['content-security-policy'];

    // Extract nonces
    const nonceMatch1 = csp1?.match(/nonce-([A-Za-z0-9+/=]+)/);
    const nonceMatch2 = csp2?.match(/nonce-([A-Za-z0-9+/=]+)/);

    expect(nonceMatch1).toBeTruthy();
    expect(nonceMatch2).toBeTruthy();

    // Nonces should be different for each request
    expect(nonceMatch1![1]).not.toEqual(nonceMatch2![1]);
  });

  test('should include x-nonce header for downstream components', async ({
    request,
  }) => {
    const response = await request.get('/');
    const xNonce = response.headers()['x-nonce'];

    // x-nonce header should be present
    expect(xNonce).toBeDefined();

    // Should be a valid base64-encoded string
    expect(xNonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  test('should include all required security headers', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    // Required security headers
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('origin-when-cross-origin');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
  });

  test('CSP should be consistent across protected routes', async ({
    request,
  }) => {
    const routes = ['/', '/login', '/register'];

    for (const route of routes) {
      const response = await request.get(route);
      const csp = response.headers()['content-security-policy'];

      expect(csp).toBeDefined();
      expect(csp).toMatch(/script-src\s+'self'\s+'nonce-[A-Za-z0-9+/=]+'/);
      expect(csp).toContain("default-src 'self'");
    }
  });
});
