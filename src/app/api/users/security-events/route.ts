import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

// Security-related audit actions to include
const SECURITY_ACTIONS = [
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILURE',
  'AUTH_LOGOUT',
  'SECURITY_PASSWORD_CHANGED',
  'AUTH_2FA_ENABLED',
  'AUTH_2FA_DISABLED',
  'AUTH_2FA_SUCCESS',
  'AUTH_2FA_FAILURE',
  'AUTH_2FA_BACKUP_USED',
  'SECURITY_ACCOUNT_LOCKED',
  'SECURITY_ACCOUNT_UNLOCKED',
  'SECURITY_DEVICE_REVOKED',
  'AUTH_OAUTH_ACCOUNT_LINKED',
  'AUTH_OAUTH_ACCOUNT_UNLINKED',
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
];

// GET /api/users/security-events - Get recent security events for current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { type: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const events = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
        action: { in: SECURITY_ACTIONS },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        createdAt: true,
        metadata: true,
      },
    });

    // Transform events to a more user-friendly format
    const formattedEvents = events.map((event) => ({
      id: event.id,
      action: event.action,
      description: getEventDescription(event.action),
      icon: getEventIcon(event.action),
      severity: getEventSeverity(event.action),
      ipAddress: event.ipAddress,
      createdAt: event.createdAt,
      metadata: event.metadata ? JSON.parse(event.metadata) : null,
    }));

    return NextResponse.json({ events: formattedEvents });
  } catch (error) {
    console.error('Failed to fetch security events:', error);
    return NextResponse.json(
      {
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to fetch security events',
        },
      },
      { status: 500 }
    );
  }
}

function getEventDescription(action: string): string {
  const descriptions: Record<string, string> = {
    AUTH_LOGIN_SUCCESS: 'Successful login',
    AUTH_LOGIN_FAILURE: 'Failed login attempt',
    AUTH_LOGOUT: 'Logged out',
    SECURITY_PASSWORD_CHANGED: 'Password changed',
    AUTH_2FA_ENABLED: 'Two-factor authentication enabled',
    AUTH_2FA_DISABLED: 'Two-factor authentication disabled',
    AUTH_2FA_SUCCESS: '2FA verification successful',
    AUTH_2FA_FAILURE: '2FA verification failed',
    AUTH_2FA_BACKUP_USED: 'Backup code used',
    SECURITY_ACCOUNT_LOCKED: 'Account locked',
    SECURITY_ACCOUNT_UNLOCKED: 'Account unlocked',
    SECURITY_DEVICE_REVOKED: 'Trusted device removed',
    AUTH_OAUTH_ACCOUNT_LINKED: 'OAuth account linked',
    AUTH_OAUTH_ACCOUNT_UNLINKED: 'OAuth account unlinked',
    API_KEY_CREATED: 'API key created',
    API_KEY_REVOKED: 'API key revoked',
  };
  return descriptions[action] || action;
}

function getEventIcon(action: string): string {
  const icons: Record<string, string> = {
    AUTH_LOGIN_SUCCESS: 'login',
    AUTH_LOGIN_FAILURE: 'alert',
    AUTH_LOGOUT: 'logout',
    SECURITY_PASSWORD_CHANGED: 'key',
    AUTH_2FA_ENABLED: 'shield-check',
    AUTH_2FA_DISABLED: 'shield-off',
    AUTH_2FA_SUCCESS: 'shield-check',
    AUTH_2FA_FAILURE: 'shield-alert',
    AUTH_2FA_BACKUP_USED: 'backup',
    SECURITY_ACCOUNT_LOCKED: 'lock',
    SECURITY_ACCOUNT_UNLOCKED: 'unlock',
    SECURITY_DEVICE_REVOKED: 'device',
    AUTH_OAUTH_ACCOUNT_LINKED: 'link',
    AUTH_OAUTH_ACCOUNT_UNLINKED: 'unlink',
    API_KEY_CREATED: 'key-plus',
    API_KEY_REVOKED: 'key-minus',
  };
  return icons[action] || 'info';
}

function getEventSeverity(
  action: string
): 'info' | 'success' | 'warning' | 'error' {
  const severities: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
    AUTH_LOGIN_SUCCESS: 'success',
    AUTH_LOGIN_FAILURE: 'warning',
    AUTH_LOGOUT: 'info',
    SECURITY_PASSWORD_CHANGED: 'info',
    AUTH_2FA_ENABLED: 'success',
    AUTH_2FA_DISABLED: 'warning',
    AUTH_2FA_SUCCESS: 'success',
    AUTH_2FA_FAILURE: 'warning',
    AUTH_2FA_BACKUP_USED: 'warning',
    SECURITY_ACCOUNT_LOCKED: 'error',
    SECURITY_ACCOUNT_UNLOCKED: 'success',
    SECURITY_DEVICE_REVOKED: 'info',
    AUTH_OAUTH_ACCOUNT_LINKED: 'success',
    AUTH_OAUTH_ACCOUNT_UNLINKED: 'info',
    API_KEY_CREATED: 'success',
    API_KEY_REVOKED: 'info',
  };
  return severities[action] || 'info';
}
