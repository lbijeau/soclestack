import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isImpersonating } from '@/lib/auth/impersonation';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';
import { cleanupEmailLogs, getEmailLogStats } from '@/lib/email/cleanup';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

/**
 * GET /api/admin/emails/cleanup
 * Get email log statistics for retention monitoring.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (isImpersonating(session)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot access while impersonating',
          },
        },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, ...userWithRolesInclude },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!(await isGranted(user, ROLES.ADMIN))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    const stats = await getEmailLogStats();

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Email cleanup stats error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to fetch email log stats',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/emails/cleanup
 * Trigger email log cleanup according to retention policy.
 */
export async function POST() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (isImpersonating(session)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot perform cleanup while impersonating',
          },
        },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, ...userWithRolesInclude },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!(await isGranted(user, ROLES.ADMIN))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Run cleanup
    const result = await cleanupEmailLogs();

    // Log the action
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_EMAIL_CLEANUP',
      category: 'admin',
      userId: session.userId,
      ipAddress: headersList.get('x-forwarded-for') ?? undefined,
      userAgent: headersList.get('user-agent') ?? undefined,
      metadata: {
        hardDeleted: result.hardDeleted,
        bodiesPurged: result.bodiesPurged,
        errors: result.errors,
      },
    });

    return NextResponse.json({
      success: result.errors.length === 0,
      result,
    });
  } catch (error) {
    console.error('Email cleanup error:', error);
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to run email cleanup' },
      },
      { status: 500 }
    );
  }
}
