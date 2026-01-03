/**
 * CSRF (Cross-Site Request Forgery) protection utilities.
 * Implements the Double-Submit Cookie pattern.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timeSafeEqual } from './security';

// CSRF Configuration
export const CSRF_CONFIG = {
  cookieName: 'csrf_token',
  headerName: 'X-CSRF-Token',
  tokenLength: 32, // bytes, will be 64 chars when hex-encoded
  cookieOptions: {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days (matches session)
  },
} as const;

// Methods that require CSRF validation
export const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Routes excluded from CSRF validation (pre-auth or token-based)
export const CSRF_EXCLUDED_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/verify-unlock',
  '/api/auth/request-unlock',
  '/api/auth/resend-verification',
  '/api/auth/oauth/',
  '/api/invites/',
];

/**
 * Generate a cryptographically secure CSRF token.
 * @returns 64-character hex string
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(CSRF_CONFIG.tokenLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate that two CSRF tokens match using timing-safe comparison.
 * @param cookieToken - Token from cookie
 * @param headerToken - Token from request header
 * @returns true if tokens match
 */
export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  return timeSafeEqual(cookieToken, headerToken);
}

/**
 * Get CSRF token from request cookie.
 */
export function getCsrfTokenFromCookie(request: NextRequest): string | undefined {
  return request.cookies.get(CSRF_CONFIG.cookieName)?.value;
}

/**
 * Get CSRF token from request header.
 */
export function getCsrfTokenFromHeader(request: NextRequest): string | undefined {
  return request.headers.get(CSRF_CONFIG.headerName) || undefined;
}

/**
 * Check if a route is excluded from CSRF validation.
 */
export function isRouteExcludedFromCsrf(pathname: string): boolean {
  return CSRF_EXCLUDED_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if request method requires CSRF validation.
 */
export function requiresCsrfValidation(method: string): boolean {
  return CSRF_PROTECTED_METHODS.includes(method.toUpperCase());
}

/**
 * Check if request has a valid API key (bypasses CSRF).
 */
export function hasValidApiKeyHeader(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  // Just check if header exists - actual validation happens in route handlers
  return !!apiKey;
}

/**
 * Validate CSRF token for a request.
 * Returns null if valid, or an error response if invalid.
 */
export function validateCsrfRequest(
  request: NextRequest
): { valid: true } | { valid: false; error: string } {
  const cookieToken = getCsrfTokenFromCookie(request);
  const headerToken = getCsrfTokenFromHeader(request);

  if (!cookieToken || !headerToken) {
    return {
      valid: false,
      error: 'CSRF token missing',
    };
  }

  if (!validateCsrfToken(cookieToken, headerToken)) {
    return {
      valid: false,
      error: 'Invalid CSRF token',
    };
  }

  return { valid: true };
}

/**
 * Create a CSRF error response.
 */
export function createCsrfErrorResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      error: 'CSRF_ERROR',
      message,
    },
    { status: 403 }
  );
}

/**
 * Set CSRF cookie on a response.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_CONFIG.cookieName, token, CSRF_CONFIG.cookieOptions);
}

/**
 * Clear CSRF cookie on a response.
 */
export function clearCsrfCookie(response: NextResponse): void {
  response.cookies.delete(CSRF_CONFIG.cookieName);
}
