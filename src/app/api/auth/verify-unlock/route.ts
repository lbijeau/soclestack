import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getClientIP } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { AuthError } from '@/types/auth';
import { z } from 'zod';

export const runtime = 'nodejs';

const verifyUnlockSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validationResult = verifyUnlockSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid token',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    const { token } = validationResult.data;
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        lockedUntil: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid or expired unlock token',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Check if account is actually locked
    if (!user.lockedUntil || user.lockedUntil <= new Date()) {
      // Clear the token since it's been used
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      return NextResponse.json({
        message: 'Your account is not locked. You can log in normally.',
      });
    }

    // Unlock the account
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedUntil: null,
        failedLoginAttempts: 0,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await logAuditEvent({
      action: 'SECURITY_ACCOUNT_UNLOCKED',
      category: 'security',
      userId: user.id,
      ipAddress: clientIP,
      userAgent,
      metadata: { method: 'self_service_email' },
    });

    return NextResponse.json({
      message: 'Your account has been unlocked. You can now log in.',
    });
  } catch (error) {
    console.error('Verify unlock error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to verify unlock token',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
