import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/api-utils';
import { ROLES } from '@/lib/security/index';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { id, userId } = await params;

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

    // Verify the user has a role in this organization
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: userId,
        organizationId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!userRole) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Member not found' } },
        { status: 404 }
      );
    }

    // Cannot remove owner
    if (userRole.role.name === ROLES.OWNER) {
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

    // Get organization name for audit log
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { name: true },
    });

    // Remove member by deleting their UserRole
    await prisma.userRole.delete({
      where: { id: userRole.id },
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
        organizationName: organization?.name,
        removedUserId: userId,
        removedUserEmail: userRole.user.email,
        removedUserRole: userRole.role.name,
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
