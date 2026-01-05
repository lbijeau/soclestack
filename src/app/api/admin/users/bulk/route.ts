import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getClientIP } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { AuthError } from '@/types/auth';
import { z } from 'zod';
import { userWithRolesInclude, isGranted, ROLES } from '@/lib/security/index';
import { requireAdmin } from '@/lib/api-utils';

export const runtime = 'nodejs';

const bulkActionSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['activate', 'deactivate', 'delete']),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const currentUser = auth.user;

    const body = await req.json();
    const validationResult = bulkActionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.flatten().fieldErrors,
          } as AuthError,
        },
        { status: 400 }
      );
    }

    const { userIds, action } = validationResult.data;
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Prevent admin from performing actions on themselves
    if (userIds.includes(currentUser.id)) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Cannot perform bulk action on your own account',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Get target users to verify they exist and check for other admins
    const targetUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        ...userWithRolesInclude,
      },
    });

    if (targetUsers.length === 0) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'No valid users found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Prevent actions on other admins (using isGranted for proper hierarchy check)
    const adminChecks = await Promise.all(
      targetUsers.map(async (u) => ({
        user: u,
        isAdmin: await isGranted(u, ROLES.ADMIN),
      }))
    );
    const adminTargets = adminChecks.filter((c) => c.isAdmin);
    if (adminTargets.length > 0) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Cannot perform bulk actions on admin accounts',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    const validUserIds = targetUsers.map((u) => u.id);
    let affectedCount = 0;

    switch (action) {
      case 'activate':
        const activateResult = await prisma.user.updateMany({
          where: { id: { in: validUserIds } },
          data: { isActive: true },
        });
        affectedCount = activateResult.count;

        await logAuditEvent({
          action: 'ADMIN_BULK_ACTIVATE',
          category: 'admin',
          userId: currentUser.id,
          ipAddress: clientIP,
          userAgent,
          metadata: { targetUserIds: validUserIds, count: affectedCount },
        });
        break;

      case 'deactivate':
        const deactivateResult = await prisma.user.updateMany({
          where: { id: { in: validUserIds } },
          data: { isActive: false },
        });
        affectedCount = deactivateResult.count;

        await logAuditEvent({
          action: 'ADMIN_BULK_DEACTIVATE',
          category: 'admin',
          userId: currentUser.id,
          ipAddress: clientIP,
          userAgent,
          metadata: { targetUserIds: validUserIds, count: affectedCount },
        });
        break;

      case 'delete':
        // Hard delete users
        const deleteResult = await prisma.user.deleteMany({
          where: { id: { in: validUserIds } },
        });
        affectedCount = deleteResult.count;

        await logAuditEvent({
          action: 'ADMIN_BULK_DELETE',
          category: 'admin',
          userId: currentUser.id,
          ipAddress: clientIP,
          userAgent,
          metadata: {
            deletedUsers: targetUsers.map((u) => ({
              id: u.id,
              email: u.email,
            })),
            count: affectedCount,
          },
        });
        break;
    }

    return NextResponse.json({
      message: `Successfully ${action}d ${affectedCount} user(s)`,
      affectedCount,
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to perform bulk action',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
