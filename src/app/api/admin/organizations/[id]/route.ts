import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/api-utils';
import { isGranted } from '@/lib/security/index';

export const runtime = 'nodejs';

// Role priority for sorting: OWNER first, then ADMIN, then MEMBER
const ROLE_PRIORITY: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Only platform admins can view organization details
    const isPlatformAdmin = await requireAdmin(user, null);
    if (!isPlatformAdmin) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Requires platform admin access',
          },
        },
        { status: 403 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            username: true,
            organizationRole: true,
            createdAt: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    // Sort members: OWNER first, then ADMIN, then MEMBER, then by join date
    const sortedMembers = [...organization.users].sort((a, b) => {
      const rolePriorityA = ROLE_PRIORITY[a.organizationRole || 'MEMBER'] ?? 2;
      const rolePriorityB = ROLE_PRIORITY[b.organizationRole || 'MEMBER'] ?? 2;
      if (rolePriorityA !== rolePriorityB) {
        return rolePriorityA - rolePriorityB;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt.toISOString(),
        members: sortedMembers.map((u) => ({
          userId: u.id,
          role: u.organizationRole,
          joinedAt: u.createdAt.toISOString(),
          user: {
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            username: u.username,
          },
        })),
      },
    });
  } catch (error) {
    console.error('Admin organization detail error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to fetch organization',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify org exists first
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          where: { organizationRole: 'OWNER' },
          select: { id: true, email: true },
          take: 1,
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    // Check if user is admin of this organization (or platform admin)
    const canManage = await isGranted(user, 'organization.manage', {
      organizationId: id,
      subject: { id: organization.id, slug: organization.slug },
    });

    if (!canManage) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Not authorized to manage this organization',
          },
        },
        { status: 403 }
      );
    }

    // Rate limit: 10 ownership transfers per hour per admin
    const rateLimitKey = `admin-org-transfer:${user.id}`;
    if (isRateLimited(rateLimitKey, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many ownership transfers. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { newOwnerId } = body;

    if (!newOwnerId) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'New owner ID is required',
          },
        },
        { status: 400 }
      );
    }

    // Verify new owner is a member
    const newOwner = await prisma.user.findFirst({
      where: {
        id: newOwnerId,
        organizationId: id,
      },
      select: { id: true, email: true },
    });

    if (!newOwner) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'New owner must be an existing member',
          },
        },
        { status: 400 }
      );
    }

    const currentOwner = organization.users[0];

    // Transfer ownership in a transaction
    await prisma.$transaction([
      // Demote current owner to ADMIN
      prisma.user.update({
        where: { id: currentOwner.id },
        data: { organizationRole: 'ADMIN' },
      }),
      // Promote new owner
      prisma.user.update({
        where: { id: newOwnerId },
        data: { organizationRole: 'OWNER' },
      }),
    ]);

    // Audit log
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_ORG_OWNERSHIP_TRANSFER',
      category: 'admin',
      userId: user.id,
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
      metadata: {
        organizationId: id,
        organizationName: organization.name,
        previousOwnerId: currentOwner.id,
        newOwnerId,
        newOwnerEmail: newOwner.email,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin organization transfer error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to transfer ownership',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch organization for voter check
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    // Only org owner or platform admin can delete (checked by OrganizationVoter)
    const canDelete = await isGranted(user, 'organization.delete', {
      organizationId: id,
      subject: { id: organization.id, slug: organization.slug },
    });

    if (!canDelete) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Only organization owner or platform admin can delete',
          },
        },
        { status: 403 }
      );
    }

    // Rate limit: 5 organization deletions per hour per admin
    const rateLimitKey = `admin-org-delete:${user.id}`;
    if (isRateLimited(rateLimitKey, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many organization deletions. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    // Delete organization (cascade deletes invites, clear user org references)
    await prisma.$transaction([
      // Clear organizationId from users
      prisma.user.updateMany({
        where: { organizationId: id },
        data: { organizationId: null, organizationRole: 'MEMBER' },
      }),
      // Delete invitations
      prisma.organizationInvite.deleteMany({ where: { organizationId: id } }),
      // Delete organization
      prisma.organization.delete({ where: { id } }),
    ]);

    // Audit log
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_ORG_DELETED',
      category: 'admin',
      userId: user.id,
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined,
      metadata: {
        organizationId: id,
        organizationName: organization.name,
        memberCount: organization._count.users,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin organization delete error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to delete organization',
        },
      },
      { status: 500 }
    );
  }
}
