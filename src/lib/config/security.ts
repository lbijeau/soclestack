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
} as const;

export type SecurityConfig = typeof SECURITY_CONFIG;
