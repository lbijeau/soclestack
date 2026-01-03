import { RateLimiter } from './types';
import { MemoryRateLimiter } from './memory';
import { log } from '../logger';

export type { RateLimiter, RateLimitResult, RateLimitHeaders } from './types';
export { MemoryRateLimiter } from './memory';

let rateLimiterInstance: RateLimiter | null = null;

/**
 * Get the singleton rate limiter instance.
 * Automatically selects Redis if UPSTASH_REDIS_REST_URL is configured,
 * otherwise falls back to in-memory implementation.
 *
 * @returns The rate limiter instance
 */
export async function getRateLimiter(): Promise<RateLimiter> {
  if (rateLimiterInstance) {
    return rateLimiterInstance;
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      // Lazy import to avoid loading Redis SDK when not needed
      const { RedisRateLimiter } = await import('./redis');
      rateLimiterInstance = new RedisRateLimiter();
      log.info('Rate limiter initialized with Redis backend');
    } catch (error) {
      log.error('Failed to initialize Redis rate limiter, falling back to memory', {
        error,
      });
      rateLimiterInstance = new MemoryRateLimiter();
    }
  } else {
    rateLimiterInstance = new MemoryRateLimiter();
    log.debug('Rate limiter initialized with in-memory backend');
  }

  return rateLimiterInstance;
}

/**
 * Reset the rate limiter singleton.
 * Useful for testing or when reconfiguration is needed.
 */
export async function resetRateLimiter(): Promise<void> {
  if (rateLimiterInstance) {
    await rateLimiterInstance.shutdown();
    rateLimiterInstance = null;
  }
}

/**
 * Get the current rate limiter type.
 * Returns 'redis', 'memory', or null if not initialized.
 */
export function getRateLimiterType(): 'redis' | 'memory' | null {
  if (!rateLimiterInstance) {
    return null;
  }
  return rateLimiterInstance.constructor.name === 'RedisRateLimiter'
    ? 'redis'
    : 'memory';
}
