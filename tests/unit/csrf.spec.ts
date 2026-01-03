import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCsrfToken,
  validateCsrfToken,
  isValidTokenFormat,
  isRouteExcludedFromCsrf,
  requiresCsrfValidation,
  hasValidApiKeyHeader,
  rotateCsrfToken,
  recordCsrfFailure,
  isCsrfRateLimited,
  cleanupCsrfRateLimitStore,
  createCsrfRateLimitResponse,
  _resetRateLimitState,
  CSRF_CONFIG,
  CSRF_PROTECTED_METHODS,
  CSRF_EXCLUDED_ROUTES,
} from '@/lib/csrf';
import { NextRequest, NextResponse } from 'next/server';

// Mock timeSafeEqual to avoid crypto issues in test environment
vi.mock('@/lib/security', () => ({
  timeSafeEqual: (a: string, b: string) => a === b,
}));

describe('CSRF Configuration', () => {
  it('should have correct cookie configuration', () => {
    expect(CSRF_CONFIG.cookieName).toBe('csrf_token');
    expect(CSRF_CONFIG.headerName).toBe('X-CSRF-Token');
    expect(CSRF_CONFIG.tokenLength).toBe(32);
    expect(CSRF_CONFIG.cookieOptions.httpOnly).toBe(false);
    expect(CSRF_CONFIG.cookieOptions.sameSite).toBe('strict');
    expect(CSRF_CONFIG.cookieOptions.path).toBe('/');
  });

  it('should protect state-changing HTTP methods', () => {
    expect(CSRF_PROTECTED_METHODS).toContain('POST');
    expect(CSRF_PROTECTED_METHODS).toContain('PUT');
    expect(CSRF_PROTECTED_METHODS).toContain('DELETE');
    expect(CSRF_PROTECTED_METHODS).toContain('PATCH');
    expect(CSRF_PROTECTED_METHODS).not.toContain('GET');
    expect(CSRF_PROTECTED_METHODS).not.toContain('HEAD');
    expect(CSRF_PROTECTED_METHODS).not.toContain('OPTIONS');
  });

  it('should exclude authentication routes from CSRF', () => {
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/login');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/register');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/forgot-password');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/reset-password');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/verify-email');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/verify-unlock');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/request-unlock');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/auth/oauth/');
    expect(CSRF_EXCLUDED_ROUTES).toContain('/api/invites/');
  });
});

describe('generateCsrfToken', () => {
  it('should generate a 64-character hex string', () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate unique tokens each time', () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    const token3 = generateCsrfToken();

    expect(token1).not.toBe(token2);
    expect(token2).not.toBe(token3);
    expect(token1).not.toBe(token3);
  });
});

describe('isValidTokenFormat', () => {
  it('should return true for valid 64-char hex string', () => {
    const validToken = 'a'.repeat(64);
    expect(isValidTokenFormat(validToken)).toBe(true);
  });

  it('should return true for generated tokens', () => {
    const token = generateCsrfToken();
    expect(isValidTokenFormat(token)).toBe(true);
  });

  it('should return false for tokens that are too short', () => {
    expect(isValidTokenFormat('a'.repeat(63))).toBe(false);
  });

  it('should return false for tokens that are too long', () => {
    expect(isValidTokenFormat('a'.repeat(65))).toBe(false);
  });

  it('should return false for tokens with uppercase characters', () => {
    expect(isValidTokenFormat('A'.repeat(64))).toBe(false);
  });

  it('should return false for tokens with non-hex characters', () => {
    expect(isValidTokenFormat('g'.repeat(64))).toBe(false);
    expect(isValidTokenFormat('z'.repeat(64))).toBe(false);
  });

  it('should return false for tokens with special characters', () => {
    expect(isValidTokenFormat('a'.repeat(32) + '-'.repeat(32))).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidTokenFormat('')).toBe(false);
  });
});

describe('validateCsrfToken', () => {
  it('should return true for matching valid tokens', () => {
    const token = 'a'.repeat(64);
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it('should return false for non-matching tokens', () => {
    const token1 = 'a'.repeat(64);
    const token2 = 'b'.repeat(64);
    expect(validateCsrfToken(token1, token2)).toBe(false);
  });

  it('should return false when cookie token is undefined', () => {
    expect(validateCsrfToken(undefined, 'a'.repeat(64))).toBe(false);
  });

  it('should return false when header token is undefined', () => {
    expect(validateCsrfToken('a'.repeat(64), undefined)).toBe(false);
  });

  it('should return false when both tokens are undefined', () => {
    expect(validateCsrfToken(undefined, undefined)).toBe(false);
  });

  it('should return false for tokens with invalid format', () => {
    // Even if tokens match, invalid format should fail
    expect(validateCsrfToken('short', 'short')).toBe(false);
    expect(validateCsrfToken('UPPER'.repeat(13), 'UPPER'.repeat(13))).toBe(
      false
    );
  });

  it('should return false for tokens with different lengths', () => {
    expect(validateCsrfToken('a'.repeat(64), 'a'.repeat(32))).toBe(false);
  });
});

describe('isRouteExcludedFromCsrf', () => {
  it('should return true for excluded routes', () => {
    expect(isRouteExcludedFromCsrf('/api/auth/login')).toBe(true);
    expect(isRouteExcludedFromCsrf('/api/auth/register')).toBe(true);
    expect(isRouteExcludedFromCsrf('/api/auth/forgot-password')).toBe(true);
  });

  it('should return true for OAuth routes (prefix match)', () => {
    expect(isRouteExcludedFromCsrf('/api/auth/oauth/google')).toBe(true);
    expect(isRouteExcludedFromCsrf('/api/auth/oauth/github')).toBe(true);
    expect(isRouteExcludedFromCsrf('/api/auth/oauth/google/callback')).toBe(
      true
    );
  });

  it('should return true for invite routes (prefix match)', () => {
    expect(isRouteExcludedFromCsrf('/api/invites/some-token')).toBe(true);
    expect(isRouteExcludedFromCsrf('/api/invites/abc123/accept')).toBe(true);
  });

  it('should return false for protected routes', () => {
    expect(isRouteExcludedFromCsrf('/api/users/profile')).toBe(false);
    expect(isRouteExcludedFromCsrf('/api/auth/logout')).toBe(false);
    expect(isRouteExcludedFromCsrf('/api/auth/2fa/setup')).toBe(false);
    expect(isRouteExcludedFromCsrf('/api/keys')).toBe(false);
  });
});

describe('requiresCsrfValidation', () => {
  it('should return true for state-changing methods', () => {
    expect(requiresCsrfValidation('POST')).toBe(true);
    expect(requiresCsrfValidation('PUT')).toBe(true);
    expect(requiresCsrfValidation('DELETE')).toBe(true);
    expect(requiresCsrfValidation('PATCH')).toBe(true);
  });

  it('should return true regardless of case', () => {
    expect(requiresCsrfValidation('post')).toBe(true);
    expect(requiresCsrfValidation('Post')).toBe(true);
    expect(requiresCsrfValidation('delete')).toBe(true);
  });

  it('should return false for safe methods', () => {
    expect(requiresCsrfValidation('GET')).toBe(false);
    expect(requiresCsrfValidation('HEAD')).toBe(false);
    expect(requiresCsrfValidation('OPTIONS')).toBe(false);
  });
});

describe('hasValidApiKeyHeader', () => {
  it('should return true when X-API-Key header is present', () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'X-API-Key': 'some-api-key',
      },
    });
    expect(hasValidApiKeyHeader(request)).toBe(true);
  });

  it('should return false when X-API-Key header is missing', () => {
    const request = new NextRequest('http://localhost/api/test');
    expect(hasValidApiKeyHeader(request)).toBe(false);
  });

  it('should return false for empty X-API-Key header', () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'X-API-Key': '',
      },
    });
    expect(hasValidApiKeyHeader(request)).toBe(false);
  });
});

describe('rotateCsrfToken', () => {
  it('should set a new CSRF token cookie on the response', () => {
    const response = NextResponse.json({ success: true });
    const newToken = rotateCsrfToken(response);

    // Should return a valid token
    expect(isValidTokenFormat(newToken)).toBe(true);

    // Should set the cookie
    const cookie = response.cookies.get(CSRF_CONFIG.cookieName);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe(newToken);
  });

  it('should generate unique tokens on each call', () => {
    const response1 = NextResponse.json({ a: 1 });
    const response2 = NextResponse.json({ b: 2 });

    const token1 = rotateCsrfToken(response1);
    const token2 = rotateCsrfToken(response2);

    expect(token1).not.toBe(token2);
  });

  it('should overwrite existing CSRF cookie', () => {
    const response = NextResponse.json({ success: true });

    // Set initial token
    response.cookies.set(CSRF_CONFIG.cookieName, 'old-token');

    // Rotate
    const newToken = rotateCsrfToken(response);

    // Cookie should have new token
    const cookie = response.cookies.get(CSRF_CONFIG.cookieName);
    expect(cookie?.value).toBe(newToken);
    expect(cookie?.value).not.toBe('old-token');
  });
});

describe('CSRF Rate Limiting', () => {
  beforeEach(() => {
    // Reset rate limit state before each test
    _resetRateLimitState();
  });

  it('should not rate limit on first failure', () => {
    const ip = '192.168.1.1';
    const isLimited = recordCsrfFailure(ip);
    expect(isLimited).toBe(false);
    expect(isCsrfRateLimited(ip)).toBe(false);
  });

  it('should not rate limit within threshold', () => {
    const ip = '192.168.1.2';

    // Record 9 failures (under default limit of 10)
    for (let i = 0; i < 9; i++) {
      const isLimited = recordCsrfFailure(ip);
      expect(isLimited).toBe(false);
    }

    expect(isCsrfRateLimited(ip)).toBe(false);
  });

  it('should rate limit after exceeding threshold', () => {
    const ip = '192.168.1.3';

    // Record 10 failures (at limit)
    for (let i = 0; i < 10; i++) {
      recordCsrfFailure(ip);
    }

    // 11th failure should trigger rate limit
    const isLimited = recordCsrfFailure(ip);
    expect(isLimited).toBe(true);
    expect(isCsrfRateLimited(ip)).toBe(true);
  });

  it('should track different IPs independently', () => {
    const ip1 = '10.0.0.1';
    const ip2 = '10.0.0.2';

    // Rate limit ip1
    for (let i = 0; i < 11; i++) {
      recordCsrfFailure(ip1);
    }

    // ip1 should be rate limited, ip2 should not
    expect(isCsrfRateLimited(ip1)).toBe(true);
    expect(isCsrfRateLimited(ip2)).toBe(false);
  });

  it('should return false for unknown IP', () => {
    expect(isCsrfRateLimited('unknown-ip')).toBe(false);
  });

  it('cleanupCsrfRateLimitStore should not throw', () => {
    // Add some entries
    recordCsrfFailure('1.1.1.1');
    recordCsrfFailure('2.2.2.2');

    // Cleanup should not throw
    expect(() => cleanupCsrfRateLimitStore()).not.toThrow();
  });

  it('should reset rate limit after window expires', () => {
    const ip = '192.168.1.50';

    // Mock Date.now to control time
    const originalNow = Date.now;
    let mockTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

    // Rate limit the IP
    for (let i = 0; i < 11; i++) {
      recordCsrfFailure(ip);
    }
    expect(isCsrfRateLimited(ip)).toBe(true);

    // Advance time past the window (5 minutes = 300000ms)
    mockTime += 300001;

    // Should no longer be rate limited
    expect(isCsrfRateLimited(ip)).toBe(false);

    // New failure should start fresh window
    const isLimited = recordCsrfFailure(ip);
    expect(isLimited).toBe(false);

    // Restore Date.now
    Date.now = originalNow;
  });

  it('createCsrfRateLimitResponse should include Retry-After header', () => {
    const response = createCsrfRateLimitResponse();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('300'); // 5 minutes
  });
});
