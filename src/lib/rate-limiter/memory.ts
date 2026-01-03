import { RateLimiter, RateLimitResult, RateLimitHeaders } from './types';
import { SECURITY_CONFIG } from '../config/security';
import { log } from '../logger';

/**
 * Record stored for each rate-limited key.
 */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter implementation.
 * Suitable for single-instance deployments or development.
 * For horizontal scaling, use RedisRateLimiter instead.
 */
export class MemoryRateLimiter implements RateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of expired entries.
   */
  private startCleanup(): void {
    if (typeof setInterval === 'undefined') {
      return;
    }

    const intervalMs = SECURITY_CONFIG.rateLimits.cleanupIntervalMs;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, record] of this.store) {
        if (now > record.resetTime) {
          this.store.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        log.debug('Rate limit cleanup', {
          cleanedEntries: cleanedCount,
          remainingEntries: this.store.size,
        });
      }
    }, intervalMs);
  }

  /**
   * Build rate limit headers from current state.
   */
  private buildHeaders(
    limit: number,
    remaining: number,
    resetTimestamp: number,
    limited: boolean,
    now: number
  ): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': remaining,
      'X-RateLimit-Reset': resetTimestamp,
    };

    if (limited) {
      headers['Retry-After'] = Math.max(
        0,
        resetTimestamp - Math.floor(now / 1000)
      );
    }

    return headers;
  }

  async check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      this.store.set(key, record);
    } else {
      record.count++;
    }

    const limited = record.count > limit;
    const resetTimestamp = Math.floor(record.resetTime / 1000);
    const remaining = Math.max(0, limit - record.count);

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
        now
      ),
    };
  }

  async peek(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      return {
        limited: false,
        headers: this.buildHeaders(
          limit,
          limit,
          Math.floor((now + windowMs) / 1000),
          false,
          now
        ),
      };
    }

    const remaining = Math.max(0, limit - record.count);
    const resetTimestamp = Math.floor(record.resetTime / 1000);

    return {
      limited: record.count > limit,
      headers: this.buildHeaders(limit, remaining, resetTimestamp, false, now),
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.store.clear();
  }

  /**
   * Get current store size (for testing/monitoring).
   */
  get size(): number {
    return this.store.size;
  }
}
