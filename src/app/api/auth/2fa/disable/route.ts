import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP, isRateLimited } from '@/lib/auth';
import { verifyTOTPCode } from '@/lib/auth/totp';
import { deleteAllBackupCodes } from '@/lib/auth/backup-codes';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { sendTwoFactorDisabledNotification } from '@/lib/email';
import { z } from 'zod';
import { assertNotImpersonating, ImpersonationBlockedError } from '@/lib/auth/impersonation';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

const disableSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    // Rate limiting
    const { limit, windowMs } = SECURITY_CONFIG.rateLimits.twoFactorDisable;
    if (isRateLimited(`2fa-disable:${clientIP}`, limit, windowMs)) {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Too many requests. Please try again later.' } },
        { status: 429 }
      );
    }

    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Block during impersonation
    try {
      assertNotImpersonating(session);
    } catch (error) {
      if (error instanceof ImpersonationBlockedError) {
        return NextResponse.json(
          { error: { type: 'FORBIDDEN', message: error.message } },
          { status: 403 }
        );
      }
      throw error;
    }

    const body = await req.json();
    const validationResult = disableSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid code format' } },
        { status: 400 }
      );
    }

    const { code } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, twoFactorSecret: true, twoFactorEnabled: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Admins cannot disable their own 2FA
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Admins cannot disable 2FA' } },
        { status: 403 }
      );
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: { type: 'BAD_REQUEST', message: '2FA is not enabled' } },
        { status: 400 }
      );
    }

    // Verify current TOTP code
    const isValid = verifyTOTPCode(user.twoFactorSecret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid code' } },
        { status: 401 }
      );
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });

    // Delete backup codes
    await deleteAllBackupCodes(session.userId);

    await logAuditEvent({
      action: 'AUTH_2FA_DISABLED',
      category: 'security',
      userId: session.userId,
      ipAddress: clientIP,
      userAgent,
    });

    // Send notification (fire-and-forget)
    sendTwoFactorDisabledNotification(user.email).catch((err) =>
      console.error('Failed to send 2FA disabled notification:', err)
    );

    return NextResponse.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to disable 2FA' } },
      { status: 500 }
    );
  }
}
