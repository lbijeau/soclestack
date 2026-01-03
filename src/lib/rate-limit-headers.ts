/**
 * Rate Limit Headers Utility
 *
 * Provides functions to set RFC-compliant rate limit headers on responses.
 *
 * Headers set:
 * - X-RateLimit-Limit: Maximum requests allowed in window
 * - X-RateLimit-Remaining: Requests remaining in current window
 * - X-RateLimit-Reset: Unix timestamp when window resets
 * - Retry-After: Seconds until rate limit resets (only when limited)
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6585#section-4
 * @see https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 */

export interface RateLimitInfo {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Requests remaining in current window */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  reset: number;
}

/**
 * Set rate limit headers on a response.
 *
 * @param headers - Headers object to modify
 * @param info - Rate limit information
 *
 * @example
 * ```typescript
 * const response = NextResponse.json(data);
 * setRateLimitHeaders(response.headers, {
 *   limit: 10,
 *   remaining: 8,
 *   reset: Math.floor(Date.now() / 1000) + 900
 * });
 * ```
 */
export function setRateLimitHeaders(headers: Headers, info: RateLimitInfo): void {
  headers.set('X-RateLimit-Limit', String(info.limit));
  headers.set('X-RateLimit-Remaining', String(info.remaining));
  headers.set('X-RateLimit-Reset', String(info.reset));

  // Set Retry-After when rate limit is exceeded
  if (info.remaining === 0) {
    const retryAfter = Math.max(0, info.reset - Math.floor(Date.now() / 1000));
    headers.set('Retry-After', String(retryAfter));
  }
}

/**
 * Create a 429 Too Many Requests response with rate limit headers.
 *
 * @param info - Rate limit information
 * @param message - Optional custom message
 * @returns Response with 429 status and appropriate headers
 *
 * @example
 * ```typescript
 * if (isRateLimited(key, limit, windowMs)) {
 *   return createRateLimitResponse(rateLimitInfo);
 * }
 * ```
 */
export function createRateLimitResponse(
  info: RateLimitInfo,
  message = 'Too many requests. Please try again later.'
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
  });

  setRateLimitHeaders(headers, { ...info, remaining: 0 });

  return new Response(
    JSON.stringify({
      error: {
        type: 'RATE_LIMIT_ERROR',
        message,
      },
    }),
    {
      status: 429,
      headers,
    }
  );
}
