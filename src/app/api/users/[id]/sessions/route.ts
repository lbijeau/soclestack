import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import {
  getUserActiveSessions,
  revokeRememberMeToken,
  revokeAllUserTokens,
} from '@/lib/auth/remember-me';
import { logAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

// GET - List active sessions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Users can only view their own sessions, admins can view any
    if (session.userId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Not authorized' } },
        { status: 403 }
      );
    }

    const sessions = await getUserActiveSessions(userId);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to get sessions' } },
      { status: 500 }
    );
  }
}

// DELETE - Revoke session(s)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Users can only revoke their own sessions, admins can revoke any
    if (session.userId !== userId && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Not authorized' } },
        { status: 403 }
      );
    }

    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    const { searchParams } = new URL(req.url);
    const series = searchParams.get('series');
    const all = searchParams.get('all') === 'true';

    if (all) {
      await revokeAllUserTokens(userId);
      await logAuditEvent({
        action: 'SECURITY_ALL_SESSIONS_REVOKED',
        category: 'security',
        userId,
        ipAddress: clientIP,
        userAgent,
        metadata: { revokedBy: session.userId },
      });
      return NextResponse.json({ message: 'All sessions revoked' });
    }

    if (series) {
      await revokeRememberMeToken(series, userId, clientIP, userAgent);
      return NextResponse.json({ message: 'Session revoked' });
    }

    return NextResponse.json(
      {
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Specify series or all=true',
        },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Revoke session error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to revoke session' } },
      { status: 500 }
    );
  }
}
