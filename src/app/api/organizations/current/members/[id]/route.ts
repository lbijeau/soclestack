import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCurrentOrganizationId } from '@/lib/organization';
import { hasRole, userWithRolesInclude, ROLES } from '@/lib/security/index';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

const updateMemberSchema = z.object({
  roleName: z.string().startsWith('ROLE_'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/organizations/current/members/[id] - Update member role (ADMIN+)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: memberId } = await params;

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

    // Get current user with roles
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, ...userWithRolesInclude },
    });

    if (!currentUser) {
      return NextResponse.json(
        {
          error: { type: 'NOT_FOUND', message: 'User not found' } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if user has ADMIN or higher role in this organization
    if (!(await hasRole(currentUser, ROLES.ADMIN, organizationId))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You do not have permission to manage members',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Find the target member's UserRole in this organization
    const targetUserRole = await prisma.userRole.findFirst({
      where: {
        userId: memberId,
        organizationId,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            parentId: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!targetUserRole) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Member not found in this organization',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Cannot modify yourself
    if (session.userId === memberId) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You cannot change your own role',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Cannot change OWNER role (only via ownership transfer endpoint)
    if (targetUserRole.role.name === ROLES.OWNER) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: "Cannot change the owner's role directly",
          } as AuthError,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validationResult = updateMemberSchema.safeParse(body);

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

    const { roleName } = validationResult.data;

    // Find the new role
    const newRole = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!newRole) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid role specified',
          } as AuthError,
        },
        { status: 400 }
      );
    }

    // Prevent promoting to ADMIN or OWNER (simplified role hierarchy check)
    if (roleName === ROLES.ADMIN || roleName === ROLES.OWNER) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You cannot promote a member to ADMIN or OWNER role',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Update the UserRole
    await prisma.userRole.update({
      where: { id: targetUserRole.id },
      data: { roleId: newRole.id },
    });

    // Fetch updated member details
    const updatedMember = {
      id: targetUserRole.user.id,
      email: targetUserRole.user.email,
      username: targetUserRole.user.username,
      firstName: targetUserRole.user.firstName,
      lastName: targetUserRole.user.lastName,
      role: roleName,
    };

    return NextResponse.json({ member: updatedMember });
  } catch (error) {
    console.error('Update member error:', error);
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

// DELETE /api/organizations/current/members/[id] - Remove member from organization (ADMIN+)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: memberId } = await params;

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

    // Get current user with roles
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, ...userWithRolesInclude },
    });

    if (!currentUser) {
      return NextResponse.json(
        {
          error: { type: 'NOT_FOUND', message: 'User not found' } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if user has ADMIN or higher role in this organization
    if (!(await hasRole(currentUser, ROLES.ADMIN, organizationId))) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You do not have permission to manage members',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Find the target member's UserRole in this organization
    const targetUserRole = await prisma.userRole.findFirst({
      where: {
        userId: memberId,
        organizationId,
      },
      include: {
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!targetUserRole) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Member not found in this organization',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Cannot remove yourself
    if (session.userId === memberId) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You cannot remove yourself from the organization',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Cannot remove the owner
    if (targetUserRole.role.name === ROLES.OWNER) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Cannot remove the organization owner',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Remove member by deleting their UserRole for this organization
    await prisma.userRole.delete({
      where: { id: targetUserRole.id },
    });

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
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
