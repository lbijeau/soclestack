import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession, getClientIP, isRateLimited, logoutUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import {
  assertNotImpersonating,
  ImpersonationBlockedError,
} from '@/lib/auth/impersonation';
import {
  userWithRolesInclude,
  isGranted,
  ROLES,
} from '@/lib/security/index';

export const runtime = 'nodejs';

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.literal('DELETE MY ACCOUNT'),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    // Rate limiting - use strict limits for account deletion
    if (isRateLimited(`delete-account:${clientIP}`, 3, 60 * 60 * 1000)) {
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

    const body = await req.json();
    const validationResult = deleteAccountSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { password } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        password: true,
        organizationRole: true,
        organizationId: true,
        ...userWithRolesInclude,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // System admins cannot delete their own account
    if (await isGranted(user, ROLES.ADMIN)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message:
              'System administrators cannot delete their own account. Contact another admin.',
          },
        },
        { status: 403 }
      );
    }

    // Organization owners must transfer ownership first
    if (user.organizationId && user.organizationRole === 'OWNER') {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message:
              'You must transfer organization ownership before deleting your account.',
          },
        },
        { status: 403 }
      );
    }

    // OAuth-only users cannot verify with password
    if (!user.password) {
      return NextResponse.json(
        {
          error: {
            type: 'BAD_REQUEST',
            message:
              'OAuth-only accounts cannot be deleted this way. Please contact support.',
          },
        },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await logAuditEvent({
        action: 'ACCOUNT_DELETE_FAILED',
        category: 'security',
        userId: user.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { reason: 'invalid_password' },
      });

      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Invalid password' },
        },
        { status: 401 }
      );
    }

    // Log the deletion before deleting (so we have the userId)
    await logAuditEvent({
      action: 'ACCOUNT_DELETED',
      category: 'security',
      userId: user.id,
      ipAddress: clientIP,
      userAgent,
      metadata: { email: user.email },
    });

    // Delete user - cascades to sessions, tokens, backup codes, OAuth accounts, API keys
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Destroy current session
    await logoutUser();

    return NextResponse.json({
      message: 'Your account has been permanently deleted.',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to delete account' } },
      { status: 500 }
    );
  }
}
