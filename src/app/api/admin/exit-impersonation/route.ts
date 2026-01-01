import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import {
  isImpersonating,
  getImpersonationDuration,
} from '@/lib/auth/impersonation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Must be logged in
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Must be impersonating
    if (!isImpersonating(session)) {
      return NextResponse.json(
        {
          error: { type: 'FORBIDDEN', message: 'Not currently impersonating' },
        },
        { status: 403 }
      );
    }

    const impersonating = session.impersonating!;
    const duration = getImpersonationDuration(session);
    const targetUserId = session.userId;
    const targetEmail = session.email;

    // Restore original admin session
    session.userId = impersonating.originalUserId;
    session.email = impersonating.originalEmail;
    session.role = impersonating.originalRole;
    session.impersonating = undefined;

    await session.save();

    // Log audit event
    await logAuditEvent({
      action: 'ADMIN_IMPERSONATION_END',
      category: 'admin',
      userId: impersonating.originalUserId,
      ipAddress: clientIP,
      userAgent,
      metadata: {
        adminUserId: impersonating.originalUserId,
        adminEmail: impersonating.originalEmail,
        targetUserId,
        targetEmail,
        durationSeconds: duration,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: impersonating.originalUserId,
        email: impersonating.originalEmail,
        role: impersonating.originalRole,
      },
    });
  } catch (error) {
    console.error('Exit impersonation error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to exit impersonation',
        },
      },
      { status: 500 }
    );
  }
}
