import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @upstash/redis before importing RedisRateLimiter
const mockRedis = {
  eval: vi.fn(),
  get: vi.fn(),
  pttl: vi.fn(),
  del: vi.fn(),
};

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => mockRedis),
  },
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    security: {
      rateLimited: vi.fn(),
    },
  },
}));

import { RedisRateLimiter } from '@/lib/rate-limiter/redis';

describe('RedisRateLimiter', () => {
  let rateLimiter: RedisRateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = new RedisRateLimiter();
  });

  afterEach(async () => {
    await rateLimiter.shutdown();
  });

  describe('check', () => {
    it('should allow requests within limit', async () => {
      mockRedis.eval.mockResolvedValue([1, 60000]); // count=1, ttl=60s

      const result = await rateLimiter.check('test:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Limit']).toBe(5);
      expect(result.headers['X-RateLimit-Remaining']).toBe(4);
      expect(result.headers['Retry-After']).toBeUndefined();
    });

    it('should block requests exceeding limit', async () => {
      mockRedis.eval.mockResolvedValue([6, 30000]); // count=6 (over limit of 5), ttl=30s

      const result = await rateLimiter.check('test:key', 5, 60000);

      expect(result.limited).toBe(true);
      expect(result.headers['X-RateLimit-Remaining']).toBe(0);
      expect(result.headers['Retry-After']).toBe(30); // 30s remaining
    });

    it('should use correct Redis key prefix', async () => {
      mockRedis.eval.mockResolvedValue([1, 60000]);

      await rateLimiter.check('login:192.168.1.1', 5, 60000);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCR'),
        ['ratelimit:login:192.168.1.1'],
        [60]
      );
    });

    it('should use atomic Lua script for increment and expiry', async () => {
      mockRedis.eval.mockResolvedValue([1, 60000]);

      await rateLimiter.check('test:key', 5, 60000);

      // Verify eval was called with a Lua script containing INCR, PTTL, and EXPIRE
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCR'),
        expect.any(Array),
        expect.any(Array)
      );
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('PTTL'),
        expect.any(Array),
        expect.any(Array)
      );
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('EXPIRE'),
        expect.any(Array),
        expect.any(Array)
      );
    });

    it('should fail open on Redis error', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis connection failed'));

      const result = await rateLimiter.check('test:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(5);
    });
  });

  describe('peek', () => {
    it('should return current state without incrementing', async () => {
      mockRedis.get.mockResolvedValue(3);
      mockRedis.pttl.mockResolvedValue(45000);

      const result = await rateLimiter.peek('test:key', 5, 60000);

      expect(result.headers['X-RateLimit-Remaining']).toBe(2);
      expect(mockRedis.eval).not.toHaveBeenCalled();
    });

    it('should return full limit for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.pttl.mockResolvedValue(-2);

      const result = await rateLimiter.peek('unknown:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(5);
    });

    it('should indicate limited state when count exceeds limit', async () => {
      mockRedis.get.mockResolvedValue(6); // Already over limit
      mockRedis.pttl.mockResolvedValue(45000);

      const result = await rateLimiter.peek('test:key', 5, 60000);

      expect(result.limited).toBe(true);
      expect(result.headers['X-RateLimit-Remaining']).toBe(0);
    });

    it('should fail open on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await rateLimiter.peek('test:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(5);
    });
  });

  describe('reset', () => {
    it('should delete the rate limit key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await rateLimiter.reset('test:key');

      expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:test:key');
    });

    it('should not throw on Redis error', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

      await expect(rateLimiter.reset('test:key')).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should complete without error', async () => {
      await expect(rateLimiter.shutdown()).resolves.not.toThrow();
    });
  });
});
