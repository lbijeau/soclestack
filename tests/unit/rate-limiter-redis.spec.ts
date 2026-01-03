import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @upstash/redis before importing RedisRateLimiter
const mockPipeline = {
  incr: vi.fn().mockReturnThis(),
  pttl: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedis = {
  pipeline: vi.fn(() => mockPipeline),
  get: vi.fn(),
  pttl: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  setex: vi.fn(),
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
      mockPipeline.exec.mockResolvedValue([1, 60000]); // count=1, ttl=60s

      const result = await rateLimiter.check('test:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Limit']).toBe(5);
      expect(result.headers['X-RateLimit-Remaining']).toBe(4);
      expect(result.headers['Retry-After']).toBeUndefined();
    });

    it('should block requests exceeding limit', async () => {
      mockPipeline.exec.mockResolvedValue([6, 30000]); // count=6 (over limit of 5), ttl=30s

      const result = await rateLimiter.check('test:key', 5, 60000);

      expect(result.limited).toBe(true);
      expect(result.headers['X-RateLimit-Remaining']).toBe(0);
      expect(result.headers['Retry-After']).toBe(30); // 30s remaining
    });

    it('should set expiry on first request', async () => {
      mockPipeline.exec.mockResolvedValue([1, -1]); // count=1, no expiry set

      await rateLimiter.check('test:key', 5, 60000);

      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:test:key', 60);
    });

    it('should handle race condition where key disappears', async () => {
      mockPipeline.exec.mockResolvedValue([1, -2]); // count=1, key doesn't exist

      await rateLimiter.check('test:key', 5, 60000);

      expect(mockRedis.setex).toHaveBeenCalledWith('ratelimit:test:key', 60, 1);
    });

    it('should use correct Redis key prefix', async () => {
      mockPipeline.exec.mockResolvedValue([1, 60000]);

      await rateLimiter.check('login:192.168.1.1', 5, 60000);

      expect(mockPipeline.incr).toHaveBeenCalledWith('ratelimit:login:192.168.1.1');
      expect(mockPipeline.pttl).toHaveBeenCalledWith('ratelimit:login:192.168.1.1');
    });

    it('should fail open on Redis error', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection failed'));

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
      expect(mockPipeline.incr).not.toHaveBeenCalled();
    });

    it('should return full limit for non-existent key', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.pttl.mockResolvedValue(-2);

      const result = await rateLimiter.peek('unknown:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(5);
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
