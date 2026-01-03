/**
 * Required environment variables for security-critical operations.
 * These must be set in production - the application will fail to start without them.
 */
export const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
] as const;

/**
 * Validates that all required environment variables are set.
 * Call this at application startup to fail fast if configuration is missing.
 *
 * @throws Error if any required environment variable is missing
 */
export function validateRequiredEnvVars(): void {
  const missing: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'These are required for security-critical operations. ' +
        'See .env.example for configuration.'
    );
  }
}

export const SECURITY_CONFIG = {
  lockout: {
    maxFailedAttempts: 5,
    durationMinutes: 15,
  },
  rememberMe: {
    tokenLifetimeDays: 30,
    cookieName: 'remember_me',
  },
  twoFactor: {
    issuer: 'SocleStack',
    backupCodeCount: 10,
    pendingTokenExpiryMinutes: 5,
  },
  impersonation: {
    timeoutMinutes: 60,
  },
  oauth: {
    stateTokenExpiryMinutes: 10,
    pendingLinkExpiryMinutes: 5,
    stateCookieName: 'oauth_state',
  },
  rateLimits: {
    apiKeyCreate: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
    apiKeyRevoke: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
    passwordChange: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    twoFactorSetup: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    twoFactorDisable: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    oauthLink: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  },
  passwordPolicy: {
    maxAgeDays: 90, // Warn after 90 days
    warningDays: 14, // Show warning 14 days before expiration
  },
} as const;

export type SecurityConfig = typeof SECURITY_CONFIG;
