import pino from 'pino';

// Sensitive fields to redact from logs
const REDACT_PATHS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'resetToken',
  'verificationToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      env: process.env.NODE_ENV || 'development',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Development: pretty print logs
// Production: JSON logs for log aggregation
const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = pino({
  ...baseConfig,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

// Create a child logger with request context
// Note: Available for future use when request correlation IDs are implemented
function _createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    ...(userId && { userId }),
  });
}

// Log categories for different parts of the application
export const log = {
  // General application logging
  info: (msg: string, data?: object) => logger.info(data, msg),
  warn: (msg: string, data?: object) => logger.warn(data, msg),
  error: (msg: string, data?: object) => logger.error(data, msg),
  debug: (msg: string, data?: object) => logger.debug(data, msg),

  // Authentication events
  auth: {
    login: (userId: string, email: string, ip?: string) =>
      logger.info({ category: 'auth', action: 'login', userId, email: redactEmail(email), ip }, 'User logged in'),
    logout: (userId: string) =>
      logger.info({ category: 'auth', action: 'logout', userId }, 'User logged out'),
    register: (userId: string, email: string) =>
      logger.info({ category: 'auth', action: 'register', userId, email: redactEmail(email) }, 'User registered'),
    loginFailed: (email: string, reason: string, ip?: string) =>
      logger.warn({ category: 'auth', action: 'login_failed', email: redactEmail(email), reason, ip }, 'Login failed'),
    passwordReset: (userId: string) =>
      logger.info({ category: 'auth', action: 'password_reset', userId }, 'Password reset'),
    passwordChanged: (userId: string) =>
      logger.info({ category: 'auth', action: 'password_changed', userId }, 'Password changed'),
    emailVerified: (userId: string) =>
      logger.info({ category: 'auth', action: 'email_verified', userId }, 'Email verified'),
    twoFactorEnabled: (userId: string) =>
      logger.info({ category: 'auth', action: '2fa_enabled', userId }, '2FA enabled'),
    twoFactorDisabled: (userId: string) =>
      logger.info({ category: 'auth', action: '2fa_disabled', userId }, '2FA disabled'),
  },

  // Security events
  security: {
    suspiciousActivity: (msg: string, data?: object) =>
      logger.warn({ category: 'security', ...data }, msg),
    rateLimited: (ip: string, endpoint: string) =>
      logger.warn({ category: 'security', action: 'rate_limited', ip, endpoint }, 'Rate limited'),
    accountLocked: (userId: string, reason: string) =>
      logger.warn({ category: 'security', action: 'account_locked', userId, reason }, 'Account locked'),
    accountUnlocked: (userId: string) =>
      logger.info({ category: 'security', action: 'account_unlocked', userId }, 'Account unlocked'),
    impersonationStart: (adminId: string, targetUserId: string) =>
      logger.warn(
        { category: 'security', action: 'impersonation_start', adminId, targetUserId },
        'Admin started impersonation'
      ),
    impersonationEnd: (adminId: string, targetUserId: string) =>
      logger.info(
        { category: 'security', action: 'impersonation_end', adminId, targetUserId },
        'Admin ended impersonation'
      ),
  },

  // API request logging
  api: {
    request: (method: string, path: string, requestId: string, userId?: string) =>
      logger.info({ category: 'api', method, path, requestId, userId }, 'API request'),
    response: (method: string, path: string, status: number, duration: number, requestId: string) =>
      logger.info(
        { category: 'api', method, path, status, duration, requestId },
        'API response'
      ),
    error: (method: string, path: string, error: string, requestId: string) =>
      logger.error({ category: 'api', method, path, error, requestId }, 'API error'),
  },

  // Email logging
  email: {
    sent: (type: string, recipient: string) =>
      logger.info({ category: 'email', action: 'sent', type, recipient: redactEmail(recipient) }, 'Email sent'),
    failed: (type: string, recipient: string, error: string) =>
      logger.error(
        { category: 'email', action: 'failed', type, recipient: redactEmail(recipient), error },
        'Email failed'
      ),
  },

  // Database operations (for debugging)
  db: {
    query: (operation: string, table: string, duration?: number) =>
      logger.debug({ category: 'db', operation, table, duration }, 'Database query'),
    error: (operation: string, table: string, error: string) =>
      logger.error({ category: 'db', operation, table, error }, 'Database error'),
  },

  // Organization events
  org: {
    created: (orgId: string, name: string, ownerId: string) =>
      logger.info({ category: 'org', action: 'created', orgId, name, ownerId }, 'Organization created'),
    memberAdded: (orgId: string, userId: string, role: string) =>
      logger.info({ category: 'org', action: 'member_added', orgId, userId, role }, 'Member added'),
    memberRemoved: (orgId: string, userId: string) =>
      logger.info({ category: 'org', action: 'member_removed', orgId, userId }, 'Member removed'),
    inviteSent: (orgId: string, email: string) =>
      logger.info(
        { category: 'org', action: 'invite_sent', orgId, email: redactEmail(email) },
        'Invite sent'
      ),
  },
};

// Helper to partially redact email addresses
function redactEmail(email: string): string {
  if (!email || !email.includes('@')) return '[INVALID_EMAIL]';
  const [local, domain] = email.split('@');
  const redactedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';
  return `${redactedLocal}@${domain}`;
}

// Export the raw logger for advanced use cases
export { logger };

// Default export for simple usage
export default log;
