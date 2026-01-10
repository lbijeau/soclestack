/**
 * Auth Service
 *
 * Business logic for authentication operations.
 * Route handlers call these functions and map results to HTTP responses.
 */

import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from '@/lib/validations';
import { ROLES } from '@/lib/security/index';
import { authenticateUser, createUserSession } from '@/lib/auth';
import type { SessionData } from '@/types/auth';
import type { IronSession } from 'iron-session';
import { getRateLimiter } from '@/lib/rate-limiter';
import {
  checkAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
} from '@/lib/auth/lockout';
import { createRememberMeToken } from '@/lib/auth/remember-me';
import {
  createPending2FAToken,
  verifyPending2FAToken,
} from '@/lib/auth/pending-2fa';
import { ImpersonationBlockedError } from '@/lib/auth/impersonation';
import { verifyTOTPCode, generateTOTPSecret } from '@/lib/auth/totp';
import {
  verifyBackupCode,
  getRemainingBackupCodeCount,
  generateBackupCodes,
  deleteAllBackupCodes,
} from '@/lib/auth/backup-codes';
import { logAuditEvent } from '@/lib/audit';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { prisma } from '@/lib/db';
import {
  sendNewDeviceAlert,
  isKnownDevice,
  sendTwoFactorEnabledNotification,
  sendTwoFactorDisabledNotification,
  sendPasswordChangedNotification,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '@/lib/email';
import { parseUserAgent } from '@/lib/utils/user-agent';
import { generateCsrfToken } from '@/lib/csrf';
import { RequestContext } from '@/lib/api-utils';
import {
  hashPassword,
  generateResetToken,
  hashResetToken,
} from '@/lib/security';
import { generateSlug } from '@/lib/organization';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  AccountLockedError,
  EmailNotVerifiedError,
  RateLimitError,
  ConflictError,
  TokenExpiredError,
  TokenInvalidError,
  NotFoundError,
} from './auth.errors';
import log from '@/lib/logger';
import type { PlatformRole } from '@/types/auth';

// Helper to get role from user (resolves from userRoles relation)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getUserRole(user: any): PlatformRole {
  // Get role from RBAC system (userRoles relation)
  if (user.userRoles?.length) {
    const roleNames = user.userRoles.map(
      (ur: { role: { name: string } }) => ur.role.name
    );
    if (roleNames.includes(ROLES.ADMIN)) return ROLES.ADMIN;
    if (roleNames.includes(ROLES.MODERATOR)) return ROLES.MODERATOR;
    return ROLES.USER;
  }
  // Default to USER
  return ROLES.USER;
}

// ============================================================================
// Types
// ============================================================================

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface UserDTO {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface LoginResult {
  user: UserDTO;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  rememberMeCookie?: {
    value: string;
    expiresAt: Date;
  };
  csrfToken: string;
}

export interface TwoFactorRequired {
  requiresTwoFactor: true;
  pendingToken: string;
}

// ============================================================================
// Login
// ============================================================================

/**
 * Authenticate user with email and password.
 *
 * @throws {RateLimitError} Too many login attempts
 * @throws {ValidationError} Invalid input data
 * @throws {AccountLockedError} Account is locked
 * @throws {AuthenticationError} Invalid credentials
 * @throws {EmailNotVerifiedError} Email not verified
 */
export async function login(
  input: LoginInput,
  context: RequestContext,
  session: IronSession<SessionData>
): Promise<LoginResult | TwoFactorRequired> {
  const { clientIP, userAgent } = context;

  // Rate limiting
  const rateLimitKey = `login:${clientIP}`;
  const { limit: loginLimit, windowMs: loginWindowMs } =
    SECURITY_CONFIG.rateLimits.login;
  const rateLimiter = await getRateLimiter();
  const rateLimitResult = await rateLimiter.check(
    rateLimitKey,
    loginLimit,
    loginWindowMs
  );
  if (rateLimitResult.limited) {
    throw new RateLimitError(
      'Too many login attempts. Please try again later.',
      {
        limit: rateLimitResult.headers['X-RateLimit-Limit'],
        remaining: rateLimitResult.headers['X-RateLimit-Remaining'],
        reset: rateLimitResult.headers['X-RateLimit-Reset'],
      }
    );
  }

  // Validate input
  const validationResult = loginSchema.safeParse(input);
  if (!validationResult.success) {
    throw new ValidationError('Invalid input data', {
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  const { email, password, rememberMe } = validationResult.data;

  // Find user first to check lockout
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    // Check if account is locked
    const lockoutStatus = await checkAccountLocked(user.id);
    if (lockoutStatus.isLocked) {
      const retryAfterSeconds = lockoutStatus.lockedUntil
        ? Math.ceil((lockoutStatus.lockedUntil.getTime() - Date.now()) / 1000)
        : SECURITY_CONFIG.lockout.durationMinutes * 60;

      throw new AccountLockedError(
        lockoutStatus.lockedUntil,
        retryAfterSeconds
      );
    }
  }

  // Authenticate user
  const authenticatedUser = await authenticateUser(email, password);
  if (!authenticatedUser) {
    // Record failed attempt if user exists
    if (user) {
      const lockoutStatus = await recordFailedAttempt(
        user.id,
        clientIP,
        userAgent
      );

      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILURE',
        category: 'authentication',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { reason: 'invalid_password' },
      });

      if (lockoutStatus.isLocked) {
        const retryAfterSeconds = lockoutStatus.lockedUntil
          ? Math.ceil((lockoutStatus.lockedUntil.getTime() - Date.now()) / 1000)
          : SECURITY_CONFIG.lockout.durationMinutes * 60;

        throw new AccountLockedError(
          lockoutStatus.lockedUntil,
          retryAfterSeconds
        );
      }
    } else {
      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILURE',
        category: 'authentication',
        ipAddress: clientIP,
        userAgent,
        metadata: { reason: 'user_not_found', email },
      });
    }

    throw new AuthenticationError('Invalid email or password');
  }

  // Check if email is verified
  if (!authenticatedUser.emailVerified) {
    throw new EmailNotVerifiedError();
  }

  // Reset failed attempts on successful login
  await resetFailedAttempts(authenticatedUser.id);

  // Check if 2FA is enabled
  if (authenticatedUser.twoFactorEnabled) {
    const pendingToken = await createPending2FAToken(authenticatedUser.id);

    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      category: 'authentication',
      userId: authenticatedUser.id,
      ipAddress: clientIP,
      userAgent,
      metadata: { requires2FA: true },
    });

    return {
      requiresTwoFactor: true,
      pendingToken,
    };
  }

  // Check if this is a new device BEFORE logging the successful login
  const knownDevice = await isKnownDevice(
    authenticatedUser.id,
    clientIP,
    userAgent
  );

  // Create session (no 2FA)
  const tokens = await createUserSession(
    authenticatedUser,
    clientIP,
    userAgent,
    session
  );

  // Log successful login
  await logAuditEvent({
    action: 'AUTH_LOGIN_SUCCESS',
    category: 'authentication',
    userId: authenticatedUser.id,
    ipAddress: clientIP,
    userAgent,
  });

  // Send new device alert if this is an unknown device (fire-and-forget)
  if (!knownDevice && clientIP && userAgent) {
    const deviceInfo = parseUserAgent(userAgent);
    sendNewDeviceAlert(
      authenticatedUser.email,
      deviceInfo,
      clientIP,
      new Date(),
      authenticatedUser.id
    ).catch((err) =>
      log.email.failed('new_device_alert', authenticatedUser.email, err)
    );
  }

  // Handle Remember Me
  let rememberMeCookie: { value: string; expiresAt: Date } | undefined;
  if (rememberMe) {
    const rememberMeResult = await createRememberMeToken(
      authenticatedUser.id,
      clientIP,
      userAgent
    );
    rememberMeCookie = {
      value: rememberMeResult.cookie,
      expiresAt: rememberMeResult.expiresAt,
    };
  }

  // Generate CSRF token
  const csrfToken = generateCsrfToken();

  // Return success result
  return {
    user: {
      id: authenticatedUser.id,
      email: authenticatedUser.email,
      username: authenticatedUser.username,
      firstName: authenticatedUser.firstName,
      lastName: authenticatedUser.lastName,
      role: authenticatedUser.role,
      isActive: authenticatedUser.isActive,
      emailVerified: authenticatedUser.emailVerified,
      lastLoginAt: authenticatedUser.lastLoginAt,
      createdAt: authenticatedUser.createdAt,
    },
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
    rememberMeCookie,
    csrfToken,
  };
}

// ============================================================================
// Registration
// ============================================================================

export interface RegisterInput {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  inviteToken?: string;
}

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface RegisterResult {
  user: UserDTO;
  message: string;
}

/**
 * Register a new user account.
 *
 * @throws {RateLimitError} Too many registration attempts
 * @throws {ValidationError} Invalid input data
 * @throws {ConflictError} Email or username already exists
 * @throws {TokenInvalidError} Invalid invite token
 * @throws {TokenExpiredError} Expired invite token
 */
export async function register(
  input: RegisterInput,
  context: RequestContext
): Promise<RegisterResult> {
  const { clientIP } = context;

  // Rate limiting
  const rateLimitKey = `register:${clientIP}`;
  const { limit: registerLimit, windowMs: registerWindowMs } =
    SECURITY_CONFIG.rateLimits.register;
  const rateLimiter = await getRateLimiter();
  const rateLimitResult = await rateLimiter.check(
    rateLimitKey,
    registerLimit,
    registerWindowMs
  );
  if (rateLimitResult.limited) {
    throw new RateLimitError(
      'Too many registration attempts. Please try again later.',
      {
        limit: rateLimitResult.headers['X-RateLimit-Limit'],
        remaining: rateLimitResult.headers['X-RateLimit-Remaining'],
        reset: rateLimitResult.headers['X-RateLimit-Reset'],
      }
    );
  }

  // Validate input
  const validationResult = registerSchema.safeParse(input);
  if (!validationResult.success) {
    throw new ValidationError('Invalid input data', {
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  const {
    email,
    username,
    password,
    firstName,
    lastName,
    organizationName,
    inviteToken,
  } = validationResult.data;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, ...(username ? [{ username }] : [])],
    },
  });

  if (existingUser) {
    const conflictField = existingUser.email === email ? 'email' : 'username';
    throw new ConflictError(`A user with this ${conflictField} already exists`);
  }

  // Handle invite token if provided
  let invite = null;
  if (inviteToken) {
    invite = await prisma.organizationInvite.findUnique({
      where: { token: inviteToken },
      include: { organization: true },
    });

    if (!invite) {
      throw new TokenInvalidError('Invalid or expired invite token');
    }

    if (invite.expiresAt < new Date()) {
      throw new TokenExpiredError('This invite has expired');
    }

    // Verify email matches the invite
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      throw new ValidationError('Email does not match the invite', {
        details: {
          email: [
            'You must register with the email address the invite was sent to',
          ],
        },
      });
    }
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Generate email verification token (hash for storage, plain for email)
  const plainVerificationToken = await generateResetToken();
  const hashedVerificationToken = await hashResetToken(plainVerificationToken);

  // Create user with organization (transaction to ensure consistency)
  const user = await prisma.$transaction(async (tx) => {
    // Create the user first
    const newUser = await tx.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        passwordChangedAt: new Date(),
        firstName,
        lastName,
        emailVerificationToken: hashedVerificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    if (organizationName) {
      // Create new organization
      const slug = await generateSlug(organizationName);
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
        },
      });

      // Get ROLE_OWNER
      const ownerRole = await tx.role.findUnique({
        where: { name: ROLES.OWNER },
      });
      if (!ownerRole) {
        throw new Error(`${ROLES.OWNER} not found`);
      }

      // Create UserRole with ROLE_OWNER for this organization
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: ownerRole.id,
          organizationId: organization.id,
        },
      });
    } else if (invite) {
      // Get the role from invite
      const inviteRole = await tx.role.findUnique({
        where: { id: invite.roleId },
      });
      if (!inviteRole) {
        throw new Error('Invite role not found');
      }

      // Create UserRole with invite's role for the organization
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: invite.roleId,
          organizationId: invite.organizationId,
        },
      });

      // Delete the invite
      await tx.organizationInvite.delete({
        where: { id: invite.id },
      });
    }

    return newUser;
  });

  // Send verification email (fire-and-forget)
  sendVerificationEmail(
    email,
    plainVerificationToken,
    firstName,
    user.id
  ).catch((err) => log.email.failed('verification', email, err));

  // Return success result
  return {
    message:
      'Registration successful. Please check your email to verify your account.',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: getUserRole(user),
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
  };
}

// ============================================================================
// Two-Factor Authentication
// ============================================================================

export interface Validate2FAInput {
  pendingToken: string;
  code: string;
  isBackupCode?: boolean;
}

export interface Validate2FAResult {
  user: UserDTO;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  csrfToken: string;
  warnings?: {
    lowBackupCodes: boolean;
    remainingBackupCodes: number;
  };
}

/**
 * Validate 2FA code during login flow.
 *
 * @throws {ValidationError} Invalid input
 * @throws {AuthenticationError} Invalid pending token or code
 */
export async function validate2FA(
  input: Validate2FAInput,
  context: RequestContext,
  session: IronSession<SessionData>
): Promise<Validate2FAResult> {
  const { clientIP, userAgent } = context;
  const { pendingToken, code, isBackupCode = false } = input;

  // Rate limiting for 2FA validation to prevent brute force attacks
  const { limit, windowMs } = SECURITY_CONFIG.rateLimits.twoFactorValidate;
  const rateLimitKey = `2fa-validate:${clientIP}`;
  const rateLimiter = await getRateLimiter();
  const rateLimitResult = await rateLimiter.check(
    rateLimitKey,
    limit,
    windowMs
  );

  if (rateLimitResult.limited) {
    throw new RateLimitError(
      'Too many failed attempts. Please try again later.',
      {
        limit: rateLimitResult.headers['X-RateLimit-Limit'],
        remaining: rateLimitResult.headers['X-RateLimit-Remaining'],
        reset: rateLimitResult.headers['X-RateLimit-Reset'],
      }
    );
  }

  // Verify pending token
  const pending = await verifyPending2FAToken(pendingToken);
  if (!pending) {
    throw new AuthenticationError('Session expired, please login again');
  }

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
  });

  if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
    throw new AuthenticationError('Invalid session');
  }

  let isValid = false;
  let usedBackupCode = false;

  if (isBackupCode) {
    isValid = await verifyBackupCode(user.id, code);
    usedBackupCode = isValid;
  } else {
    isValid = verifyTOTPCode(user.twoFactorSecret, code);
  }

  if (!isValid) {
    await logAuditEvent({
      action: 'AUTH_2FA_FAILURE',
      category: 'authentication',
      userId: user.id,
      ipAddress: clientIP,
      userAgent,
      metadata: { isBackupCode },
    });

    throw new AuthenticationError('Invalid code');
  }

  // Create full session
  const tokens = await createUserSession(user, clientIP, userAgent, session);

  // Log success
  if (usedBackupCode) {
    const remainingCodes = await getRemainingBackupCodeCount(user.id);
    await logAuditEvent({
      action: 'AUTH_2FA_BACKUP_USED',
      category: 'authentication',
      userId: user.id,
      ipAddress: clientIP,
      userAgent,
      metadata: { remainingCodes },
    });
  } else {
    await logAuditEvent({
      action: 'AUTH_2FA_SUCCESS',
      category: 'authentication',
      userId: user.id,
      ipAddress: clientIP,
      userAgent,
    });
  }

  // Check remaining backup codes
  const remainingBackupCodes = await getRemainingBackupCodeCount(user.id);

  // Generate CSRF token
  const csrfToken = generateCsrfToken();

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: getUserRole(user),
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    tokens: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
    csrfToken,
    warnings:
      remainingBackupCodes <= 3
        ? {
            lowBackupCodes: true,
            remainingBackupCodes,
          }
        : undefined,
  };
}

export interface Setup2FAResult {
  qrCodeDataUrl: string;
  manualEntryKey: string;
  backupCodes: string[];
}

/**
 * Start 2FA setup - generate secret, QR code, and backup codes.
 *
 * @throws {ImpersonationBlockedError} Cannot setup 2FA while impersonating
 * @throws {ConflictError} 2FA already enabled
 * @throws {NotFoundError} User not found
 */
export async function setup2FA(
  userId: string,
  context: RequestContext
): Promise<Setup2FAResult> {
  // Skip rate limiting in test environment
  const isTestEnv =
    process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';

  if (!isTestEnv) {
    // Rate limiting
    const { limit, windowMs } = SECURITY_CONFIG.rateLimits.twoFactorSetup;
    const rateLimitKey = `2fa-setup:${context.clientIP}`;
    const rateLimiter = await getRateLimiter();
    const rateLimitResult = await rateLimiter.check(
      rateLimitKey,
      limit,
      windowMs
    );

    if (rateLimitResult.limited) {
      throw new RateLimitError('Too many requests. Please try again later.', {
        limit: rateLimitResult.headers['X-RateLimit-Limit'],
        remaining: rateLimitResult.headers['X-RateLimit-Remaining'],
        reset: rateLimitResult.headers['X-RateLimit-Reset'],
      });
    }
  }

  // Block 2FA setup while impersonating
  if (context.isImpersonating) {
    throw new ImpersonationBlockedError();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.twoFactorEnabled) {
    throw new ConflictError('2FA is already enabled');
  }

  // Generate TOTP secret and QR code
  const totpResult = await generateTOTPSecret(user.email);

  // Generate backup codes
  const backupCodes = await generateBackupCodes(userId);

  // Store secret (not enabled yet, needs verification)
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: totpResult.secret,
      twoFactorEnabled: false,
      twoFactorVerified: false,
    },
  });

  return {
    qrCodeDataUrl: totpResult.qrCodeDataUrl,
    manualEntryKey: totpResult.manualEntryKey,
    backupCodes,
  };
}

/**
 * Verify 2FA setup with initial code and enable 2FA.
 *
 * @throws {ImpersonationBlockedError} Cannot verify 2FA while impersonating
 * @throws {ValidationError} 2FA not set up or already enabled
 * @throws {AuthenticationError} Invalid code
 */
export async function verify2FASetup(
  userId: string,
  code: string,
  context: RequestContext
): Promise<void> {
  // Block 2FA verification while impersonating
  if (context.isImpersonating) {
    throw new ImpersonationBlockedError();
  }

  const { clientIP, userAgent } = context;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true, email: true },
  });

  if (!user || !user.twoFactorSecret) {
    throw new ValidationError('2FA setup not started');
  }

  if (user.twoFactorEnabled) {
    throw new ConflictError('2FA is already enabled');
  }

  const isValid = verifyTOTPCode(user.twoFactorSecret, code);
  if (!isValid) {
    throw new AuthenticationError('Invalid code');
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorVerified: true,
    },
  });

  await logAuditEvent({
    action: 'AUTH_2FA_ENABLED',
    category: 'security',
    userId,
    ipAddress: clientIP,
    userAgent,
  });

  // Send notification (fire-and-forget)
  sendTwoFactorEnabledNotification(user.email, userId).catch((err) =>
    log.email.failed('2fa_enabled', user.email, err)
  );
}

/**
 * Disable 2FA.
 *
 * @throws {ImpersonationBlockedError} Cannot disable 2FA while impersonating
 * @throws {NotFoundError} User not found
 * @throws {ValidationError} 2FA not enabled
 * @throws {AuthenticationError} Invalid code
 * @throws {AuthorizationError} Admins cannot disable 2FA
 */
export async function disable2FA(
  userId: string,
  code: string,
  context: RequestContext
): Promise<void> {
  // Rate limiting
  const { limit, windowMs } = SECURITY_CONFIG.rateLimits.twoFactorDisable;
  const rateLimitKey = `2fa-disable:${context.clientIP}`;
  const rateLimiter = await getRateLimiter();
  const rateLimitResult = await rateLimiter.check(
    rateLimitKey,
    limit,
    windowMs
  );
  if (rateLimitResult.limited) {
    throw new RateLimitError('Too many requests. Please try again later.', {
      limit: rateLimitResult.headers['X-RateLimit-Limit'],
      remaining: rateLimitResult.headers['X-RateLimit-Remaining'],
      reset: rateLimitResult.headers['X-RateLimit-Reset'],
    });
  }

  // Block 2FA disable while impersonating
  if (context.isImpersonating) {
    throw new ImpersonationBlockedError();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorSecret: true,
      twoFactorEnabled: true,
      email: true,
      userRoles: {
        include: { role: { select: { name: true } } },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Admins cannot disable their own 2FA
  if (getUserRole(user) === ROLES.ADMIN) {
    throw new AuthorizationError('Admins cannot disable 2FA');
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new ValidationError('2FA is not enabled');
  }

  const isValid = verifyTOTPCode(user.twoFactorSecret, code);
  if (!isValid) {
    throw new AuthenticationError('Invalid code');
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorVerified: false,
    },
  });

  // Delete backup codes
  await deleteAllBackupCodes(userId);

  await logAuditEvent({
    action: 'AUTH_2FA_DISABLED',
    category: 'security',
    userId,
    ipAddress: context.clientIP,
    userAgent: context.userAgent,
  });

  // Send notification (fire-and-forget)
  sendTwoFactorDisabledNotification(user.email, userId).catch((err) =>
    log.email.failed('2fa_disabled', user.email, err)
  );
}

// ============================================================================
// Password Reset
// ============================================================================

export interface RequestPasswordResetInput {
  email: string;
}

/**
 * Request a password reset. Generates token and stores in database.
 * Always returns success to prevent email enumeration.
 *
 * @throws {RateLimitError} Too many password reset requests
 * @throws {ValidationError} Invalid input
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput,
  context: RequestContext
): Promise<{ message: string }> {
  const { clientIP } = context;

  // Rate limiting
  const rateLimitKey = `forgot-password:${clientIP}`;
  const { limit, windowMs } = SECURITY_CONFIG.rateLimits.forgotPassword;
  const rateLimiter = await getRateLimiter();
  const rateLimitResult = await rateLimiter.check(
    rateLimitKey,
    limit,
    windowMs
  );
  if (rateLimitResult.limited) {
    throw new RateLimitError(
      'Too many password reset requests. Please try again later.',
      {
        limit: rateLimitResult.headers['X-RateLimit-Limit'],
        remaining: rateLimitResult.headers['X-RateLimit-Remaining'],
        reset: rateLimitResult.headers['X-RateLimit-Reset'],
      }
    );
  }

  const validationResult = requestPasswordResetSchema.safeParse(input);
  if (!validationResult.success) {
    throw new ValidationError('Invalid input', {
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  const { email } = validationResult.data;

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return same message to prevent email enumeration
  const message =
    'If an account with that email exists, a password reset link has been sent.';

  if (!user) {
    return { message };
  }

  // Generate reset token
  const resetToken = await generateResetToken();
  const hashedToken = await hashResetToken(resetToken);

  // Store reset token in database
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // Send password reset email (fire-and-forget)
  sendPasswordResetEmail(
    email,
    resetToken,
    user.firstName ?? undefined,
    user.id
  ).catch((err) => log.email.failed('password_reset', email, err));

  return { message };
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

/**
 * Reset password using a valid reset token.
 *
 * @throws {ValidationError} Invalid input
 * @throws {TokenInvalidError} Token not found
 * @throws {TokenExpiredError} Token has expired
 */
export async function resetPassword(
  input: ResetPasswordInput,
  context: RequestContext
): Promise<void> {
  const validationResult = resetPasswordSchema.safeParse(input);
  if (!validationResult.success) {
    throw new ValidationError('Invalid input', {
      details: validationResult.error.flatten().fieldErrors,
    });
  }

  const { token, password } = validationResult.data;

  // Hash the provided token to match against stored hash
  const hashedToken = await hashResetToken(token);

  // First check if token exists at all
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
    },
  });

  if (!user) {
    throw new TokenInvalidError('Invalid reset token');
  }

  // Check if token has expired
  if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    throw new TokenExpiredError('Reset token has expired');
  }

  // Hash new password
  const hashedPassword = await hashPassword(password);

  // Store old password in history (if user had a password)
  if (user.password) {
    await prisma.passwordHistory.create({
      data: {
        userId: user.id,
        password: user.password,
      },
    });
  }

  // Update user's password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  // Logout from all devices for security
  await prisma.userSession.deleteMany({
    where: { userId: user.id },
  });

  // Log the password change
  await logAuditEvent({
    action: 'SECURITY_PASSWORD_CHANGED',
    category: 'security',
    userId: user.id,
    ipAddress: context.clientIP,
    userAgent: context.userAgent,
    metadata: { method: 'reset_token' },
  });

  // Send notification (fire-and-forget)
  sendPasswordChangedNotification(user.email, new Date(), user.id).catch(
    (err) => log.email.failed('password_changed', user.email, err)
  );
}

// ============================================================================
// Email Verification
// ============================================================================

export interface VerifyEmailInput {
  token: string;
}

/**
 * Verify an email address using the verification token.
 *
 * @throws {ValidationError} Token not provided
 * @throws {TokenInvalidError} Token not found
 * @throws {TokenExpiredError} Token has expired
 */
export async function verifyEmail(input: VerifyEmailInput): Promise<void> {
  const { token } = input;

  if (!token) {
    throw new ValidationError('Verification token is required');
  }

  // Hash the provided token to match against stored hash
  const hashedToken = await hashResetToken(token);

  // First check if token exists at all
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: hashedToken,
    },
  });

  if (!user) {
    throw new TokenInvalidError('Invalid verification token');
  }

  // Check if token has expired
  if (
    !user.emailVerificationExpires ||
    user.emailVerificationExpires < new Date()
  ) {
    throw new TokenExpiredError('Verification token has expired');
  }

  // Update user as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });
}

/**
 * Resend verification email for a user.
 *
 * @throws {ValidationError} Email already verified
 */
export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      firstName: true,
      username: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.emailVerified) {
    throw new ConflictError('Email is already verified');
  }

  // Generate new verification token (hash for storage, plain for email)
  const plainVerificationToken = await generateResetToken();
  const hashedVerificationToken = await hashResetToken(plainVerificationToken);
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update user with new verification token
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: tokenExpiry,
    },
  });

  // Send verification email
  await sendVerificationEmail(
    user.email,
    plainVerificationToken,
    user.firstName || user.username || undefined,
    userId
  );
}
