/**
 * Next.js instrumentation file - runs once at server startup.
 * Used for initialization tasks like validating required environment variables.
 */
import { validateRequiredEnvVars } from '@/lib/config/security';

export function register() {
  // Only validate in production or when explicitly requested
  // Development mode may not have all secrets set initially
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.VALIDATE_ENV_VARS === 'true'
  ) {
    validateRequiredEnvVars();
  }
}
