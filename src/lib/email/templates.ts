import { DeviceInfo } from '@/lib/utils/user-agent';

const APP_NAME = 'SocleStack';

function wrapTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
    <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 20px 0;">${APP_NAME}</h1>
    ${content}
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    <p style="color: #666; font-size: 12px; margin: 0;">
      This is an automated security notification from ${APP_NAME}.
      If you have questions, please contact support.
    </p>
  </div>
</body>
</html>
  `.trim();
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export interface NewDeviceAlertData {
  deviceInfo: DeviceInfo;
  ipAddress: string;
  loginTime: Date;
}

export function newDeviceAlertTemplate(data: NewDeviceAlertData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #d97706; font-size: 20px; margin: 0 0 15px 0;">New Login Detected</h2>
    <p style="margin: 0 0 15px 0;">
      We noticed a login to your account from a new device or location.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #d97706; margin: 0 0 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Browser:</strong> ${data.deviceInfo.browser}</p>
      <p style="margin: 0 0 8px 0;"><strong>Operating System:</strong> ${data.deviceInfo.os}</p>
      <p style="margin: 0 0 8px 0;"><strong>IP Address:</strong> ${data.ipAddress}</p>
      <p style="margin: 0;"><strong>Time:</strong> ${formatDateTime(data.loginTime)}</p>
    </div>
    <p style="margin: 0 0 15px 0; color: #dc2626; font-weight: 500;">
      If this wasn't you, please change your password immediately and enable two-factor authentication.
    </p>
  `;

  return {
    subject: `New login to your ${APP_NAME} account`,
    html: wrapTemplate('New Login Detected', content),
  };
}

export interface AccountLockedData {
  unlockTime: Date;
  reason: string;
}

export function accountLockedTemplate(data: AccountLockedData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #dc2626; font-size: 20px; margin: 0 0 15px 0;">Account Locked</h2>
    <p style="margin: 0 0 15px 0;">
      Your account has been temporarily locked due to ${data.reason}.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #dc2626; margin: 0 0 20px 0;">
      <p style="margin: 0;"><strong>Your account will be unlocked at:</strong> ${formatDateTime(data.unlockTime)}</p>
    </div>
    <p style="margin: 0 0 15px 0;">
      If you did not attempt to log in, someone may be trying to access your account.
      We recommend changing your password after your account is unlocked.
    </p>
  `;

  return {
    subject: `Your ${APP_NAME} account has been locked`,
    html: wrapTemplate('Account Locked', content),
  };
}

export interface PasswordChangedData {
  changedAt: Date;
}

export function passwordChangedTemplate(data: PasswordChangedData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #2563eb; font-size: 20px; margin: 0 0 15px 0;">Password Changed</h2>
    <p style="margin: 0 0 15px 0;">
      Your password was successfully changed.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 0 0 20px 0;">
      <p style="margin: 0;"><strong>Changed at:</strong> ${formatDateTime(data.changedAt)}</p>
    </div>
    <p style="margin: 0 0 15px 0; color: #dc2626; font-weight: 500;">
      If you didn't make this change, please reset your password immediately and contact support.
    </p>
  `;

  return {
    subject: `Your ${APP_NAME} password was changed`,
    html: wrapTemplate('Password Changed', content),
  };
}

export function twoFactorEnabledTemplate(): { subject: string; html: string } {
  const content = `
    <h2 style="color: #16a34a; font-size: 20px; margin: 0 0 15px 0;">Two-Factor Authentication Enabled</h2>
    <p style="margin: 0 0 15px 0;">
      Two-factor authentication has been successfully enabled on your account.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #16a34a; margin: 0 0 20px 0;">
      <p style="margin: 0;">
        Your account is now more secure. You'll need to enter a verification code from your authenticator app each time you log in.
      </p>
    </div>
    <p style="margin: 0 0 15px 0;">
      Make sure to keep your backup codes in a safe place in case you lose access to your authenticator app.
    </p>
  `;

  return {
    subject: `Two-factor authentication enabled on your ${APP_NAME} account`,
    html: wrapTemplate('Two-Factor Authentication Enabled', content),
  };
}

export function twoFactorDisabledTemplate(): { subject: string; html: string } {
  const content = `
    <h2 style="color: #d97706; font-size: 20px; margin: 0 0 15px 0;">Two-Factor Authentication Disabled</h2>
    <p style="margin: 0 0 15px 0;">
      Two-factor authentication has been disabled on your account.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #d97706; margin: 0 0 20px 0;">
      <p style="margin: 0;">
        Your account is now less secure. We strongly recommend keeping two-factor authentication enabled.
      </p>
    </div>
    <p style="margin: 0 0 15px 0; color: #dc2626; font-weight: 500;">
      If you didn't make this change, please secure your account immediately by changing your password and re-enabling two-factor authentication.
    </p>
  `;

  return {
    subject: `Two-factor authentication disabled on your ${APP_NAME} account`,
    html: wrapTemplate('Two-Factor Authentication Disabled', content),
  };
}

export interface OrganizationInviteData {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  expiresAt: Date;
}

export interface EmailVerificationData {
  verificationUrl: string;
  name?: string;
}

export interface AccountUnlockData {
  unlockUrl: string;
  lockedUntil: Date;
  name?: string;
}

export function accountUnlockTemplate(data: AccountUnlockData): { subject: string; html: string } {
  const greeting = data.name ? `Hi ${data.name},` : 'Hello,';
  const content = `
    <h2 style="color: #2563eb; font-size: 20px; margin: 0 0 15px 0;">Unlock Your Account</h2>
    <p style="margin: 0 0 15px 0;">
      ${greeting}
    </p>
    <p style="margin: 0 0 15px 0;">
      You requested to unlock your ${APP_NAME} account. Your account is currently locked until ${formatDateTime(data.lockedUntil)}.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 0 0 20px 0;">
      <p style="margin: 0 0 15px 0;">Click the button below to unlock your account immediately:</p>
      <a href="${data.unlockUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
        Unlock My Account
      </a>
    </div>
    <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 15px 0; word-break: break-all; font-size: 14px;">
      <a href="${data.unlockUrl}" style="color: #2563eb;">${data.unlockUrl}</a>
    </p>
    <p style="margin: 0 0 15px 0; color: #dc2626; font-weight: 500;">
      This link expires in 1 hour. If you didn't request this, please ignore this email and consider changing your password.
    </p>
  `;

  return {
    subject: `Unlock your ${APP_NAME} account`,
    html: wrapTemplate('Account Unlock', content),
  };
}

export function emailVerificationTemplate(data: EmailVerificationData): { subject: string; html: string } {
  const greeting = data.name ? `Hi ${data.name},` : 'Hello,';
  const content = `
    <h2 style="color: #2563eb; font-size: 20px; margin: 0 0 15px 0;">Verify Your Email Address</h2>
    <p style="margin: 0 0 15px 0;">
      ${greeting}
    </p>
    <p style="margin: 0 0 15px 0;">
      Please verify your email address to complete your ${APP_NAME} account setup and access all features.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 0 0 20px 0;">
      <p style="margin: 0 0 15px 0;">Click the button below to verify your email:</p>
      <a href="${data.verificationUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
        Verify Email Address
      </a>
    </div>
    <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 15px 0; word-break: break-all; font-size: 14px;">
      <a href="${data.verificationUrl}" style="color: #2563eb;">${data.verificationUrl}</a>
    </p>
    <p style="margin: 0; color: #666; font-size: 14px;">
      This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
    </p>
  `;

  return {
    subject: `Verify your email for ${APP_NAME}`,
    html: wrapTemplate('Email Verification', content),
  };
}

export function organizationInviteTemplate(data: OrganizationInviteData): { subject: string; html: string } {
  const content = `
    <h2 style="color: #2563eb; font-size: 20px; margin: 0 0 15px 0;">You're Invited!</h2>
    <p style="margin: 0 0 15px 0;">
      ${data.inviterName} has invited you to join <strong>${data.organizationName}</strong> on ${APP_NAME}.
    </p>
    <div style="background-color: #fff; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb; margin: 0 0 20px 0;">
      <p style="margin: 0 0 15px 0;">Click the button below to accept the invitation and create your account:</p>
      <a href="${data.inviteUrl}" style="display: inline-block; background-color: #2563eb; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
        Accept Invitation
      </a>
    </div>
    <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="margin: 0 0 15px 0; word-break: break-all; font-size: 14px;">
      <a href="${data.inviteUrl}" style="color: #2563eb;">${data.inviteUrl}</a>
    </p>
    <p style="margin: 0; color: #666; font-size: 14px;">
      This invitation expires on ${formatDateTime(data.expiresAt)}.
    </p>
  `;

  return {
    subject: `You've been invited to join ${data.organizationName}`,
    html: wrapTemplate('Organization Invitation', content),
  };
}
