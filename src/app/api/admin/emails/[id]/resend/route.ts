import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isImpersonating } from '@/lib/auth/impersonation';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';
import { resendEmail } from '@/lib/email';
import { logAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
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
            message: 'Cannot resend emails while impersonating',
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

    // Only platform admins can resend emails
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

    // Check that the email log exists and is not deleted
    const emailLog = await prisma.emailLog.findUnique({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        to: true,
        type: true,
        status: true,
      },
    });

    if (!emailLog) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Email log not found' } },
        { status: 404 }
      );
    }

    // Attempt to resend the email
    const result = await resendEmail(id);

    // Log the admin action
    await logAuditEvent({
      action: 'ADMIN_EMAIL_RESEND',
      category: 'admin',
      userId: session.userId,
      metadata: {
        emailLogId: id,
        emailTo: emailLog.to,
        emailType: emailLog.type,
        previousStatus: emailLog.status,
        success: result.success,
        error: result.error ?? null,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          emailLogId: id,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      emailLogId: id,
      error: null,
    });
  } catch (error) {
    console.error('Admin email resend error:', error);
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to resend email' },
      },
      { status: 500 }
    );
  }
}
