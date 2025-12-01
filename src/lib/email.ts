import { Resend } from 'resend';
import { DeviceInfo } from '@/lib/utils/user-agent';
import { prisma } from '@/lib/db';
import {
  newDeviceAlertTemplate,
  accountLockedTemplate,
  passwordChangedTemplate,
  twoFactorEnabledTemplate,
  twoFactorDisabledTemplate,
} from '@/lib/email/templates';

export { organizationInviteTemplate } from '@/lib/email/templates';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@soclestack.com';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // In development, just log to console
  if (process.env.NODE_ENV !== 'production') {
    console.log('=== EMAIL (DEV MODE) ===');
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    console.log('HTML:', options.html.substring(0, 500) + '...');
    console.log('========================');
    return true;
  }

  // In production, use Resend
  if (!resend) {
    console.error('Email sending failed: RESEND_API_KEY not configured');
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
      console.error('Email sending failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email sending error:', error);
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
  const { subject, html } = newDeviceAlertTemplate({ deviceInfo, ipAddress, loginTime });
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

export async function sendTwoFactorEnabledNotification(to: string): Promise<boolean> {
  const { subject, html } = twoFactorEnabledTemplate();
  return sendEmail({ to, subject, html });
}

export async function sendTwoFactorDisabledNotification(to: string): Promise<boolean> {
  const { subject, html } = twoFactorDisabledTemplate();
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
