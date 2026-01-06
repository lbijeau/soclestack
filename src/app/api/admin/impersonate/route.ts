import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, getClientIP, getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { isImpersonating } from '@/lib/auth/impersonation';
import {
  getHighestRole,
  userWithRolesInclude,
  isGranted,
  ROLES,
} from '@/lib/security/index';

export const runtime = 'nodejs';

const impersonateSchema = z.object({
  userId: z.string().min(1),
});

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

    // Cannot start impersonation while already impersonating
    if (isImpersonating(session)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Already impersonating a user. Exit first.',
          },
        },
        { status: 403 }
      );
    }

    // Get current user with roles for authorization check
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Must be ADMIN
    if (!(await isGranted(currentUser, ROLES.ADMIN))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const result = impersonateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { userId: targetUserId } = result.data;

    // Cannot impersonate yourself
    if (targetUserId === session.userId) {
      return NextResponse.json(
        {
          error: { type: 'FORBIDDEN', message: 'Cannot impersonate yourself' },
        },
        { status: 403 }
      );
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        isActive: true,
        ...userWithRolesInclude,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot impersonate inactive user',
          },
        },
        { status: 403 }
      );
    }

    // Cannot impersonate another ADMIN
    if (await isGranted(targetUser, ROLES.ADMIN)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot impersonate another admin',
          },
        },
        { status: 403 }
      );
    }

    // Store original admin info and switch to target user
    const originalUserId = session.userId;
    const originalEmail = session.email;
    const originalRole = session.role;

    session.impersonating = {
      originalUserId,
      originalEmail,
      originalRole,
      startedAt: Date.now(),
    };

    // Get display role for session storage
    const targetUserRole = getHighestRole(targetUser);

    session.userId = targetUser.id;
    session.email = targetUser.email;
    session.role = targetUserRole;

    await session.save();

    // Log audit event
    await logAuditEvent({
      action: 'ADMIN_IMPERSONATION_START',
      category: 'admin',
      userId: originalUserId,
      ipAddress: clientIP,
      userAgent,
      metadata: {
        adminUserId: originalUserId,
        adminEmail: originalEmail,
        targetUserId: targetUser.id,
        targetEmail: targetUser.email,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        role: targetUserRole,
      },
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to start impersonation',
        },
      },
      { status: 500 }
    );
  }
}
