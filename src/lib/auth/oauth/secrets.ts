/**
 * Shared secret utilities for OAuth token operations.
 * Centralizes JWT secret access to ensure consistent error handling.
 */
import { env } from '@/lib/env';

let cachedSecret: Uint8Array | null = null;
let cachedSecretValue: string | null = null;

/**
 * Gets the JWT secret for OAuth token signing/verification.
 * Caches the encoded secret for performance.
 * In production, env.JWT_SECRET is guaranteed by startup validation.
 */
export function getJwtSecret(): Uint8Array {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required for OAuth tokens. ' +
        'See .env.example for configuration.'
    );
  }

  // Return cached value if secret hasn't changed
  if (cachedSecret && cachedSecretValue === secret) {
    return cachedSecret;
  }

  cachedSecretValue = secret;
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}
