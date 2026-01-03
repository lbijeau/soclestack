/**
 * Rate limit headers to include in HTTP responses.
 * Follows RFC 6585 and draft-ietf-httpapi-ratelimit-headers conventions.
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': number;
  'X-RateLimit-Remaining': number;
  'X-RateLimit-Reset': number;
  'Retry-After'?: number;
}

/**
 * Result from a rate limit check operation.
 */
export interface RateLimitResult {
  /** Whether the request should be blocked */
  limited: boolean;
  /** Headers to include in the response */
  headers: RateLimitHeaders;
}

/**
 * Rate limiter interface supporting multiple backends.
 * Implementations must be async to support distributed stores like Redis.
 */
export interface RateLimiter {
  /**
   * Check if request should be rate limited and increment the counter.
   * @param key - Unique identifier for rate limiting (e.g., "login:192.168.1.1")
   * @param limit - Maximum number of requests allowed in the window
   * @param windowMs - Time window in milliseconds
   * @returns Result with limited status and headers
   */
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;

  /**
   * Get current rate limit state without incrementing the counter.
   * Useful for adding headers to successful responses.
   * @param key - Unique identifier for rate limiting
   * @param limit - Maximum number of requests allowed in the window
   * @param windowMs - Time window in milliseconds
   * @returns Result with current state and headers
   */
  peek(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;

  /**
   * Reset rate limit for a key.
   * Useful after successful authentication to clear failed attempt counters.
   * @param key - Unique identifier to reset
   */
  reset(key: string): Promise<void>;

  /**
   * Shutdown the rate limiter and clean up resources.
   * Should be called during graceful shutdown.
   */
  shutdown(): Promise<void>;
}
