/**
 * Security configuration constants.
 * Environment variable validation has been moved to @/lib/env.
 */

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
    cleanupIntervalMs: 60 * 1000, // Cleanup expired entries every 60 seconds
    login: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
    register: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
    forgotPassword: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
    apiKeyCreate: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
    apiKeyRevoke: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
    passwordChange: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    twoFactorSetup: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    twoFactorDisable: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    oauthLink: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
    csrfFailure: { limit: 10, windowMs: 5 * 60 * 1000 }, // 10 failures per 5 minutes
  },
  passwordPolicy: {
    maxAgeDays: 90, // Warn after 90 days
    warningDays: 14, // Show warning 14 days before expiration
  },
  emailRetention: {
    softDeleteRetentionDays: 30, // Hard-delete soft-deleted records after 30 days
    htmlBodyRetentionDays: 90, // Purge htmlBody from old records after 90 days
    batchSize: 100, // Process records in batches
  },
  circuitBreaker: {
    failureThreshold: 5, // Open circuit after 5 consecutive failures
    resetTimeoutMs: 30_000, // Try recovery after 30 seconds
    successThreshold: 2, // Close circuit after 2 successes in half-open
  },
} as const;

export type SecurityConfig = typeof SECURITY_CONFIG;
