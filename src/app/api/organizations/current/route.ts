import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCurrentOrganizationId } from '@/lib/organization';
import { hasRole, userWithRolesInclude, ROLES } from '@/lib/security/index';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must be at most 100 characters')
    .optional(),
});

// GET /api/organizations/current - Get current user's organization
export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Get current organization ID
    const organizationId = await getCurrentOrganizationId(session.userId);

    if (!organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message:
              'You do not belong to an organization or belong to multiple organizations',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Get organization details with member count
    const [organization, memberCount, userRole] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
      }),
      prisma.userRole.count({
        where: { organizationId },
      }),
      prisma.userRole.findFirst({
        where: {
          userId: session.userId,
          organizationId,
        },
        select: {
          role: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    if (!organization) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Organization not found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        memberCount,
        role: userRole?.role.name || ROLES.USER,
        createdAt: organization.createdAt,
      },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/current - Update organization (ADMIN+)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Get current organization ID
    const organizationId = await getCurrentOrganizationId(session.userId);

    if (!organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message:
              'You do not belong to an organization or belong to multiple organizations',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Get user with roles for authorization
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, ...userWithRolesInclude },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'NOT_FOUND', message: 'User not found' } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if user has ADMIN or higher role
    if (!(await hasRole(user, ROLES.ADMIN, organizationId))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You do not have permission to update this organization',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validationResult = updateOrganizationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: validationResult.error.flatten().fieldErrors,
          } as AuthError,
        },
        { status: 400 }
      );
    }

    const { name } = validationResult.data;

    const updatedOrg = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(name && { name }),
      },
    });

    // Get user's role for response
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: session.userId,
        organizationId,
      },
      select: {
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        slug: updatedOrg.slug,
        role: userRole?.role.name || ROLES.USER,
      },
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/current - Delete organization (OWNER only)
export async function DELETE() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Get current organization ID
    const organizationId = await getCurrentOrganizationId(session.userId);

    if (!organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message:
              'You do not belong to an organization or belong to multiple organizations',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Get user with roles for authorization
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, ...userWithRolesInclude },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'NOT_FOUND', message: 'User not found' } as AuthError,
        },
        { status: 404 }
      );
    }

    // Only OWNER can delete the organization
    if (!(await hasRole(user, ROLES.OWNER, organizationId))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Only the owner can delete the organization',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Delete organization and all related records in transaction
    await prisma.$transaction(async (tx) => {
      // Delete all UserRole records for this organization
      await tx.userRole.deleteMany({
        where: { organizationId },
      });

      // Delete all invites
      await tx.organizationInvite.deleteMany({
        where: { organizationId },
      });

      // Delete the organization (cascade will handle remaining relations)
      await tx.organization.delete({
        where: { id: organizationId },
      });
    });

    return NextResponse.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
