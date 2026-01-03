import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createUserSession, getClientIP } from '@/lib/auth';
import { verifyTOTPCode } from '@/lib/auth/totp';
import {
  verifyBackupCode,
  getRemainingBackupCodeCount,
} from '@/lib/auth/backup-codes';
import { verifyPending2FAToken } from '@/lib/auth/pending-2fa';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { generateCsrfToken, CSRF_CONFIG } from '@/lib/csrf';

export const runtime = 'nodejs';

const validateSchema = z.object({
  pendingToken: z.string(),
  code: z.string().min(6).max(8), // 6 for TOTP, 8 for backup
  isBackupCode: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();
    const validationResult = validateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid request' } },
        { status: 400 }
      );
    }

    const { pendingToken, code, isBackupCode } = validationResult.data;

    // Verify pending token
    const pending = await verifyPending2FAToken(pendingToken);
    if (!pending) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Session expired, please login again',
          },
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId },
    });

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid session' } },
        { status: 401 }
      );
    }

    let isValid = false;
    let usedBackupCode = false;

    if (isBackupCode) {
      isValid = await verifyBackupCode(user.id, code);
      usedBackupCode = isValid;
    } else {
      isValid = verifyTOTPCode(user.twoFactorSecret, code);
    }

    if (!isValid) {
      await logAuditEvent({
        action: 'AUTH_2FA_FAILURE',
        category: 'authentication',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { isBackupCode },
      });

      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid code' } },
        { status: 401 }
      );
    }

    // Create full session
    const tokens = await createUserSession(user, clientIP, userAgent);

    // Log success
    if (usedBackupCode) {
      const remainingCodes = await getRemainingBackupCodeCount(user.id);
      await logAuditEvent({
        action: 'AUTH_2FA_BACKUP_USED',
        category: 'authentication',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { remainingCodes },
      });
    } else {
      await logAuditEvent({
        action: 'AUTH_2FA_SUCCESS',
        category: 'authentication',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
      });
    }

    // Check remaining backup codes
    const remainingBackupCodes = await getRemainingBackupCodeCount(user.id);

    // Set CSRF token cookie
    const csrfToken = generateCsrfToken();
    const cookieStore = await cookies();
    cookieStore.set(
      CSRF_CONFIG.cookieName,
      csrfToken,
      CSRF_CONFIG.cookieOptions
    );

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      warnings:
        remainingBackupCodes <= 3
          ? {
              lowBackupCodes: true,
              remainingBackupCodes,
            }
          : undefined,
    });
  } catch (error) {
    console.error('2FA validate error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to validate 2FA' } },
      { status: 500 }
    );
  }
}
