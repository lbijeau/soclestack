import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited, getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/api-utils';
import { isGranted, PERMISSIONS } from '@/lib/security/index';

export const runtime = 'nodejs';

// Role priority for sorting: ROLE_OWNER first, then ROLE_ADMIN, then ROLE_MODERATOR, then ROLE_USER
const ROLE_PRIORITY: Record<string, number> = {
  ROLE_OWNER: 0,
  ROLE_ADMIN: 1,
  ROLE_MODERATOR: 2,
  ROLE_EDITOR: 3,
  ROLE_USER: 4,
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
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
              },
            },
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

    // Sort members: ROLE_OWNER first, then ROLE_ADMIN, etc., then by join date
    const sortedMembers = [...organization.userRoles].sort((a, b) => {
      const rolePriorityA = ROLE_PRIORITY[a.role.name] ?? 999;
      const rolePriorityB = ROLE_PRIORITY[b.role.name] ?? 999;
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
        members: sortedMembers.map((userRole) => ({
          userId: userRole.user.id,
          role: userRole.role.name,
          joinedAt: userRole.createdAt.toISOString(),
          user: {
            id: userRole.user.id,
            email: userRole.user.email,
            firstName: userRole.user.firstName,
            lastName: userRole.user.lastName,
            username: userRole.user.username,
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
        userRoles: {
          where: {
            role: {
              name: 'ROLE_OWNER',
            },
          },
          include: {
            user: {
              select: { id: true, email: true },
            },
            role: {
              select: { id: true, name: true },
            },
          },
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
    const canManage = await isGranted(user, PERMISSIONS.ORGANIZATION.MANAGE, {
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

    // Verify new owner is a member of this organization
    const newOwnerRole = await prisma.userRole.findFirst({
      where: {
        userId: newOwnerId,
        organizationId: id,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
        role: {
          select: { id: true, name: true },
        },
      },
    });

    if (!newOwnerRole) {
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

    const currentOwnerRole = organization.userRoles[0];

    // Get ROLE_ADMIN id for demotion
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ROLE_ADMIN' },
    });

    if (!adminRole) {
      throw new Error('ROLE_ADMIN not found in database');
    }

    // Transfer ownership in a transaction
    await prisma.$transaction([
      // Demote current owner to ADMIN (update their UserRole)
      prisma.userRole.update({
        where: { id: currentOwnerRole.id },
        data: { roleId: adminRole.id },
      }),
      // Promote new owner (update their UserRole to OWNER)
      prisma.userRole.update({
        where: { id: newOwnerRole.id },
        data: { roleId: currentOwnerRole.role.id }, // Use current owner's ROLE_OWNER id
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
        previousOwnerId: currentOwnerRole.user.id,
        newOwnerId,
        newOwnerEmail: newOwnerRole.user.email,
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
      include: { _count: { select: { userRoles: true } } },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    // Only org owner or platform admin can delete (checked by OrganizationVoter)
    const canDelete = await isGranted(user, PERMISSIONS.ORGANIZATION.DELETE, {
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

    // Delete organization (cascade deletes userRoles and invites automatically)
    await prisma.organization.delete({ where: { id } });

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
        memberCount: organization._count.userRoles,
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
