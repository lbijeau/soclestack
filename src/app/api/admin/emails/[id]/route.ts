import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isImpersonating } from '@/lib/auth/impersonation';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await getSession();

    // Must be logged in
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Cannot access while impersonating
    if (isImpersonating(session)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot access email logs while impersonating',
          },
        },
        { status: 403 }
      );
    }

    // Get user with roles
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        ...userWithRolesInclude,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Only platform admins can access email logs
    const isPlatformAdmin = await isGranted(user, ROLES.ADMIN);
    if (!isPlatformAdmin) {
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

    // Fetch the email log with user relation
    const emailLog = await prisma.emailLog.findUnique({
      where: {
        id,
        deletedAt: null, // Exclude soft-deleted emails
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!emailLog) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Email log not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      email: {
        ...emailLog,
        sentAt: emailLog.sentAt?.toISOString() ?? null,
        createdAt: emailLog.createdAt.toISOString(),
        updatedAt: emailLog.updatedAt.toISOString(),
        deletedAt: emailLog.deletedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Admin email detail error:', error);
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to fetch email log' },
      },
      { status: 500 }
    );
  }
}
