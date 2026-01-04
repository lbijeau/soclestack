import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/lib/auth';
import { deleteAllBackupCodes } from '@/lib/auth/backup-codes';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { canAccessUserInOrg } from '@/lib/organization';
import { requireAdmin } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const currentUser = auth.user;

    const { id: targetUserId } = await params;

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        organizationId: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Check organization-level access
    if (
      !canAccessUserInOrg(
        currentUser?.organizationId ?? null,
        targetUser.organizationId
      )
    ) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!targetUser.twoFactorEnabled) {
      return NextResponse.json(
        {
          error: {
            type: 'BAD_REQUEST',
            message: '2FA is not enabled for this user',
          },
        },
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
      metadata: { resetBy: currentUser.id, targetEmail: targetUser.email },
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
