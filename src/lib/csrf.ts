/**
 * CSRF (Cross-Site Request Forgery) protection utilities.
 * Implements the Double-Submit Cookie pattern.
 *
 * Security Notes:
 * - Tokens are 32 bytes (256-bit entropy) hex-encoded to 64 characters
 * - Uses timing-safe comparison to prevent timing attacks
 * - Cookie uses SameSite=Strict for additional protection
 * - API key requests bypass CSRF (see hasValidApiKeyHeader documentation)
 * - Rate limiting protects against CSRF brute-force attacks
 */
import { NextRequest, NextResponse } from 'next/server';
import { timeSafeEqual } from './security';

// ============================================================================
// CSRF Failure Rate Limiting (Edge Runtime compatible)
// ============================================================================

/**
 * In-memory store for CSRF failure rate limiting.
 * Note: In serverless/Edge environments, this is per-instance.
 * For distributed rate limiting, use Redis (see issue #17).
 */
const csrfRateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

// Default rate limit config (can be overridden via env vars)
const CSRF_RATE_LIMIT_MAX = parseInt(
  process.env.CSRF_RATE_LIMIT_MAX || '10',
  10
);
const CSRF_RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.CSRF_RATE_LIMIT_WINDOW_MS || '300000', // 5 minutes
  10
);

// Cleanup tracking - run cleanup every N operations to prevent memory leaks
let operationsSinceCleanup = 0;
const CLEANUP_INTERVAL_OPS = 100; // Cleanup every 100 operations

/**
 * Record a CSRF validation failure and check if rate limited.
 * Performs lazy cleanup every CLEANUP_INTERVAL_OPS operations.
 * @param ip - Client IP address
 * @returns true if the IP is rate limited
 */
export function recordCsrfFailure(ip: string): boolean {
  const now = Date.now();

  // Lazy cleanup to prevent memory leaks
  operationsSinceCleanup++;
  if (operationsSinceCleanup >= CLEANUP_INTERVAL_OPS) {
    cleanupCsrfRateLimitStore();
    operationsSinceCleanup = 0;
  }

  const record = csrfRateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    // First failure or window expired - start new window
    csrfRateLimitStore.set(ip, {
      count: 1,
      resetTime: now + CSRF_RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  // Increment failure count
  record.count++;

  // Check if rate limited
  if (record.count > CSRF_RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

/**
 * Check if an IP is currently rate limited for CSRF failures.
 * Does not increment the counter.
 */
export function isCsrfRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = csrfRateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    return false;
  }

  return record.count > CSRF_RATE_LIMIT_MAX;
}

/**
 * Create a rate limit error response for CSRF.
 * Includes Retry-After header indicating when the client can retry.
 */
export function createCsrfRateLimitResponse(): NextResponse {
  const retryAfterSeconds = Math.ceil(CSRF_RATE_LIMIT_WINDOW_MS / 1000);
  const response = NextResponse.json(
    {
      error: 'RATE_LIMITED',
      message: 'Too many CSRF validation failures. Please try again later.',
    },
    { status: 429 }
  );
  response.headers.set('Retry-After', String(retryAfterSeconds));
  return response;
}

/**
 * Clean up expired entries from the rate limit store.
 * Called automatically via lazy cleanup, but can be called manually.
 */
export function cleanupCsrfRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, record] of csrfRateLimitStore.entries()) {
    if (now > record.resetTime) {
      csrfRateLimitStore.delete(ip);
    }
  }
}

/**
 * Reset rate limit state for testing purposes.
 * @internal
 */
export function _resetRateLimitState(): void {
  csrfRateLimitStore.clear();
  operationsSinceCleanup = 0;
}

// Token format: 64 lowercase hex characters (32 bytes)
const CSRF_TOKEN_REGEX = /^[0-9a-f]{64}$/;

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
 * Check if a token has valid format (64-char lowercase hex string).
 */
export function isValidTokenFormat(token: string): boolean {
  return CSRF_TOKEN_REGEX.test(token);
}

/**
 * Validate that two CSRF tokens match using timing-safe comparison.
 * Also validates token format to prevent malformed tokens.
 * @param cookieToken - Token from cookie
 * @param headerToken - Token from request header
 * @returns true if tokens match and have valid format
 */
export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }

  // Validate token format before comparison
  if (!isValidTokenFormat(cookieToken) || !isValidTokenFormat(headerToken)) {
    return false;
  }

  return timeSafeEqual(cookieToken, headerToken);
}

/**
 * Get CSRF token from request cookie.
 */
export function getCsrfTokenFromCookie(
  request: NextRequest
): string | undefined {
  return request.cookies.get(CSRF_CONFIG.cookieName)?.value;
}

/**
 * Get CSRF token from request header.
 */
export function getCsrfTokenFromHeader(
  request: NextRequest
): string | undefined {
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
 * Check if request has an API key header (bypasses CSRF validation).
 *
 * SECURITY WARNING: This function only checks if the X-API-Key header is present,
 * NOT if the key is valid. Actual API key validation MUST happen in route handlers.
 *
 * This bypass exists because:
 * 1. API keys are used for machine-to-machine communication (no browser/cookies)
 * 2. CSRF attacks require a browser context with cookies
 * 3. API key authentication provides equivalent protection to CSRF tokens
 *
 * Route handlers MUST validate the API key before processing the request.
 * If a route accepts API keys but doesn't validate them, it will be vulnerable.
 *
 * @returns true if X-API-Key header is present (non-empty)
 */
export function hasValidApiKeyHeader(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
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
  response.cookies.set(
    CSRF_CONFIG.cookieName,
    token,
    CSRF_CONFIG.cookieOptions
  );
}

/**
 * Clear CSRF cookie on a response.
 */
export function clearCsrfCookie(response: NextResponse): void {
  response.cookies.delete(CSRF_CONFIG.cookieName);
}

/**
 * Rotate CSRF token on a response.
 * Generates a new token and sets it as a cookie.
 * Use after sensitive actions (password change, 2FA, OAuth changes).
 * @returns The new token (for testing/logging purposes)
 */
export function rotateCsrfToken(response: NextResponse): string {
  const newToken = generateCsrfToken();
  setCsrfCookie(response, newToken);
  return newToken;
}
