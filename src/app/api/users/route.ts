import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasRequiredRole } from '@/lib/auth';
import { userListParamsSchema } from '@/lib/validations';
import { prisma } from '@/lib/db';
import { AuthError } from '@/types/auth';
import { Prisma } from '@prisma/client';
import { getHighestRole, userWithRolesInclude } from '@/lib/security/index';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Check authentication (supports both session and API key)
    const auth = await requireAuth(req);
    if (!auth.success) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: auth.error,
          } as AuthError,
        },
        { status: auth.status }
      );
    }
    const { user: authUser } = auth;

    // Get full user with roles for authorization
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        username: true,
        ...userWithRolesInclude,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'User not found',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Check authorization - user must have MODERATOR+ role in any organization or platform-wide
    const hasModerator = user.userRoles.some((ur) =>
      [
        'ROLE_MODERATOR',
        'ROLE_ADMIN',
        'ROLE_OWNER',
        'ROLE_PLATFORM_ADMIN',
      ].includes(ur.role.name)
    );

    if (!hasModerator) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Insufficient permissions',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = userListParamsSchema.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validationResult.error.flatten().fieldErrors,
          } as AuthError,
        },
        { status: 400 }
      );
    }

    const { page, limit, search, role, isActive, sortBy, sortOrder } =
      validationResult.data;
    const locked = searchParams.get('locked') === 'true';

    // Build where clause with organization filter
    // Platform super-admins (no org) can see all users
    // Organization-bound admins can only see users in their org

    // Check if user is platform admin (has ADMIN role with no organization)
    const isPlatformAdmin = user.userRoles.some(
      (ur) => ur.organizationId === null && ur.role.name === 'ROLE_ADMIN'
    );

    // If not platform admin, get organization IDs where user is admin
    const adminOrgIds = isPlatformAdmin
      ? []
      : user.userRoles
          .filter(
            (ur) =>
              ur.organizationId !== null &&
              (ur.role.name === 'ROLE_ADMIN' || ur.role.name === 'ROLE_OWNER')
          )
          .map((ur) => ur.organizationId as string);

    const where: Prisma.UserWhereInput = {
      // Organization-level access filter
      ...(!isPlatformAdmin &&
        adminOrgIds.length > 0 && {
          userRoles: {
            some: {
              organizationId: { in: adminOrgIds },
            },
          },
        }),
      ...(search && {
        OR: [
          { email: { contains: search } },
          { username: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      }),
      ...(role && {
        userRoles: {
          some: {
            role: { name: `ROLE_${role}` },
          },
        },
      }),
      ...(isActive !== undefined && { isActive }),
      ...(locked && { lockedUntil: { gt: new Date() } }),
    };

    // Get total count
    const totalUsers = await prisma.user.count({ where });

    // Get users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        ...userWithRolesInclude,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Add computed role for backward compatibility
    const usersWithRoles = users.map((u) => ({
      ...u,
      role: getHighestRole(u),
    }));

    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      users: usersWithRoles,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
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
