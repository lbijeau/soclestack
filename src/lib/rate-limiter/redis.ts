import { Redis } from '@upstash/redis';
import { RateLimiter, RateLimitResult, RateLimitHeaders } from './types';
import { log } from '../logger';

/**
 * Redis-based rate limiter implementation using Upstash.
 * Suitable for horizontally scaled deployments.
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.
 */
export class RedisRateLimiter implements RateLimiter {
  private redis: Redis;
  private readonly keyPrefix = 'ratelimit:';

  /**
   * Lua script for atomic increment with expiry.
   * Returns [count, ttl_ms] where ttl_ms is the remaining TTL in milliseconds.
   * Sets expiry on first request, ensuring atomicity.
   */
  private static readonly INCR_WITH_EXPIRY_SCRIPT = `
    local key = KEYS[1]
    local window_seconds = tonumber(ARGV[1])
    local count = redis.call('INCR', key)
    local ttl = redis.call('PTTL', key)
    if ttl == -1 then
      redis.call('EXPIRE', key, window_seconds)
      ttl = window_seconds * 1000
    end
    return {count, ttl}
  `;

  constructor() {
    this.redis = Redis.fromEnv();
  }

  /**
   * Build rate limit headers from current state.
   */
  private buildHeaders(
    limit: number,
    remaining: number,
    resetTimestamp: number,
    limited: boolean,
    retryAfterSeconds?: number
  ): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': resetTimestamp,
    };

    if (limited && retryAfterSeconds !== undefined) {
      headers['Retry-After'] = Math.max(0, retryAfterSeconds);
    }

    return headers;
  }

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSeconds = Math.ceil(windowMs / 1000);
    const redisKey = `${this.keyPrefix}${key}`;

    try {
      // Use Lua script for atomic increment + expiry
      const result = (await this.redis.eval(
        RedisRateLimiter.INCR_WITH_EXPIRY_SCRIPT,
        [redisKey],
        [windowSeconds]
      )) as [number, number];

      const [count, ttlMs] = result;
      const limited = count > limit;
      const resetTimestamp = Math.floor((now + ttlMs) / 1000);
      const remaining = Math.max(0, limit - count);
      const retryAfterSeconds = Math.ceil(ttlMs / 1000);

      if (limited) {
        const [action, identifier] = key.split(':');
        log.security.rateLimited(identifier || 'unknown', action || key);
      }

      return {
        limited,
        headers: this.buildHeaders(
          limit,
          remaining,
          resetTimestamp,
          limited,
          retryAfterSeconds
        ),
      };
    } catch (error) {
      log.error('Redis rate limiter error', { error, key });
      // Fail open - allow request but log error
      return {
        limited: false,
        headers: this.buildHeaders(
          limit,
          limit,
          Math.floor((now + windowMs) / 1000),
          false,
          undefined
        ),
      };
    }
  }

  async peek(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const redisKey = `${this.keyPrefix}${key}`;

    try {
      const [count, ttlMs] = await Promise.all([
        this.redis.get<number>(redisKey),
        this.redis.pttl(redisKey),
      ]);

      const currentCount = count || 0;
      const resetTime = ttlMs > 0 ? now + ttlMs : now + windowMs;
      const resetTimestamp = Math.floor(resetTime / 1000);
      const remaining = Math.max(0, limit - currentCount);

      return {
        limited: currentCount > limit,
        headers: this.buildHeaders(limit, remaining, resetTimestamp, false, undefined),
      };
    } catch (error) {
      log.error('Redis rate limiter peek error', { error, key });
      // Fail open
      return {
        limited: false,
        headers: this.buildHeaders(
          limit,
          limit,
          Math.floor((now + windowMs) / 1000),
          false,
          undefined
        ),
      };
    }
  }

  async reset(key: string): Promise<void> {
    const redisKey = `${this.keyPrefix}${key}`;
    try {
      await this.redis.del(redisKey);
    } catch (error) {
      log.error('Redis rate limiter reset error', { error, key });
    }
  }

  async shutdown(): Promise<void> {
    // Upstash Redis uses HTTP, no persistent connection to close
    // Nothing to clean up
  }
}
