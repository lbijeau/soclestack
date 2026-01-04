import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isRateLimited } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';
import { isGranted, ROLES } from '@/lib/security/index';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id, userId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (!(await isGranted(user, ROLES.ADMIN))) {
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

    // Rate limit: 20 member removals per hour per admin
    const rateLimitKey = `admin-org-member-remove:${user.id}`;
    if (isRateLimited(rateLimitKey, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many member removals. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    // Verify the user is a member of this organization
    const member = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: id,
      },
      select: {
        id: true,
        email: true,
        organizationRole: true,
        organization: {
          select: { name: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Cannot remove owner
    if (member.organizationRole === 'OWNER') {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message:
              'Cannot remove organization owner. Transfer ownership first.',
          },
        },
        { status: 400 }
      );
    }

    // Remove member by clearing their organization association
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId: null, organizationRole: 'MEMBER' },
    });

    // Audit log
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_ORG_MEMBER_REMOVED',
      category: 'admin',
      userId: user.id,
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
      metadata: {
        organizationId: id,
        organizationName: member.organization?.name,
        removedUserId: userId,
        removedUserEmail: member.email,
        removedUserRole: member.organizationRole,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin remove member error:', error);
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to remove member' },
      },
      { status: 500 }
    );
  }
}
