/**
 * Shared secret utilities for OAuth token operations.
 * Centralizes JWT secret access to ensure consistent error handling.
 *
 * Note: JWT_SECRET is validated by env module on startup.
 * In production it's required; in development permissive parsing is used.
 */
import { env } from '@/lib/env';

let cachedSecret: Uint8Array | null = null;
let cachedSecretValue: string | null = null;

/**
 * Gets the JWT secret for OAuth token signing/verification.
 * Caches the encoded secret for performance.
 */
export function getJwtSecret(): Uint8Array {
  const secret = env.JWT_SECRET as string;

  // Return cached value if secret hasn't changed
  if (cachedSecret && cachedSecretValue === secret) {
    return cachedSecret;
  }

  cachedSecretValue = secret;
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}
