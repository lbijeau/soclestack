import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, isRateLimited } from '@/lib/auth';
import { AuthError } from '@/types/auth';
import { userWithRolesInclude } from '@/lib/security/index';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Rate limit: 3 exports per day
    const rateLimitKey = `data-export:${user.id}`;
    if (isRateLimited(rateLimitKey, 3, 24 * 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many export requests. Please try again tomorrow.',
          } as AuthError,
        },
        { status: 429 }
      );
    }

    // Fetch all user data
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        twoFactorEnabled: true,
        notifyNewDevice: true,
        notifyPasswordChange: true,
        notifyLoginAlert: true,
        notify2FAChange: true,
        ...userWithRolesInclude,
        oauthAccounts: {
          select: {
            provider: true,
            providerAccountId: true,
            createdAt: true,
          },
        },
        apiKeys: {
          where: { revokedAt: null },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            permission: true,
            lastUsedAt: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        sessions: {
          where: { isActive: true },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
          },
        },
        rememberMeTokens: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            lastUsedAt: true,
            createdAt: true,
          },
        },
      },
    });

    // Fetch audit logs (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: ninetyDaysAgo },
      },
      select: {
        id: true,
        action: true,
        category: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    // Parse metadata in audit logs
    const parsedAuditLogs = auditLogs.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        ...userData,
        // Exclude sensitive fields
        password: '[REDACTED]',
        twoFactorSecret: '[REDACTED]',
        passwordResetToken: '[REDACTED]',
      },
      auditLogs: parsedAuditLogs,
    };

    // Return as downloadable JSON
    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="soclestack-data-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to export data',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
