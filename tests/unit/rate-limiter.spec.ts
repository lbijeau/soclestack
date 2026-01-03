/**
 * Rate Limiter Tests
 *
 * Tests for rate limiting functionality including:
 * - isRateLimited function
 * - getRateLimitInfo function
 * - Rate limit headers utility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the logger before importing auth
vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    security: {
      rateLimited: vi.fn(),
    },
  },
}));

// Import after mocking
import {
  isRateLimited,
  getRateLimitInfo,
  rateLimitStore,
} from '@/lib/auth';
import {
  setRateLimitHeaders,
  createRateLimitResponse,
  RateLimitInfo,
} from '@/lib/rate-limit-headers';
import { log } from '@/lib/logger';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear the rate limit store before each test
    rateLimitStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    rateLimitStore.clear();
  });

  describe('isRateLimited', () => {
    it('should allow requests under the limit', () => {
      const key = 'test:127.0.0.1';
      const limit = 5;
      const windowMs = 60000;

      // First 5 requests should not be rate limited
      for (let i = 0; i < limit; i++) {
        expect(isRateLimited(key, limit, windowMs)).toBe(false);
      }
    });

    it('should block requests at the limit', () => {
      const key = 'test:127.0.0.1';
      const limit = 3;
      const windowMs = 60000;

      // Use up all attempts
      for (let i = 0; i < limit; i++) {
        isRateLimited(key, limit, windowMs);
      }

      // Next request should be blocked
      expect(isRateLimited(key, limit, windowMs)).toBe(true);
    });

    it('should log when rate limit is exceeded', () => {
      const key = 'login:192.168.1.1';
      const limit = 2;
      const windowMs = 60000;

      // Use up all attempts
      isRateLimited(key, limit, windowMs);
      isRateLimited(key, limit, windowMs);

      // This should trigger logging
      isRateLimited(key, limit, windowMs);

      expect(log.security.rateLimited).toHaveBeenCalledWith('192.168.1.1', 'login');
    });

    it('should reset after window expires', () => {
      const key = 'test:127.0.0.1';
      const limit = 2;
      const windowMs = 100; // 100ms window for fast test

      // Use up all attempts
      isRateLimited(key, limit, windowMs);
      isRateLimited(key, limit, windowMs);
      expect(isRateLimited(key, limit, windowMs)).toBe(true);

      // Manually expire the window
      const record = rateLimitStore.get(key);
      if (record) {
        record.resetTime = Date.now() - 1;
      }

      // Should be allowed again
      expect(isRateLimited(key, limit, windowMs)).toBe(false);
    });

    it('should track separate keys independently', () => {
      const key1 = 'login:192.168.1.1';
      const key2 = 'login:192.168.1.2';
      const limit = 2;
      const windowMs = 60000;

      // Use up key1's attempts
      isRateLimited(key1, limit, windowMs);
      isRateLimited(key1, limit, windowMs);
      expect(isRateLimited(key1, limit, windowMs)).toBe(true);

      // key2 should still have attempts
      expect(isRateLimited(key2, limit, windowMs)).toBe(false);
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return full limit for new keys', () => {
      const key = 'new-key:127.0.0.1';
      const limit = 10;
      const windowMs = 60000;

      const info = getRateLimitInfo(key, limit, windowMs);

      expect(info.limit).toBe(10);
      expect(info.remaining).toBe(10);
      expect(info.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should return correct remaining count after requests', () => {
      const key = 'test:127.0.0.1';
      const limit = 5;
      const windowMs = 60000;

      // Make 3 requests
      isRateLimited(key, limit, windowMs);
      isRateLimited(key, limit, windowMs);
      isRateLimited(key, limit, windowMs);

      const info = getRateLimitInfo(key, limit, windowMs);

      expect(info.limit).toBe(5);
      expect(info.remaining).toBe(2); // 5 - 3 = 2
    });

    it('should return 0 remaining when at limit', () => {
      const key = 'test:127.0.0.1';
      const limit = 3;
      const windowMs = 60000;

      // Use up all attempts
      for (let i = 0; i < limit; i++) {
        isRateLimited(key, limit, windowMs);
      }

      const info = getRateLimitInfo(key, limit, windowMs);

      expect(info.remaining).toBe(0);
    });

    it('should return reset time in seconds', () => {
      const key = 'test:127.0.0.1';
      const limit = 5;
      const windowMs = 60000;

      isRateLimited(key, limit, windowMs);
      const info = getRateLimitInfo(key, limit, windowMs);

      // Reset should be in seconds (not milliseconds)
      expect(info.reset).toBeLessThan(Date.now()); // Should be seconds, not ms
      expect(info.reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('setRateLimitHeaders', () => {
    it('should set all rate limit headers', () => {
      const headers = new Headers();
      const info: RateLimitInfo = {
        limit: 10,
        remaining: 7,
        reset: Math.floor(Date.now() / 1000) + 900,
      };

      setRateLimitHeaders(headers, info);

      expect(headers.get('X-RateLimit-Limit')).toBe('10');
      expect(headers.get('X-RateLimit-Remaining')).toBe('7');
      expect(headers.get('X-RateLimit-Reset')).toBe(String(info.reset));
      expect(headers.get('Retry-After')).toBeNull();
    });

    it('should set Retry-After when remaining is 0', () => {
      const headers = new Headers();
      const resetTime = Math.floor(Date.now() / 1000) + 60;
      const info: RateLimitInfo = {
        limit: 10,
        remaining: 0,
        reset: resetTime,
      };

      setRateLimitHeaders(headers, info);

      expect(headers.get('X-RateLimit-Remaining')).toBe('0');
      const retryAfter = headers.get('Retry-After');
      expect(retryAfter).not.toBeNull();
      expect(parseInt(retryAfter!)).toBeGreaterThan(0);
      expect(parseInt(retryAfter!)).toBeLessThanOrEqual(60);
    });

    it('should not set Retry-After when remaining > 0', () => {
      const headers = new Headers();
      const info: RateLimitInfo = {
        limit: 10,
        remaining: 1,
        reset: Math.floor(Date.now() / 1000) + 60,
      };

      setRateLimitHeaders(headers, info);

      expect(headers.get('Retry-After')).toBeNull();
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create a 429 response', async () => {
      const info: RateLimitInfo = {
        limit: 10,
        remaining: 5,
        reset: Math.floor(Date.now() / 1000) + 900,
      };

      const response = createRateLimitResponse(info);

      expect(response.status).toBe(429);
    });

    it('should include rate limit headers', async () => {
      const info: RateLimitInfo = {
        limit: 10,
        remaining: 5,
        reset: Math.floor(Date.now() / 1000) + 900,
      };

      const response = createRateLimitResponse(info);

      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0'); // Always 0 for rate limit response
      expect(response.headers.get('Retry-After')).not.toBeNull();
    });

    it('should include error body', async () => {
      const info: RateLimitInfo = {
        limit: 10,
        remaining: 5,
        reset: Math.floor(Date.now() / 1000) + 900,
      };

      const response = createRateLimitResponse(info, 'Custom error message');
      const body = await response.json();

      expect(body.error.type).toBe('RATE_LIMIT_ERROR');
      expect(body.error.message).toBe('Custom error message');
    });

    it('should use default message if not provided', async () => {
      const info: RateLimitInfo = {
        limit: 10,
        remaining: 5,
        reset: Math.floor(Date.now() / 1000) + 900,
      };

      const response = createRateLimitResponse(info);
      const body = await response.json();

      expect(body.error.message).toBe('Too many requests. Please try again later.');
    });
  });
});
