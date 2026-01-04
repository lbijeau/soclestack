import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
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
          orderBy: [{ organizationRole: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'Organization not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt.toISOString(),
        members: organization.users.map((u) => ({
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
        error: { type: 'SERVER_ERROR', message: 'Failed to fetch organization' },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
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

    // Verify org exists
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
        error: { type: 'SERVER_ERROR', message: 'Failed to transfer ownership' },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (user.role !== 'ADMIN') {
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
