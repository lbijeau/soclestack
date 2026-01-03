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
import {
  authenticateUser,
  createUserSession,
  isRateLimited,
} from '@/lib/auth';
import {
  checkAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
} from '@/lib/auth/lockout';
import {
  createRememberMeToken,
} from '@/lib/auth/remember-me';
import { createPending2FAToken, verifyPending2FAToken } from '@/lib/auth/pending-2fa';
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
import { sendNewDeviceAlert, isKnownDevice } from '@/lib/email';
import { parseUserAgent } from '@/lib/utils/user-agent';
import { generateCsrfToken } from '@/lib/csrf';
import { RequestContext } from '@/lib/api-utils';
import {
  hashPassword,
  generateResetToken,
  hashResetToken,
  timeSafeEqual,
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
  context: RequestContext
): Promise<LoginResult | TwoFactorRequired> {
  const { clientIP, userAgent } = context;

  // Rate limiting
  const rateLimitKey = `login:${clientIP}`;
  if (isRateLimited(rateLimitKey, 10, 15 * 60 * 1000)) {
    throw new RateLimitError('Too many login attempts. Please try again later.');
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

      throw new AccountLockedError(lockoutStatus.lockedUntil, retryAfterSeconds);
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

        throw new AccountLockedError(lockoutStatus.lockedUntil, retryAfterSeconds);
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
    userAgent
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
      new Date()
    ).catch((err) => console.error('Failed to send new device alert:', err));
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
  user: UserDTO & {
    organization: OrganizationDTO | null;
  };
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
  if (isRateLimited(rateLimitKey, 3, 60 * 60 * 1000)) {
    throw new RateLimitError('Too many registration attempts. Please try again later.');
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
          email: ['You must register with the email address the invite was sent to'],
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
    let organizationId: string | undefined;
    let organizationRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER';

    if (organizationName) {
      // Create new organization with user as OWNER
      const slug = await generateSlug(organizationName);
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
        },
      });
      organizationId = organization.id;
      organizationRole = 'OWNER';
    } else if (invite) {
      // Join existing organization with invite's role
      organizationId = invite.organizationId;
      organizationRole = invite.role;

      // Delete the invite
      await tx.organizationInvite.delete({
        where: { id: invite.id },
      });
    }

    // Create the user
    return tx.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        passwordChangedAt: new Date(),
        firstName,
        lastName,
        emailVerificationToken: hashedVerificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        organizationId,
        organizationRole,
      },
      include: {
        organization: true,
      },
    });
  });

  // TODO: Send email verification email
  // In a real application, you would send an email here
  console.log(`Email verification token for ${email}: ${plainVerificationToken}`);

  // Return success result
  return {
    message: 'Registration successful. Please check your email to verify your account.',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            slug: user.organization.slug,
            role: user.organizationRole || 'MEMBER',
          }
        : null,
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
  context: RequestContext
): Promise<Validate2FAResult> {
  const { clientIP, userAgent } = context;
  const { pendingToken, code, isBackupCode = false } = input;

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
  const tokens = await createUserSession(user, clientIP, userAgent);

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
      role: user.role,
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
 * @throws {ValidationError} 2FA already enabled
 * @throws {NotFoundError} User not found
 */
export async function setup2FA(userId: string): Promise<Setup2FAResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, twoFactorEnabled: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.twoFactorEnabled) {
    throw new ValidationError('2FA is already enabled');
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
 * @throws {ValidationError} 2FA not set up or already enabled
 * @throws {AuthenticationError} Invalid code
 */
export async function verify2FASetup(
  userId: string,
  code: string,
  context: RequestContext
): Promise<void> {
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

  // Send notification (fire-and-forget) - imported at top
  const { sendTwoFactorEnabledNotification } = await import('@/lib/email');
  sendTwoFactorEnabledNotification(user.email).catch((err) =>
    console.error('Failed to send 2FA enabled notification:', err)
  );
}

/**
 * Disable 2FA.
 *
 * @throws {ValidationError} 2FA not enabled
 * @throws {AuthenticationError} Invalid code
 * @throws {AuthorizationError} Admins cannot disable 2FA
 */
export async function disable2FA(
  userId: string,
  code: string,
  context: RequestContext
): Promise<void> {
  const { clientIP, userAgent } = context;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, twoFactorSecret: true, twoFactorEnabled: true, email: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Admins cannot disable their own 2FA
  if (user.role === 'ADMIN') {
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
    ipAddress: clientIP,
    userAgent,
  });

  // Send notification (fire-and-forget)
  const { sendTwoFactorDisabledNotification } = await import('@/lib/email');
  sendTwoFactorDisabledNotification(user.email).catch((err) =>
    console.error('Failed to send 2FA disabled notification:', err)
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
 * @returns Token for development (in production, send via email)
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput
): Promise<{ message: string; token?: string }> {
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

  // TODO: Send password reset email
  // In production, send email instead of returning token
  console.log(`Password reset token for ${email}: ${resetToken}`);

  return { message, token: resetToken };
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

/**
 * Reset password using a valid reset token.
 *
 * @throws {ValidationError} Invalid input
 * @throws {TokenExpiredError} Token expired or invalid
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

  // Hash the provided token to compare with stored hash
  const hashedToken = await hashResetToken(token);

  // Find user with unexpired reset token
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: { not: null },
      passwordResetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user || !user.passwordResetToken) {
    throw new TokenExpiredError('Invalid or expired reset token');
  }

  // Compare tokens in a time-safe manner
  if (!timeSafeEqual(hashedToken, user.passwordResetToken)) {
    throw new TokenExpiredError('Invalid or expired reset token');
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
  const { sendPasswordChangedNotification } = await import('@/lib/email');
  sendPasswordChangedNotification(user.email, new Date()).catch((err) =>
    console.error('Failed to send password changed notification:', err)
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
 * @throws {TokenExpiredError} Token expired or invalid
 */
export async function verifyEmail(input: VerifyEmailInput): Promise<void> {
  const { token } = input;

  if (!token) {
    throw new ValidationError('Verification token is required');
  }

  // Hash the provided token to compare with stored hash
  const hashedToken = await hashResetToken(token);

  // Find user with unexpired verification token
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: { not: null },
      emailVerificationExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user || !user.emailVerificationToken) {
    throw new TokenExpiredError('Invalid or expired verification token');
  }

  // Compare tokens in a time-safe manner
  if (!timeSafeEqual(hashedToken, user.emailVerificationToken)) {
    throw new TokenExpiredError('Invalid or expired verification token');
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
    select: { email: true, emailVerified: true, firstName: true, username: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.emailVerified) {
    throw new ValidationError('Email is already verified');
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
  const { sendVerificationEmail } = await import('@/lib/email');
  await sendVerificationEmail(
    user.email,
    plainVerificationToken,
    user.firstName || user.username || undefined
  );
}
