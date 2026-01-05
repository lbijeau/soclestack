import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getCurrentOrganizationId } from '@/lib/organization';
import { getHighestRole, userWithRolesInclude } from '@/lib/security/index';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

// GET /api/organizations/current/members - List all members
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

    // Get all UserRole records for this organization
    const userRoles = await prisma.userRole.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            ...userWithRolesInclude,
          },
        },
        role: {
          select: {
            name: true,
            parentId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Transform to member objects with computed highest role
    const members = userRoles.map((ur) => ({
      id: ur.user.id,
      email: ur.user.email,
      username: ur.user.username,
      firstName: ur.user.firstName,
      lastName: ur.user.lastName,
      role: getHighestRole(ur.user),
      isActive: ur.user.isActive,
      lastLoginAt: ur.user.lastLoginAt,
      createdAt: ur.user.createdAt,
    }));

    // Sort by role hierarchy (OWNER > ADMIN > MODERATOR > USER)
    const roleOrder = {
      ROLE_OWNER: 0,
      ROLE_ADMIN: 1,
      ROLE_MODERATOR: 2,
      ROLE_USER: 3,
    };

    members.sort((a, b) => {
      const aOrder =
        roleOrder[a.role as keyof typeof roleOrder] ?? Number.MAX_SAFE_INTEGER;
      const bOrder =
        roleOrder[b.role as keyof typeof roleOrder] ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Get members error:', error);
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
