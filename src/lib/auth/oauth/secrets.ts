/**
 * Shared secret utilities for OAuth token operations.
 * Centralizes JWT secret access to ensure consistent error handling.
 */

let cachedSecret: Uint8Array | null = null;
let cachedSecretValue: string | null = null;

/**
 * Gets the JWT secret for OAuth token signing/verification.
 * Caches the encoded secret for performance.
 * @throws Error if JWT_SECRET environment variable is not set
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
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
