import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ValidationError,
  AuthenticationError,
  EmailNotVerifiedError,
  AccountLockedError,
  RateLimitError,
  TokenExpiredError,
  TokenInvalidError,
  NotFoundError,
  ConflictError,
} from '@/services/auth.errors';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      create: vi.fn(),
    },
    organizationInvite: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    passwordHistory: {
      create: vi.fn(),
    },
    userSession: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      user: { create: vi.fn() },
      organization: { create: vi.fn() },
      organizationInvite: { delete: vi.fn() },
    })),
  },
}));

vi.mock('@/lib/auth', () => ({
  authenticateUser: vi.fn(),
  createUserSession: vi.fn(),
  isRateLimited: vi.fn(),
  getRateLimitInfo: vi.fn().mockReturnValue({
    limit: 10,
    remaining: 0,
    reset: Math.floor(Date.now() / 1000) + 900,
  }),
}));

vi.mock('@/lib/auth/lockout', () => ({
  checkAccountLocked: vi.fn(),
  recordFailedAttempt: vi.fn(),
  resetFailedAttempts: vi.fn(),
}));

vi.mock('@/lib/auth/totp', () => ({
  verifyTOTPCode: vi.fn(),
  generateTOTPSecret: vi.fn(),
}));

vi.mock('@/lib/auth/backup-codes', () => ({
  verifyBackupCode: vi.fn(),
  getRemainingBackupCodeCount: vi.fn(),
  generateBackupCodes: vi.fn(),
  deleteAllBackupCodes: vi.fn(),
}));

vi.mock('@/lib/auth/pending-2fa', () => ({
  createPending2FAToken: vi.fn(),
  verifyPending2FAToken: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email', () => ({
  sendNewDeviceAlert: vi.fn().mockResolvedValue(undefined),
  isKnownDevice: vi.fn().mockResolvedValue(false),
  sendTwoFactorEnabledNotification: vi.fn().mockResolvedValue(undefined),
  sendTwoFactorDisabledNotification: vi.fn().mockResolvedValue(undefined),
  sendPasswordChangedNotification: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/security', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  generateResetToken: vi.fn().mockResolvedValue('reset_token'),
  hashResetToken: vi.fn().mockResolvedValue('hashed_reset_token'),
}));

vi.mock('@/lib/csrf', () => ({
  generateCsrfToken: vi.fn().mockReturnValue('csrf_token'),
}));

vi.mock('@/lib/organization', () => ({
  generateSlug: vi.fn().mockResolvedValue('org-slug'),
}));

// Import after mocks
import { prisma } from '@/lib/db';
import { authenticateUser, isRateLimited } from '@/lib/auth';
import { checkAccountLocked, recordFailedAttempt } from '@/lib/auth/lockout';
import { verifyTOTPCode, generateTOTPSecret } from '@/lib/auth/totp';
import { generateBackupCodes, deleteAllBackupCodes } from '@/lib/auth/backup-codes';
import {
  login,
  setup2FA,
  verify2FASetup,
  disable2FA,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from '@/services/auth.service';

describe('Auth Service Functions', () => {
  const mockContext = { clientIP: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should throw RateLimitError when rate limited', async () => {
      vi.mocked(isRateLimited).mockReturnValue(true);

      await expect(
        login({ email: 'test@example.com', password: 'password' }, mockContext)
      ).rejects.toThrow(RateLimitError);
    });

    it('should throw ValidationError for invalid input', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);

      await expect(
        login({ email: 'invalid-email', password: '' }, mockContext)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw AuthenticationError for invalid credentials', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(authenticateUser).mockResolvedValue(null);

      await expect(
        login({ email: 'test@example.com', password: 'wrong' }, mockContext)
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AccountLockedError when account is locked', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
      } as any);
      vi.mocked(checkAccountLocked).mockResolvedValue({
        isLocked: true,
        lockedUntil: new Date('2099-01-01'),
      });

      await expect(
        login({ email: 'test@example.com', password: 'password' }, mockContext)
      ).rejects.toThrow(AccountLockedError);
    });

    it('should throw EmailNotVerifiedError when email not verified', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
      } as any);
      vi.mocked(checkAccountLocked).mockResolvedValue({ isLocked: false });
      vi.mocked(authenticateUser).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        emailVerified: false,
      } as any);

      await expect(
        login({ email: 'test@example.com', password: 'password' }, mockContext)
      ).rejects.toThrow(EmailNotVerifiedError);
    });
  });

  describe('setup2FA', () => {
    it('should throw RateLimitError when rate limited', async () => {
      vi.mocked(isRateLimited).mockReturnValue(true);

      await expect(setup2FA('user-id', mockContext)).rejects.toThrow(RateLimitError);
    });

    it('should throw NotFoundError when user not found', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(setup2FA('user-id', mockContext)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when 2FA already enabled', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        twoFactorEnabled: true,
      } as any);

      await expect(setup2FA('user-id', mockContext)).rejects.toThrow(ConflictError);
    });

    it('should throw ImpersonationBlockedError when impersonating', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      const impersonatingContext = { ...mockContext, isImpersonating: true };

      await expect(setup2FA('user-id', impersonatingContext)).rejects.toThrow(
        'This action is not allowed while impersonating a user'
      );
    });

    it('should return QR code and backup codes on success', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        twoFactorEnabled: false,
      } as any);
      vi.mocked(generateTOTPSecret).mockResolvedValue({
        secret: 'secret',
        qrCodeDataUrl: 'data:image/png;base64,...',
        manualEntryKey: 'ABCD1234',
      });
      vi.mocked(generateBackupCodes).mockResolvedValue(['code1', 'code2']);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const result = await setup2FA('user-id', mockContext);

      expect(result.qrCodeDataUrl).toBe('data:image/png;base64,...');
      expect(result.manualEntryKey).toBe('ABCD1234');
      expect(result.backupCodes).toEqual(['code1', 'code2']);
    });
  });

  describe('verify2FASetup', () => {
    it('should throw ImpersonationBlockedError when impersonating', async () => {
      const impersonatingContext = { ...mockContext, isImpersonating: true };

      await expect(verify2FASetup('user-id', '123456', impersonatingContext)).rejects.toThrow(
        'This action is not allowed while impersonating a user'
      );
    });

    it('should throw ValidationError when 2FA setup not started', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(verify2FASetup('user-id', '123456', mockContext)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ConflictError when 2FA already enabled', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        twoFactorSecret: 'secret',
        twoFactorEnabled: true,
      } as any);

      await expect(verify2FASetup('user-id', '123456', mockContext)).rejects.toThrow(
        ConflictError
      );
    });

    it('should throw AuthenticationError for invalid code', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        twoFactorSecret: 'secret',
        twoFactorEnabled: false,
      } as any);
      vi.mocked(verifyTOTPCode).mockReturnValue(false);

      await expect(verify2FASetup('user-id', '123456', mockContext)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should enable 2FA on valid code', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        twoFactorSecret: 'secret',
        twoFactorEnabled: false,
      } as any);
      vi.mocked(verifyTOTPCode).mockReturnValue(true);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await expect(verify2FASetup('user-id', '123456', mockContext)).resolves.toBeUndefined();

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            twoFactorEnabled: true,
            twoFactorVerified: true,
          }),
        })
      );
    });
  });

  describe('disable2FA', () => {
    it('should throw RateLimitError when rate limited', async () => {
      vi.mocked(isRateLimited).mockReturnValue(true);

      await expect(disable2FA('user-id', '123456', mockContext)).rejects.toThrow(
        RateLimitError
      );
    });

    it('should throw NotFoundError when user not found', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(disable2FA('user-id', '123456', mockContext)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ImpersonationBlockedError when impersonating', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      const impersonatingContext = { ...mockContext, isImpersonating: true };

      await expect(disable2FA('user-id', '123456', impersonatingContext)).rejects.toThrow(
        'This action is not allowed while impersonating a user'
      );
    });

    it('should throw AuthorizationError when admin tries to disable', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        role: 'ADMIN',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      } as any);

      await expect(disable2FA('user-id', '123456', mockContext)).rejects.toThrow(
        'Admins cannot disable 2FA'
      );
    });

    it('should throw ValidationError when 2FA not enabled', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        role: 'USER',
        twoFactorEnabled: false,
        twoFactorSecret: null,
      } as any);

      await expect(disable2FA('user-id', '123456', mockContext)).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw AuthenticationError for invalid code', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        role: 'USER',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
        email: 'test@example.com',
      } as any);
      vi.mocked(verifyTOTPCode).mockReturnValue(false);

      await expect(disable2FA('user-id', '123456', mockContext)).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should disable 2FA on valid code', async () => {
      vi.mocked(isRateLimited).mockReturnValue(false);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        role: 'USER',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
        email: 'test@example.com',
      } as any);
      vi.mocked(verifyTOTPCode).mockReturnValue(true);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await expect(disable2FA('user-id', '123456', mockContext)).resolves.toBeUndefined();
      expect(deleteAllBackupCodes).toHaveBeenCalledWith('user-id');
    });
  });

  describe('requestPasswordReset', () => {
    it('should throw ValidationError for invalid email', async () => {
      await expect(
        requestPasswordReset({ email: 'invalid' }, mockContext)
      ).rejects.toThrow(ValidationError);
    });

    it('should return success message even if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await requestPasswordReset({ email: 'notfound@example.com' }, mockContext);

      expect(result.message).toContain('If an account with that email exists');
    });

    it('should generate token and update user when found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      const result = await requestPasswordReset({ email: 'test@example.com' }, mockContext);

      expect(result.message).toContain('If an account with that email exists');
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should throw ValidationError for invalid input', async () => {
      await expect(
        resetPassword({ token: '', password: 'short', confirmPassword: 'short' }, mockContext)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw TokenInvalidError for non-existent token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(
        resetPassword({ token: 'invalid-token', password: 'ValidPassword123!', confirmPassword: 'ValidPassword123!' }, mockContext)
      ).rejects.toThrow(TokenInvalidError);
    });

    it('should throw TokenExpiredError for expired token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'old_hash',
        passwordResetToken: 'hashed_reset_token',
        passwordResetExpires: new Date('2020-01-01'), // Expired date
      } as any);

      await expect(
        resetPassword({ token: 'expired-token', password: 'ValidPassword123!', confirmPassword: 'ValidPassword123!' }, mockContext)
      ).rejects.toThrow(TokenExpiredError);
    });

    it('should reset password on valid token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        password: 'old_hash',
        passwordResetToken: 'hashed_reset_token',
        passwordResetExpires: new Date('2099-01-01'), // Future date
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.passwordHistory.create).mockResolvedValue({} as any);
      vi.mocked(prisma.userSession.deleteMany).mockResolvedValue({} as any);

      await expect(
        resetPassword({ token: 'valid-token', password: 'NewPassword123!', confirmPassword: 'NewPassword123!' }, mockContext)
      ).resolves.toBeUndefined();

      expect(prisma.userSession.deleteMany).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should throw ValidationError for missing token', async () => {
      await expect(verifyEmail({ token: '' })).rejects.toThrow(ValidationError);
    });

    it('should throw TokenInvalidError for non-existent token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(verifyEmail({ token: 'invalid' })).rejects.toThrow(TokenInvalidError);
    });

    it('should throw TokenExpiredError for expired token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        emailVerificationToken: 'hashed_reset_token',
        emailVerificationExpires: new Date('2020-01-01'), // Expired date
      } as any);

      await expect(verifyEmail({ token: 'expired' })).rejects.toThrow(TokenExpiredError);
    });

    it('should verify email on valid token', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        emailVerificationToken: 'hashed_reset_token',
        emailVerificationExpires: new Date('2099-01-01'), // Future date
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await expect(verifyEmail({ token: 'valid' })).resolves.toBeUndefined();

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerified: true,
            emailVerificationToken: null,
          }),
        })
      );
    });
  });

  describe('resendVerificationEmail', () => {
    it('should throw NotFoundError when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(resendVerificationEmail('user-id')).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when email already verified', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        emailVerified: true,
      } as any);

      await expect(resendVerificationEmail('user-id')).rejects.toThrow(ConflictError);
    });

    it('should send verification email when not verified', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        emailVerified: false,
        firstName: 'Test',
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await expect(resendVerificationEmail('user-id')).resolves.toBeUndefined();

      expect(prisma.user.update).toHaveBeenCalled();
    });
  });
});
