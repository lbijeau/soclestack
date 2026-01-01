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
