import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Environment validation tests.
 *
 * These tests verify the Zod-based environment variable validation
 * implemented in src/lib/env.ts.
 *
 * Note: We test the parsing logic directly rather than importing env,
 * since env is parsed at module load time.
 */

// Mock the parseEnv function behavior by testing Zod schemas directly
import { z } from 'zod';

// Replicate the schema from src/lib/env.ts for testing
const serverEnvSchema = z
  .object({
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET must be at least 32 characters'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    VALIDATE_ENV_VARS: z.string().optional(),
  })
  .refine((data) => !(data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET), {
    message: 'GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set',
    path: ['GOOGLE_CLIENT_SECRET'],
  })
  .refine((data) => !(data.GITHUB_CLIENT_ID && !data.GITHUB_CLIENT_SECRET), {
    message: 'GITHUB_CLIENT_SECRET is required when GITHUB_CLIENT_ID is set',
    path: ['GITHUB_CLIENT_SECRET'],
  });

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

describe('Environment Validation Schema', () => {
  describe('Required variables', () => {
    const validEnv = {
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      SESSION_SECRET: 'c'.repeat(32),
      DATABASE_URL: 'postgresql://localhost:5432/test',
      NODE_ENV: 'development',
    };

    it('should accept valid configuration with all required vars', () => {
      const result = serverEnvSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
    });

    it('should fail when JWT_SECRET is missing', () => {
      const { JWT_SECRET, ...envWithoutJwtSecret } = validEnv;
      const result = serverEnvSchema.safeParse(envWithoutJwtSecret);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('JWT_SECRET'))).toBe(
          true
        );
      }
    });

    it('should fail when JWT_SECRET is too short', () => {
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        JWT_SECRET: 'short',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) =>
              i.path.includes('JWT_SECRET') &&
              i.message.includes('at least 32 characters')
          )
        ).toBe(true);
      }
    });

    it('should fail when JWT_REFRESH_SECRET is missing', () => {
      const { JWT_REFRESH_SECRET, ...envWithout } = validEnv;
      const result = serverEnvSchema.safeParse(envWithout);
      expect(result.success).toBe(false);
    });

    it('should fail when SESSION_SECRET is missing', () => {
      const { SESSION_SECRET, ...envWithout } = validEnv;
      const result = serverEnvSchema.safeParse(envWithout);
      expect(result.success).toBe(false);
    });

    it('should fail when DATABASE_URL is missing', () => {
      const { DATABASE_URL, ...envWithout } = validEnv;
      const result = serverEnvSchema.safeParse(envWithout);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.includes('DATABASE_URL'))
        ).toBe(true);
      }
    });
  });

  describe('Optional variables', () => {
    const validEnv = {
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      SESSION_SECRET: 'c'.repeat(32),
      DATABASE_URL: 'postgresql://localhost:5432/test',
    };

    it('should allow missing RESEND_API_KEY', () => {
      const result = serverEnvSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.RESEND_API_KEY).toBeUndefined();
      }
    });

    it('should allow missing OAuth credentials', () => {
      const result = serverEnvSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.GOOGLE_CLIENT_ID).toBeUndefined();
        expect(result.data.GITHUB_CLIENT_ID).toBeUndefined();
      }
    });

    it('should accept valid OAuth credentials when provided', () => {
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
        GITHUB_CLIENT_ID: 'github-id',
        GITHUB_CLIENT_SECRET: 'github-secret',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('OAuth pair validation', () => {
    const validEnv = {
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      SESSION_SECRET: 'c'.repeat(32),
      DATABASE_URL: 'postgresql://localhost:5432/test',
    };

    it('should fail when GOOGLE_CLIENT_ID is set without GOOGLE_CLIENT_SECRET', () => {
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_ID: 'google-id',
        // Missing GOOGLE_CLIENT_SECRET
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) =>
              i.path.includes('GOOGLE_CLIENT_SECRET') &&
              i.message.includes('required when GOOGLE_CLIENT_ID is set')
          )
        ).toBe(true);
      }
    });

    it('should fail when GITHUB_CLIENT_ID is set without GITHUB_CLIENT_SECRET', () => {
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        GITHUB_CLIENT_ID: 'github-id',
        // Missing GITHUB_CLIENT_SECRET
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) =>
              i.path.includes('GITHUB_CLIENT_SECRET') &&
              i.message.includes('required when GITHUB_CLIENT_ID is set')
          )
        ).toBe(true);
      }
    });

    it('should allow CLIENT_SECRET without CLIENT_ID', () => {
      // This is fine - extra secrets don't cause issues
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        GOOGLE_CLIENT_SECRET: 'secret-without-id',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('NODE_ENV validation', () => {
    const validEnv = {
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      SESSION_SECRET: 'c'.repeat(32),
      DATABASE_URL: 'postgresql://localhost:5432/test',
    };

    it('should default NODE_ENV to development', () => {
      const result = serverEnvSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development');
      }
    });

    it('should accept production NODE_ENV', () => {
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'production',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('production');
      }
    });

    it('should accept test NODE_ENV', () => {
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('test');
      }
    });

    it('should reject invalid NODE_ENV', () => {
      const result = serverEnvSchema.safeParse({
        ...validEnv,
        NODE_ENV: 'staging',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Client environment schema', () => {
    it('should default NEXT_PUBLIC_APP_URL to localhost', () => {
      const result = clientEnvSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000');
      }
    });

    it('should accept valid URL', () => {
      const result = clientEnvSchema.safeParse({
        NEXT_PUBLIC_APP_URL: 'https://myapp.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NEXT_PUBLIC_APP_URL).toBe('https://myapp.com');
      }
    });

    it('should reject invalid URL', () => {
      const result = clientEnvSchema.safeParse({
        NEXT_PUBLIC_APP_URL: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Error message format', () => {
    it('should include helpful error messages', () => {
      const result = serverEnvSchema.safeParse({
        JWT_SECRET: 'short',
        DATABASE_URL: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(
          messages.some((m) => m.includes('at least 32 characters'))
        ).toBe(true);
      }
    });
  });
});
