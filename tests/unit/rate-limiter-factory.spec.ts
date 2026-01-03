import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = process.env;

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

describe('Rate Limiter Factory', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(async () => {
    process.env = originalEnv;
    // Reset the module to clear singleton
    const { resetRateLimiter } = await import('@/lib/rate-limiter');
    await resetRateLimiter();
  });

  it('should return MemoryRateLimiter when Redis is not configured', async () => {
    const { getRateLimiter, getRateLimiterType } = await import('@/lib/rate-limiter');

    const limiter = await getRateLimiter();

    expect(limiter).toBeDefined();
    expect(getRateLimiterType()).toBe('memory');
  });

  it('should return the same instance on subsequent calls', async () => {
    const { getRateLimiter } = await import('@/lib/rate-limiter');

    const limiter1 = await getRateLimiter();
    const limiter2 = await getRateLimiter();

    expect(limiter1).toBe(limiter2);
  });

  it('should reset limiter and return null type after reset', async () => {
    const { getRateLimiter, resetRateLimiter, getRateLimiterType } = await import(
      '@/lib/rate-limiter'
    );

    await getRateLimiter();
    expect(getRateLimiterType()).toBe('memory');

    await resetRateLimiter();
    expect(getRateLimiterType()).toBeNull();
  });

  it('should create new instance after reset', async () => {
    const { getRateLimiter, resetRateLimiter } = await import('@/lib/rate-limiter');

    const limiter1 = await getRateLimiter();
    await resetRateLimiter();
    const limiter2 = await getRateLimiter();

    expect(limiter1).not.toBe(limiter2);
  });
});
