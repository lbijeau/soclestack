import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock prisma with $transaction support
vi.mock('@/lib/db', () => ({
  prisma: {
    emailLog: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        emailLog: {
          create: vi.fn(),
          update: vi.fn(),
        },
      })
    ),
  },
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    email: {
      sent: vi.fn(),
      failed: vi.fn(),
    },
  },
}));

// Mock env - default to test/dev mode
vi.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    RESEND_API_KEY: undefined,
    EMAIL_FROM: 'test@example.com',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

// Mock Resend - use a class to properly mock the constructor
const mockResendSend = vi.fn();
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: mockResendSend,
    };
  },
}));

// Mock email templates
vi.mock('@/lib/email/templates', () => ({
  newDeviceAlertTemplate: vi.fn(() => ({
    subject: 'Test',
    html: '<p>Test</p>',
  })),
  accountLockedTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  passwordChangedTemplate: vi.fn(() => ({
    subject: 'Test',
    html: '<p>Test</p>',
  })),
  emailChangedTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  twoFactorEnabledTemplate: vi.fn(() => ({
    subject: 'Test',
    html: '<p>Test</p>',
  })),
  twoFactorDisabledTemplate: vi.fn(() => ({
    subject: 'Test',
    html: '<p>Test</p>',
  })),
  emailVerificationTemplate: vi.fn(() => ({
    subject: 'Test',
    html: '<p>Test</p>',
  })),
  accountUnlockTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  passwordResetTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  organizationInviteTemplate: vi.fn(() => ({
    subject: 'Test',
    html: '<p>Test</p>',
  })),
}));

// Import after mocks are set up
import {
  sendEmail,
  resendEmail,
  SendEmailOptions,
  EMAIL_TYPES,
  sendVerificationEmail,
  sendPasswordResetEmail,
  _resetResendClient,
} from '@/lib/email';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

describe('Email Service', () => {
  const mockEmailLog = prisma.emailLog as {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };

  const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env to test mode
    (env as { NODE_ENV: string }).NODE_ENV = 'test';
    (env as { RESEND_API_KEY: string | undefined }).RESEND_API_KEY = undefined;
    // Reset lazy-initialized Resend client
    _resetResendClient();

    // Setup default transaction mock
    mockTransaction.mockImplementation(async (callback) => {
      const txMock = {
        emailLog: {
          create: vi.fn().mockResolvedValue({
            id: 'log-123',
            status: 'PENDING',
            attempts: 0,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(txMock);
    });

    mockEmailLog.update.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('EMAIL_TYPES', () => {
    it('should export valid email types', () => {
      expect(EMAIL_TYPES).toContain('verification');
      expect(EMAIL_TYPES).toContain('password_reset');
      expect(EMAIL_TYPES).toContain('invite');
      expect(EMAIL_TYPES).toContain('new_device_alert');
      expect(EMAIL_TYPES).toContain('account_locked');
      expect(EMAIL_TYPES).toContain('password_changed');
      expect(EMAIL_TYPES).toContain('email_changed');
      expect(EMAIL_TYPES).toContain('2fa_enabled');
      expect(EMAIL_TYPES).toContain('2fa_disabled');
      expect(EMAIL_TYPES).toContain('account_unlock');
    });

    it('should have exactly 10 email types', () => {
      expect(EMAIL_TYPES).toHaveLength(10);
    });
  });

  describe('sendEmail', () => {
    const defaultOptions: SendEmailOptions = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
      type: 'verification',
    };

    it('should create email log entry in transaction before attempting send', async () => {
      let capturedData: unknown;
      mockTransaction.mockImplementation(async (callback) => {
        const txMock = {
          emailLog: {
            create: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({
                id: 'log-123',
                ...args.data,
              });
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });

      await sendEmail(defaultOptions);

      expect(capturedData).toEqual({
        to: defaultOptions.to,
        subject: defaultOptions.subject,
        htmlBody: defaultOptions.html,
        type: defaultOptions.type,
        userId: null,
        status: 'PENDING',
        attempts: 0,
      });
    });

    it('should link email to user when userId is provided', async () => {
      const optionsWithUser: SendEmailOptions = {
        ...defaultOptions,
        userId: 'user-456',
      };

      let capturedData: unknown;
      mockTransaction.mockImplementation(async (callback) => {
        const txMock = {
          emailLog: {
            create: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({
                id: 'log-123',
                ...args.data,
              });
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });

      await sendEmail(optionsWithUser);

      expect((capturedData as { userId: string }).userId).toBe('user-456');
    });

    it('should update log to SENT on success in dev mode', async () => {
      const result = await sendEmail(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.emailLogId).toBe('log-123');

      // Check that status was updated to SENT
      expect(mockEmailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
          attempts: 1,
        }),
      });
    });

    it('should return emailLogId in result', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const txMock = {
          emailLog: {
            create: vi.fn().mockResolvedValue({
              id: 'log-abc-123',
              status: 'PENDING',
              attempts: 0,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });

      const result = await sendEmail(defaultOptions);

      expect(result.emailLogId).toBe('log-abc-123');
    });

    it('should combine attempts and status in single write on success', async () => {
      await sendEmail(defaultOptions);

      // Should be a single update with both attempts and status
      expect(mockEmailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: expect.objectContaining({
          status: 'SENT',
          attempts: 1,
        }),
      });
    });
  });

  describe('sendEmail - dev mode behavior', () => {
    const defaultOptions: SendEmailOptions = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
      type: 'verification',
    };

    it('should succeed without Resend in dev mode', async () => {
      (env as { NODE_ENV: string }).NODE_ENV = 'development';
      (env as { RESEND_API_KEY: string | undefined }).RESEND_API_KEY =
        undefined;

      const result = await sendEmail(defaultOptions);

      expect(result.success).toBe(true);
    });

    it('should generate dev providerId in non-production', async () => {
      (env as { NODE_ENV: string }).NODE_ENV = 'test';

      await sendEmail(defaultOptions);

      const sentUpdate = mockEmailLog.update.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { data: { status?: string } }).data.status === 'SENT'
      );
      expect(
        (sentUpdate![0] as { data: { providerId: string } }).data.providerId
      ).toMatch(/^dev-\d+$/);
    });
  });

  describe('sendEmail - production mode with retries', () => {
    const defaultOptions: SendEmailOptions = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
      type: 'verification',
    };

    beforeEach(() => {
      vi.useFakeTimers();
      (env as { NODE_ENV: string }).NODE_ENV = 'production';
      (env as { RESEND_API_KEY: string | undefined }).RESEND_API_KEY =
        'test-api-key';
      // Reset the lazy-initialized Resend client so it picks up the mocked API key
      _resetResendClient();
    });

    it('should retry up to 3 times on failure and mark as FAILED', async () => {
      mockResendSend.mockResolvedValue({ error: { message: 'API Error' } });

      const resultPromise = sendEmail(defaultOptions);

      // Advance through all backoff delays
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');

      // Should have final FAILED status update
      const failedUpdate = mockEmailLog.update.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { data: { status?: string } }).data.status === 'FAILED'
      );
      expect(failedUpdate).toBeDefined();
    });

    it('should succeed on third retry attempt', async () => {
      mockResendSend
        .mockResolvedValueOnce({ error: { message: 'Error 1' } })
        .mockResolvedValueOnce({ error: { message: 'Error 2' } })
        .mockResolvedValueOnce({ data: { id: 'provider-msg-123' } });

      const resultPromise = sendEmail(defaultOptions);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledTimes(3);
    });

    it('should record providerId from Resend on success', async () => {
      mockResendSend.mockResolvedValue({ data: { id: 'resend-msg-456' } });

      await sendEmail(defaultOptions);

      expect(mockEmailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: expect.objectContaining({
          status: 'SENT',
          providerId: 'resend-msg-456',
        }),
      });
    });

    it('should record lastError on each retry failure', async () => {
      mockResendSend.mockResolvedValue({
        error: { message: 'Rate limit exceeded' },
      });

      const resultPromise = sendEmail(defaultOptions);
      await vi.advanceTimersByTimeAsync(10000);
      await resultPromise;

      const errorUpdates = mockEmailLog.update.mock.calls.filter(
        (call: unknown[]) =>
          (call[0] as { data: { lastError?: string } }).data.lastError !==
          undefined
      );
      expect(errorUpdates.length).toBeGreaterThan(0);
      expect(
        (errorUpdates[0][0] as { data: { lastError: string } }).data.lastError
      ).toBe('Rate limit exceeded');
    });

    it('should handle Resend throwing exception', async () => {
      mockResendSend.mockRejectedValue(new Error('Network timeout'));

      const resultPromise = sendEmail(defaultOptions);
      await vi.advanceTimersByTimeAsync(10000);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('resendEmail', () => {
    beforeEach(() => {
      // Reset transaction mock for resendEmail tests
      mockTransaction.mockImplementation(async (callback) => {
        const txMock = {
          emailLog: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });
    });

    it('should return error if email log not found', async () => {
      mockEmailLog.findUnique.mockResolvedValue(null);

      const result = await resendEmail('nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email log not found');
    });

    it('should reset status to PENDING in transaction before retrying', async () => {
      mockEmailLog.findUnique.mockResolvedValue({
        id: 'log-123',
        to: 'user@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        type: 'verification',
        status: 'FAILED',
        attempts: 3,
      });

      let capturedData: unknown;
      mockTransaction.mockImplementation(async (callback) => {
        const txMock = {
          emailLog: {
            update: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({});
            }),
          },
        };
        return callback(txMock);
      });

      await resendEmail('log-123');

      expect(capturedData).toEqual({
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        sentAt: null,
        providerId: null,
      });
    });

    it('should retry failed email and succeed', async () => {
      mockEmailLog.findUnique.mockResolvedValue({
        id: 'log-123',
        to: 'user@example.com',
        subject: 'Test Subject',
        htmlBody: '<p>Test body</p>',
        type: 'verification',
        status: 'FAILED',
        attempts: 3,
      });

      (env as { NODE_ENV: string }).NODE_ENV = 'test';

      const result = await resendEmail('log-123');

      expect(result.success).toBe(true);
      expect(result.emailLogId).toBe('log-123');
    });

    it('should update to SENT on successful resend', async () => {
      mockEmailLog.findUnique.mockResolvedValue({
        id: 'log-123',
        to: 'user@example.com',
        subject: 'Test Subject',
        htmlBody: '<p>Test body</p>',
        type: 'verification',
        status: 'FAILED',
        attempts: 3,
      });

      (env as { NODE_ENV: string }).NODE_ENV = 'test';

      await resendEmail('log-123');

      const sentUpdate = mockEmailLog.update.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { data: { status?: string } }).data.status === 'SENT'
      );
      expect(sentUpdate).toBeDefined();
      expect(
        (sentUpdate![0] as { data: { sentAt: Date } }).data.sentAt
      ).toBeInstanceOf(Date);
    });
  });

  describe('helper functions', () => {
    beforeEach(() => {
      mockTransaction.mockImplementation(async (callback) => {
        const txMock = {
          emailLog: {
            create: vi.fn().mockResolvedValue({
              id: 'log-123',
              status: 'PENDING',
              attempts: 0,
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });
    });

    it('sendVerificationEmail should use correct type', async () => {
      const result = await sendVerificationEmail(
        'user@example.com',
        'token-123',
        'John'
      );

      expect(result).toBe(true);
    });

    it('sendPasswordResetEmail should use correct type', async () => {
      const result = await sendPasswordResetEmail(
        'user@example.com',
        'token-456',
        'Jane'
      );

      expect(result).toBe(true);
    });

    it('helper functions should pass userId when provided', async () => {
      let capturedData: unknown;
      mockTransaction.mockImplementation(async (callback) => {
        const txMock = {
          emailLog: {
            create: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({
                id: 'log-123',
                ...args.data,
              });
            }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(txMock);
      });

      await sendVerificationEmail(
        'user@example.com',
        'token-123',
        'John',
        'user-789'
      );

      expect((capturedData as { userId: string }).userId).toBe('user-789');
    });
  });
});
