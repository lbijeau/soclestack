/**
 * Next.js instrumentation file - runs once at server startup.
 * Used for initialization tasks like validating required environment variables.
 *
 * The env module validates on import, so importing it here triggers validation.
 * In production or when VALIDATE_ENV_VARS=true, invalid config will throw.
 */
import '@/lib/env';

export function register() {
  // Validation happens on import of @/lib/env
  // This function exists for Next.js instrumentation hook
}
