import { describe, it, expect, vi } from 'vitest';
import {
  generateCsrfToken,
  validateCsrfToken,
  isRouteExcludedFromCsrf,
  requiresCsrfValidation,
  hasValidApiKeyHeader,
  CSRF_CONFIG,
  CSRF_PROTECTED_METHODS,
  CSRF_EXCLUDED_ROUTES,
} from '@/lib/csrf';
import { NextRequest } from 'next/server';

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

describe('validateCsrfToken', () => {
  it('should return true for matching tokens', () => {
    const token = 'a'.repeat(64);
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it('should return false for non-matching tokens', () => {
    const token1 = 'a'.repeat(64);
    const token2 = 'b'.repeat(64);
    expect(validateCsrfToken(token1, token2)).toBe(false);
  });

  it('should return false when cookie token is undefined', () => {
    expect(validateCsrfToken(undefined, 'some-token')).toBe(false);
  });

  it('should return false when header token is undefined', () => {
    expect(validateCsrfToken('some-token', undefined)).toBe(false);
  });

  it('should return false when both tokens are undefined', () => {
    expect(validateCsrfToken(undefined, undefined)).toBe(false);
  });

  it('should return false for tokens with different lengths', () => {
    expect(validateCsrfToken('short', 'much-longer-token')).toBe(false);
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
