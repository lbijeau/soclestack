import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateRequiredEnvVars,
  REQUIRED_ENV_VARS,
} from '@/lib/config/security';
import { getJwtSecret } from '@/lib/auth/oauth/secrets';

describe('validateRequiredEnvVars', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should pass when all required env vars are set', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.SESSION_SECRET = 'test-session-secret';

    expect(() => validateRequiredEnvVars()).not.toThrow();
  });

  it('should throw when JWT_SECRET is missing', () => {
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.SESSION_SECRET = 'test-session-secret';
    delete process.env.JWT_SECRET;

    expect(() => validateRequiredEnvVars()).toThrow('JWT_SECRET');
    expect(() => validateRequiredEnvVars()).toThrow(
      'Missing required environment variables'
    );
  });

  it('should throw when JWT_REFRESH_SECRET is missing', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.SESSION_SECRET = 'test-session-secret';
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => validateRequiredEnvVars()).toThrow('JWT_REFRESH_SECRET');
  });

  it('should throw when SESSION_SECRET is missing', () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    delete process.env.SESSION_SECRET;

    expect(() => validateRequiredEnvVars()).toThrow('SESSION_SECRET');
  });

  it('should list all missing vars in error message', () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.SESSION_SECRET;

    expect(() => validateRequiredEnvVars()).toThrow(
      'JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET'
    );
  });

  it('should reference .env.example in error message', () => {
    delete process.env.JWT_SECRET;

    expect(() => validateRequiredEnvVars()).toThrow('.env.example');
  });

  it('should export the correct required env vars', () => {
    expect(REQUIRED_ENV_VARS).toContain('JWT_SECRET');
    expect(REQUIRED_ENV_VARS).toContain('JWT_REFRESH_SECRET');
    expect(REQUIRED_ENV_VARS).toContain('SESSION_SECRET');
    expect(REQUIRED_ENV_VARS).toHaveLength(3);
  });
});

describe('getJwtSecret', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return Uint8Array when JWT_SECRET is set', () => {
    process.env.JWT_SECRET = 'test-secret';

    const result = getJwtSecret();

    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('should encode the secret correctly', () => {
    process.env.JWT_SECRET = 'test-secret';

    const result = getJwtSecret();
    const decoded = new TextDecoder().decode(result);

    expect(decoded).toBe('test-secret');
  });

  it('should throw when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
    expect(() => getJwtSecret()).toThrow('environment variable is required');
  });

  it('should reference .env.example in error message', () => {
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow('.env.example');
  });
});
