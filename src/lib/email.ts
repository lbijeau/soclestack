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

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const EMAIL_FROM = env.EMAIL_FROM || 'noreply@soclestack.com';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // In development, just log email details
  if (env.NODE_ENV !== 'production') {
    log.debug('Email sent (dev mode)', {
      to: options.to,
      subject: options.subject,
      htmlPreview: options.html.substring(0, 200),
    });
    return true;
  }

  // In production, use Resend
  if (!resend) {
    log.error('Email sending failed: RESEND_API_KEY not configured', {
      category: 'email',
    });
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      log.email.failed('send', options.to, error.message);
      return false;
    }

    log.email.sent('send', options.to);
    return true;
  } catch (error) {
    log.email.failed('send', options.to, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Convenience functions for specific notification types

export async function sendNewDeviceAlert(
  to: string,
  deviceInfo: DeviceInfo,
  ipAddress: string,
  loginTime: Date
): Promise<boolean> {
  const { subject, html } = newDeviceAlertTemplate({
    deviceInfo,
    ipAddress,
    loginTime,
  });
  return sendEmail({ to, subject, html });
}

export async function sendAccountLockedNotification(
  to: string,
  unlockTime: Date,
  reason: string = 'too many failed login attempts'
): Promise<boolean> {
  const { subject, html } = accountLockedTemplate({ unlockTime, reason });
  return sendEmail({ to, subject, html });
}

export async function sendPasswordChangedNotification(
  to: string,
  changedAt: Date
): Promise<boolean> {
  const { subject, html } = passwordChangedTemplate({ changedAt });
  return sendEmail({ to, subject, html });
}

export async function sendEmailChangedNotification(
  to: string,
  newEmail: string,
  changedAt: Date
): Promise<boolean> {
  const { subject, html } = emailChangedTemplate({ newEmail, changedAt });
  return sendEmail({ to, subject, html });
}

export async function sendTwoFactorEnabledNotification(
  to: string
): Promise<boolean> {
  const { subject, html } = twoFactorEnabledTemplate();
  return sendEmail({ to, subject, html });
}

export async function sendTwoFactorDisabledNotification(
  to: string
): Promise<boolean> {
  const { subject, html } = twoFactorDisabledTemplate();
  return sendEmail({ to, subject, html });
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  name?: string
): Promise<boolean> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  const { subject, html } = emailVerificationTemplate({
    verificationUrl,
    name,
  });
  return sendEmail({ to, subject, html });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  name?: string
): Promise<boolean> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const { subject, html } = passwordResetTemplate({
    resetUrl,
    name,
  });
  return sendEmail({ to, subject, html });
}

export async function sendUnlockEmail(
  to: string,
  token: string,
  lockedUntil: Date,
  name?: string
): Promise<boolean> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  const unlockUrl = `${baseUrl}/unlock-account?token=${token}`;
  const { subject, html } = accountUnlockTemplate({
    unlockUrl,
    lockedUntil,
    name,
  });
  return sendEmail({ to, subject, html });
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
