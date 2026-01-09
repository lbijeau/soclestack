import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    emailLog: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
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

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn(),
    },
  })),
}));

// Mock email templates
vi.mock('@/lib/email/templates', () => ({
  newDeviceAlertTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  accountLockedTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  passwordChangedTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  emailChangedTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  twoFactorEnabledTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  twoFactorDisabledTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  emailVerificationTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  accountUnlockTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  passwordResetTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
  organizationInviteTemplate: vi.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })),
}));

// Import after mocks are set up
import { sendEmail, resendEmail, SendEmailOptions } from '@/lib/email';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

describe('Email Service', () => {
  const mockEmailLog = prisma.emailLog as {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset env to test mode
    (env as { NODE_ENV: string }).NODE_ENV = 'test';
    (env as { RESEND_API_KEY: string | undefined }).RESEND_API_KEY = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sendEmail', () => {
    const defaultOptions: SendEmailOptions = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
      type: 'verification',
    };

    it('should create email log entry before attempting send', async () => {
      mockEmailLog.create.mockResolvedValue({
        id: 'log-123',
        to: defaultOptions.to,
        subject: defaultOptions.subject,
        htmlBody: defaultOptions.html,
        type: defaultOptions.type,
        status: 'PENDING',
        attempts: 0,
      });

      mockEmailLog.update.mockResolvedValue({});

      await sendEmail(defaultOptions);

      expect(mockEmailLog.create).toHaveBeenCalledWith({
        data: {
          to: defaultOptions.to,
          subject: defaultOptions.subject,
          htmlBody: defaultOptions.html,
          type: defaultOptions.type,
          userId: null,
          status: 'PENDING',
          attempts: 0,
        },
      });
    });

    it('should link email to user when userId is provided', async () => {
      const optionsWithUser: SendEmailOptions = {
        ...defaultOptions,
        userId: 'user-456',
      };

      mockEmailLog.create.mockResolvedValue({
        id: 'log-123',
        ...optionsWithUser,
        status: 'PENDING',
        attempts: 0,
      });

      mockEmailLog.update.mockResolvedValue({});

      await sendEmail(optionsWithUser);

      expect(mockEmailLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-456',
        }),
      });
    });

    it('should update log to SENT on success in dev mode', async () => {
      mockEmailLog.create.mockResolvedValue({
        id: 'log-123',
        status: 'PENDING',
        attempts: 0,
      });

      mockEmailLog.update.mockResolvedValue({});

      const result = await sendEmail(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.emailLogId).toBe('log-123');

      // Check that status was updated to SENT
      expect(mockEmailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
        }),
      });
    });

    it('should return emailLogId in result', async () => {
      mockEmailLog.create.mockResolvedValue({
        id: 'log-abc-123',
        status: 'PENDING',
        attempts: 0,
      });

      mockEmailLog.update.mockResolvedValue({});

      const result = await sendEmail(defaultOptions);

      expect(result.emailLogId).toBe('log-abc-123');
    });

    it('should increment attempts on each send attempt', async () => {
      mockEmailLog.create.mockResolvedValue({
        id: 'log-123',
        status: 'PENDING',
        attempts: 0,
      });

      mockEmailLog.update.mockResolvedValue({});

      await sendEmail(defaultOptions);

      // First update should set attempts to 1
      expect(mockEmailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: { attempts: 1 },
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
      (env as { RESEND_API_KEY: string | undefined }).RESEND_API_KEY = undefined;

      mockEmailLog.create.mockResolvedValue({
        id: 'log-123',
        status: 'PENDING',
        attempts: 0,
      });

      mockEmailLog.update.mockResolvedValue({});

      const result = await sendEmail(defaultOptions);

      expect(result.success).toBe(true);
    });

    it('should generate dev providerId in non-production', async () => {
      (env as { NODE_ENV: string }).NODE_ENV = 'test';

      mockEmailLog.create.mockResolvedValue({
        id: 'log-123',
        status: 'PENDING',
        attempts: 0,
      });

      mockEmailLog.update.mockResolvedValue({});

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

  describe('resendEmail', () => {
    it('should return error if email log not found', async () => {
      mockEmailLog.findUnique.mockResolvedValue(null);

      const result = await resendEmail('nonexistent-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email log not found');
    });

    it('should reset status to PENDING before retrying', async () => {
      mockEmailLog.findUnique.mockResolvedValue({
        id: 'log-123',
        to: 'user@example.com',
        subject: 'Test',
        htmlBody: '<p>Test</p>',
        type: 'verification',
        status: 'FAILED',
        attempts: 3,
      });

      mockEmailLog.update.mockResolvedValue({});

      await resendEmail('log-123');

      // First update should reset status
      expect(mockEmailLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: {
          status: 'PENDING',
          attempts: 0,
          lastError: null,
          sentAt: null,
          providerId: null,
        },
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

      mockEmailLog.update.mockResolvedValue({});

      // Dev mode - will succeed immediately
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

      mockEmailLog.update.mockResolvedValue({});
      (env as { NODE_ENV: string }).NODE_ENV = 'test';

      await resendEmail('log-123');

      // Check that status was updated to SENT
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
});
