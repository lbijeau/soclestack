import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { verifyTOTPCode } from '@/lib/auth/totp';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validationResult = verifySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid code format' } },
        { status: 400 }
      );
    }

    const { code } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: { type: 'BAD_REQUEST', message: '2FA setup not started' } },
        { status: 400 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'CONFLICT', message: '2FA is already enabled' } },
        { status: 409 }
      );
    }

    const isValid = verifyTOTPCode(user.twoFactorSecret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid code' } },
        { status: 401 }
      );
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorEnabled: true,
        twoFactorVerified: true,
      },
    });

    await logAuditEvent({
      action: 'AUTH_2FA_ENABLED',
      category: 'security',
      userId: session.userId,
      ipAddress: clientIP,
      userAgent,
    });

    return NextResponse.json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to verify 2FA' } },
      { status: 500 }
    );
  }
}
