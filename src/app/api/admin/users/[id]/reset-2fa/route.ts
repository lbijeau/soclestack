import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { deleteAllBackupCodes } from '@/lib/auth/backup-codes';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const { id: targetUserId } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Check admin role
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, twoFactorEnabled: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!targetUser.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'BAD_REQUEST', message: '2FA is not enabled for this user' } },
        { status: 400 }
      );
    }

    // Reset 2FA
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });

    // Delete backup codes
    await deleteAllBackupCodes(targetUserId);

    await logAuditEvent({
      action: 'ADMIN_2FA_RESET',
      category: 'admin',
      userId: targetUserId,
      ipAddress: clientIP,
      userAgent,
      metadata: { resetBy: session.userId, targetEmail: targetUser.email },
    });

    return NextResponse.json({ message: '2FA reset successfully' });
  } catch (error) {
    console.error('Admin 2FA reset error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to reset 2FA' } },
      { status: 500 }
    );
  }
}
