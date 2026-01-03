import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRateLimiter } from '@/lib/rate-limiter/memory';

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

// Mock SECURITY_CONFIG
vi.mock('@/lib/config/security', () => ({
  SECURITY_CONFIG: {
    rateLimits: {
      cleanupIntervalMs: 60000,
    },
  },
}));

describe('MemoryRateLimiter', () => {
  let rateLimiter: MemoryRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new MemoryRateLimiter();
  });

  afterEach(async () => {
    await rateLimiter.shutdown();
    vi.useRealTimers();
  });

  describe('check', () => {
    it('should allow requests within limit', async () => {
      const result = await rateLimiter.check('test:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Limit']).toBe(5);
      expect(result.headers['X-RateLimit-Remaining']).toBe(4);
      expect(result.headers['Retry-After']).toBeUndefined();
    });

    it('should increment counter on each check', async () => {
      await rateLimiter.check('test:key', 5, 60000);
      await rateLimiter.check('test:key', 5, 60000);
      const result = await rateLimiter.check('test:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(2);
    });

    it('should block requests exceeding limit', async () => {
      const limit = 3;
      for (let i = 0; i < limit; i++) {
        await rateLimiter.check('test:key', limit, 60000);
      }

      const result = await rateLimiter.check('test:key', limit, 60000);

      expect(result.limited).toBe(true);
      expect(result.headers['X-RateLimit-Remaining']).toBe(0);
      expect(result.headers['Retry-After']).toBeDefined();
      expect(result.headers['Retry-After']).toBeGreaterThan(0);
    });

    it('should reset counter after window expires', async () => {
      const windowMs = 60000;

      await rateLimiter.check('test:key', 2, windowMs);
      await rateLimiter.check('test:key', 2, windowMs);

      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 1000);

      const result = await rateLimiter.check('test:key', 2, windowMs);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(1);
    });

    it('should handle different keys independently', async () => {
      await rateLimiter.check('key1', 2, 60000);
      await rateLimiter.check('key1', 2, 60000);

      const result1 = await rateLimiter.check('key1', 2, 60000);
      const result2 = await rateLimiter.check('key2', 2, 60000);

      expect(result1.limited).toBe(true);
      expect(result2.limited).toBe(false);
      expect(result2.headers['X-RateLimit-Remaining']).toBe(1);
    });

    it('should include correct reset timestamp', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const windowMs = 60000;
      const result = await rateLimiter.check('test:key', 5, windowMs);

      const expectedReset = Math.floor((now + windowMs) / 1000);
      expect(result.headers['X-RateLimit-Reset']).toBe(expectedReset);
    });
  });

  describe('peek', () => {
    it('should return current state without incrementing', async () => {
      await rateLimiter.check('test:key', 5, 60000);

      const peek1 = await rateLimiter.peek('test:key', 5, 60000);
      const peek2 = await rateLimiter.peek('test:key', 5, 60000);

      expect(peek1.headers['X-RateLimit-Remaining']).toBe(4);
      expect(peek2.headers['X-RateLimit-Remaining']).toBe(4);
    });

    it('should return full limit for unknown key', async () => {
      const result = await rateLimiter.peek('unknown:key', 5, 60000);

      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(5);
    });

    it('should not include Retry-After even when at limit', async () => {
      await rateLimiter.check('test:key', 1, 60000);

      const result = await rateLimiter.peek('test:key', 1, 60000);

      expect(result.limited).toBe(true);
      expect(result.headers['Retry-After']).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should clear rate limit for a key', async () => {
      await rateLimiter.check('test:key', 2, 60000);
      await rateLimiter.check('test:key', 2, 60000);

      await rateLimiter.reset('test:key');

      const result = await rateLimiter.check('test:key', 2, 60000);
      expect(result.limited).toBe(false);
      expect(result.headers['X-RateLimit-Remaining']).toBe(1);
    });

    it('should only affect the specified key', async () => {
      await rateLimiter.check('key1', 1, 60000);
      await rateLimiter.check('key2', 1, 60000);

      await rateLimiter.reset('key1');

      const result1 = await rateLimiter.check('key1', 1, 60000);
      const result2 = await rateLimiter.check('key2', 1, 60000);

      expect(result1.limited).toBe(false);
      expect(result2.limited).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should clear the store', async () => {
      await rateLimiter.check('test:key', 5, 60000);
      expect(rateLimiter.size).toBe(1);

      await rateLimiter.shutdown();

      expect(rateLimiter.size).toBe(0);
    });

    it('should stop cleanup timer', async () => {
      await rateLimiter.shutdown();

      // Advance time and verify no cleanup errors
      vi.advanceTimersByTime(120000);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      await rateLimiter.check('key1', 5, 30000); // 30s window
      await rateLimiter.check('key2', 5, 90000); // 90s window

      expect(rateLimiter.size).toBe(2);

      // Advance past key1's window but not key2's
      vi.advanceTimersByTime(60000); // Triggers cleanup

      expect(rateLimiter.size).toBe(1);

      // Verify key2 is still there
      const result = await rateLimiter.peek('key2', 5, 90000);
      expect(result.headers['X-RateLimit-Remaining']).toBe(4);
    });
  });
});
