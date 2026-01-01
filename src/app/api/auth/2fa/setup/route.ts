import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP, isRateLimited } from '@/lib/auth';
import { generateTOTPSecret } from '@/lib/auth/totp';
import { generateBackupCodes } from '@/lib/auth/backup-codes';
import { prisma } from '@/lib/db';
import {
  assertNotImpersonating,
  ImpersonationBlockedError,
} from '@/lib/auth/impersonation';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const { limit, windowMs } = SECURITY_CONFIG.rateLimits.twoFactorSetup;
    if (isRateLimited(`2fa-setup:${clientIP}`, limit, windowMs)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many requests. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'CONFLICT', message: '2FA is already enabled' } },
        { status: 409 }
      );
    }

    // Generate TOTP secret and QR code
    const totpResult = await generateTOTPSecret(user.email);

    // Generate backup codes
    const backupCodes = await generateBackupCodes(session.userId);

    // Store secret (not enabled yet, needs verification)
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        twoFactorSecret: totpResult.secret,
        twoFactorEnabled: false,
        twoFactorVerified: false,
      },
    });

    return NextResponse.json({
      qrCodeDataUrl: totpResult.qrCodeDataUrl,
      manualEntryKey: totpResult.manualEntryKey,
      backupCodes,
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to setup 2FA' } },
      { status: 500 }
    );
  }
}
