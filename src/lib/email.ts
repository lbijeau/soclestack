import { Resend } from 'resend';
import { DeviceInfo } from '@/lib/utils/user-agent';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import log from '@/lib/logger';
import {
  newDeviceAlertTemplate,
  accountLockedTemplate,
  passwordChangedTemplate,
  emailChangedTemplate,
  twoFactorEnabledTemplate,
  twoFactorDisabledTemplate,
  emailVerificationTemplate,
  accountUnlockTemplate,
  passwordResetTemplate,
} from '@/lib/email/templates';

export { organizationInviteTemplate } from '@/lib/email/templates';

// Lazy initialization to support mocking in tests
let _resend: Resend | null | undefined;
function getResendClient(): Resend | null {
  if (_resend === undefined) {
    _resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  }
  return _resend;
}

// Reset function for testing
export function _resetResendClient(): void {
  _resend = undefined;
}

const EMAIL_FROM = env.EMAIL_FROM || 'noreply@soclestack.com';

// Retry configuration
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000]; // Exponential backoff

// Valid email types for validation
export const EMAIL_TYPES = [
  'verification',
  'password_reset',
  'invite',
  'new_device_alert',
  'account_locked',
  'password_changed',
  'email_changed',
  '2fa_enabled',
  '2fa_disabled',
  'account_unlock',
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  type: EmailType;
  userId?: string; // Optional user link
}

export interface SendEmailResult {
  success: boolean;
  emailLogId?: string;
  error?: string;
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to send an email via Resend provider
 * Returns { success, providerId?, error? }
 */
async function attemptSend(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  // In development/test, simulate success
  if (env.NODE_ENV !== 'production') {
    log.debug('Email sent (dev mode)', {
      to,
      subject,
      htmlPreview: html.substring(0, 200),
    });
    return { success: true, providerId: `dev-${Date.now()}` };
  }

  // In production, use Resend
  const resendClient = getResendClient();
  if (!resendClient) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, providerId: data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute email send with retry logic.
 * Shared implementation for sendEmail and resendEmail.
 */
async function executeWithRetry(
  emailLogId: string,
  to: string,
  subject: string,
  html: string,
  type: EmailType
): Promise<SendEmailResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await attemptSend(to, subject, html);

    if (result.success) {
      // Success - update log to SENT in a single write
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerId: result.providerId || null,
          lastError: null,
          attempts: attempt + 1,
        },
      });

      log.email.sent(type, to);
      return { success: true, emailLogId };
    }

    // Failed - record error and attempt count in single write
    lastError = result.error;
    await prisma.emailLog.update({
      where: { id: emailLogId },
      data: {
        lastError,
        attempts: attempt + 1,
      },
    });

    log.email.failed(type, to, lastError || 'Unknown error');

    // If not the last attempt, wait before retrying
    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(BACKOFF_MS[attempt]);
    }
  }

  // All retries exhausted - mark as FAILED
  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: { status: 'FAILED' },
  });

  return {
    success: false,
    emailLogId,
    error: lastError || 'Max retries exceeded',
  };
}

/**
 * Send an email with logging and retry logic.
 * 1. Creates EmailLog entry with status PENDING (in transaction)
 * 2. Attempts send via Resend
 * 3. On success: Updates to SENT with providerId
 * 4. On failure: Retries up to 3 times with backoff
 * 5. After 3 failures: Updates to FAILED
 */
export async function sendEmail(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const { to, subject, html, type, userId } = options;

  // Create email log entry with PENDING status
  const emailLog = await prisma.emailLog.create({
    data: {
      to,
      subject,
      htmlBody: html,
      type,
      userId: userId || null,
      status: 'PENDING',
      attempts: 0,
    },
  });

  return executeWithRetry(emailLog.id, to, subject, html, type);
}

/**
 * Resend a previously failed email.
 * Only FAILED or BOUNCED emails can be resent.
 * Resets status to PENDING and attempts to 0, then runs through send flow.
 */
export async function resendEmail(
  emailLogId: string
): Promise<SendEmailResult> {
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
  });

  if (!emailLog) {
    return { success: false, error: 'Email log not found' };
  }

  // Only allow resending failed or bounced emails
  if (emailLog.status !== 'FAILED' && emailLog.status !== 'BOUNCED') {
    return {
      success: false,
      error: `Cannot resend email with status ${emailLog.status}`,
    };
  }

  // Reset status and attempts
  await prisma.emailLog.update({
    where: { id: emailLogId },
    data: {
      status: 'PENDING',
      attempts: 0,
      lastError: null,
      sentAt: null,
      providerId: null,
    },
  });

  return executeWithRetry(
    emailLogId,
    emailLog.to,
    emailLog.subject,
    emailLog.htmlBody,
    emailLog.type as EmailType
  );
}

// Convenience functions for specific notification types

export async function sendNewDeviceAlert(
  to: string,
  deviceInfo: DeviceInfo,
  ipAddress: string,
  loginTime: Date,
  userId?: string
): Promise<boolean> {
  const { subject, html } = newDeviceAlertTemplate({
    deviceInfo,
    ipAddress,
    loginTime,
  });
  const result = await sendEmail({
    to,
    subject,
    html,
    type: 'new_device_alert',
    userId,
  });
  return result.success;
}

export async function sendAccountLockedNotification(
  to: string,
  unlockTime: Date,
  reason: string = 'too many failed login attempts',
  userId?: string
): Promise<boolean> {
  const { subject, html } = accountLockedTemplate({ unlockTime, reason });
  const result = await sendEmail({
    to,
    subject,
    html,
    type: 'account_locked',
    userId,
  });
  return result.success;
}

export async function sendPasswordChangedNotification(
  to: string,
  changedAt: Date,
  userId?: string
): Promise<boolean> {
  const { subject, html } = passwordChangedTemplate({ changedAt });
  const result = await sendEmail({
    to,
    subject,
    html,
    type: 'password_changed',
    userId,
  });
  return result.success;
}

export async function sendEmailChangedNotification(
  to: string,
  newEmail: string,
  changedAt: Date,
  userId?: string
): Promise<boolean> {
  const { subject, html } = emailChangedTemplate({ newEmail, changedAt });
  const result = await sendEmail({
    to,
    subject,
    html,
    type: 'email_changed',
    userId,
  });
  return result.success;
}

export async function sendTwoFactorEnabledNotification(
  to: string,
  userId?: string
): Promise<boolean> {
  const { subject, html } = twoFactorEnabledTemplate();
  const result = await sendEmail({
    to,
    subject,
    html,
    type: '2fa_enabled',
    userId,
  });
  return result.success;
}

export async function sendTwoFactorDisabledNotification(
  to: string,
  userId?: string
): Promise<boolean> {
  const { subject, html } = twoFactorDisabledTemplate();
  const result = await sendEmail({
    to,
    subject,
    html,
    type: '2fa_disabled',
    userId,
  });
  return result.success;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  name?: string,
  userId?: string
): Promise<boolean> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  const { subject, html } = emailVerificationTemplate({
    verificationUrl,
    name,
  });
  const result = await sendEmail({
    to,
    subject,
    html,
    type: 'verification',
    userId,
  });
  return result.success;
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  name?: string,
  userId?: string
): Promise<boolean> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const { subject, html } = passwordResetTemplate({
    resetUrl,
    name,
  });
  const result = await sendEmail({
    to,
    subject,
    html,
    type: 'password_reset',
    userId,
  });
  return result.success;
}

export async function sendUnlockEmail(
  to: string,
  token: string,
  lockedUntil: Date,
  name?: string,
  userId?: string
): Promise<boolean> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  const unlockUrl = `${baseUrl}/unlock-account?token=${token}`;
  const { subject, html } = accountUnlockTemplate({
    unlockUrl,
    lockedUntil,
    name,
  });
  const result = await sendEmail({
    to,
    subject,
    html,
    type: 'account_unlock',
    userId,
  });
  return result.success;
}

// Check if device (IP + user-agent combination) is known for a user
export async function isKnownDevice(
  userId: string,
  ipAddress: string | undefined,
  userAgent: string | undefined
): Promise<boolean> {
  if (!ipAddress || !userAgent) {
    return false; // Can't determine if unknown without both
  }

  // Check RememberMeToken table first
  const knownToken = await prisma.rememberMeToken.findFirst({
    where: {
      userId,
      ipAddress,
      userAgent,
    },
  });

  if (knownToken) {
    return true;
  }

  // Check AuditLog for successful logins in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const knownAuditLog = await prisma.auditLog.findFirst({
    where: {
      userId,
      action: 'AUTH_LOGIN_SUCCESS',
      ipAddress,
      userAgent,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  return !!knownAuditLog;
}
