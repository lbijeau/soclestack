/**
 * Shared secret utilities for OAuth token operations.
 * Centralizes JWT secret access to ensure consistent error handling.
 */

/**
 * Gets the JWT secret for OAuth token signing/verification.
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
  return new TextEncoder().encode(secret);
}
