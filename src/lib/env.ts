/**
 * Environment variable validation using Zod.
 * Provides type-safe access to environment variables with validation at startup.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   const secret = env.JWT_SECRET; // typed, validated
 */
import { z } from 'zod';

/**
 * Server-side environment variables schema.
 * These are only available on the server and should never be exposed to the client.
 */
const serverEnvSchema = z
  .object({
    // === Required Security Secrets ===
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    SESSION_SECRET: z
      .string()
      .min(32, 'SESSION_SECRET must be at least 32 characters'),

    // === Database ===
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // === Runtime ===
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // === Optional: Email ===
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),

    // === Optional: OAuth Providers ===
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // === Optional: Validation Control ===
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

/**
 * Client-safe environment variables schema.
 * These are prefixed with NEXT_PUBLIC_ and are safe to expose to the browser.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
});

/**
 * Combined environment type for full type safety.
 */
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type Env = ServerEnv & ClientEnv;

/**
 * Format Zod errors into a readable string.
 */
function formatZodErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('\n');
}

/**
 * Parse and validate environment variables.
 * In production runtime, this will throw if required variables are missing or invalid.
 * In development/test, validation is permissive unless VALIDATE_ENV_VARS=true.
 * During build phase (NEXT_PHASE=phase-production-build), validation is skipped.
 */
function parseEnv(): Env {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceValidation = process.env.VALIDATE_ENV_VARS === 'true';
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  // Always parse client env (has safe defaults)
  const clientResult = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!clientResult.success) {
    throw new Error(
      `Client environment validation failed:\n${formatZodErrors(clientResult.error)}\n\nSee .env.example for configuration.`
    );
  }

  // During build phase, use permissive parsing (env vars may not be available)
  // In development/test without forced validation, also use permissive parsing
  if (isBuildPhase || (!isProduction && !forceValidation)) {
    // Parse with defaults, don't fail on missing optional values
    const devResult = serverEnvSchema
      .partial()
      .extend({
        NODE_ENV: serverEnvSchema.shape.NODE_ENV,
      })
      .safeParse(process.env);

    if (!devResult.success && !isBuildPhase) {
      // In dev (not build), just warn but don't crash
      console.warn(
        `[env] Warning: Some environment variables are invalid:\n${formatZodErrors(devResult.error)}`
      );
    }

    return {
      ...devResult.data,
      ...clientResult.data,
    } as Env;
  }

  // Production runtime (not build): strict parsing
  const serverResult = serverEnvSchema.safeParse(process.env);

  if (!serverResult.success) {
    throw new Error(
      `Environment validation failed:\n${formatZodErrors(serverResult.error)}\n\nSee .env.example for configuration.`
    );
  }

  return {
    ...serverResult.data,
    ...clientResult.data,
  };
}

/**
 * Validated environment variables.
 * Import this to get type-safe access to env vars.
 */
export const env = parseEnv();

/**
 * Re-export parseEnv for testing purposes.
 * @internal
 */
export { parseEnv as _parseEnv };

/**
 * Export schemas for testing purposes.
 * @internal
 */
export { serverEnvSchema as _serverEnvSchema, clientEnvSchema as _clientEnvSchema };
