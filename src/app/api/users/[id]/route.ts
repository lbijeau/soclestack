import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '@/lib/validations';
import { prisma } from '@/lib/db';
import { AuthError } from '@/types/auth';
import {
  getHighestRole,
  userWithRolesInclude,
  ROLES,
} from '@/lib/security/index';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Fetch target user
    const user = await prisma.user.findUnique({
      where: { id },
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
        sessions: {
          where: { isActive: true },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'User not found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Users can view their own profile
    if (auth.user.id === id) {
      const userWithRole = {
        ...user,
        role: getHighestRole(user),
      };
      return NextResponse.json({ user: userWithRole });
    }

    // For non-self requests, check if auth user has MODERATOR+ in any organization
    const authUserFull = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        ...userWithRolesInclude,
      },
    });

    if (!authUserFull) {
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

    // Check if auth user has MODERATOR+ role in any organization
    const hasModerator = authUserFull.userRoles.some((ur) =>
      [
        ROLES.MODERATOR,
        ROLES.ADMIN,
        ROLES.OWNER,
        'ROLE_PLATFORM_ADMIN', // Keep as string - not in standard ROLES
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

    // Get organizations where auth user has MODERATOR+
    const authOrgIds = authUserFull.userRoles
      .filter((ur) =>
        [
          ROLES.MODERATOR,
          ROLES.ADMIN,
          ROLES.OWNER,
          'ROLE_PLATFORM_ADMIN', // Keep as string - not in standard ROLES
        ].includes(ur.role.name)
      )
      .map((ur) => ur.organizationId)
      .filter((orgId): orgId is string => orgId !== null);

    // Check if target user is in any of those organizations (or if auth user is platform admin)
    const hasPlatformAccess = authUserFull.userRoles.some(
      (ur) =>
        ur.organizationId === null &&
        [ROLES.ADMIN, 'ROLE_PLATFORM_ADMIN'].includes(ur.role.name)
    );

    const targetUserOrgIds = user.userRoles
      .map((ur) => ur.organizationId)
      .filter((orgId): orgId is string => orgId !== null);

    const hasSharedOrg =
      hasPlatformAccess ||
      targetUserOrgIds.some((orgId) => authOrgIds.includes(orgId));

    if (!hasSharedOrg) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'User not found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Add computed role for backward compatibility
    const userWithRole = {
      ...user,
      role: getHighestRole(user),
    };

    return NextResponse.json({ user: userWithRole });
  } catch (error) {
    console.error('Get user error:', error);
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

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await req.json();

    // Get auth user with roles
    const authUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        ...userWithRolesInclude,
      },
    });

    if (!authUser) {
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

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        ...userWithRolesInclude,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'User not found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Check if trying to update role
    if ('role' in body) {
      // Only admins can change roles
      const hasAdmin = authUser.userRoles.some((ur) =>
        [ROLES.ADMIN, ROLES.OWNER, 'ROLE_PLATFORM_ADMIN'].includes(ur.role.name)
      );

      if (!hasAdmin) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'Only administrators can change user roles',
            } as AuthError,
          },
          { status: 403 }
        );
      }

      // Can't change own role
      if (auth.user.id === id) {
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

      const validationResult = updateUserRoleSchema.safeParse(body);
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

      // Find the target role
      const targetRole = await prisma.role.findUnique({
        where: { name: `ROLE_${validationResult.data.role}` },
      });

      if (!targetRole) {
        return NextResponse.json(
          {
            error: {
              type: 'NOT_FOUND',
              message: 'Role not found',
            } as AuthError,
          },
          { status: 404 }
        );
      }

      // Update user role in a transaction
      const updatedUser = await prisma.$transaction(async (tx) => {
        // Remove existing roles
        await tx.userRole.deleteMany({
          where: { userId: id },
        });

        // Add new role
        await tx.userRole.create({
          data: {
            userId: id,
            roleId: targetRole.id,
          },
        });

        // Return updated user
        return tx.user.findUnique({
          where: { id },
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
        });
      });

      return NextResponse.json({
        message: 'User role updated successfully',
        user: updatedUser
          ? { ...updatedUser, role: getHighestRole(updatedUser) }
          : null,
      });
    }

    // Check if trying to update status
    if ('isActive' in body) {
      // Only admins can change user status
      const hasAdmin = authUser.userRoles.some((ur) =>
        [ROLES.ADMIN, ROLES.OWNER, 'ROLE_PLATFORM_ADMIN'].includes(ur.role.name)
      );

      if (!hasAdmin) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'Only administrators can change user status',
            } as AuthError,
          },
          { status: 403 }
        );
      }

      // Can't deactivate own account
      if (auth.user.id === id && !body.isActive) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'You cannot deactivate your own account',
            } as AuthError,
          },
          { status: 403 }
        );
      }

      const validationResult = updateUserStatusSchema.safeParse(body);
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

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: validationResult.data.isActive },
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
      });

      // If deactivating user, logout from all devices
      if (!validationResult.data.isActive) {
        await prisma.userSession.deleteMany({
          where: { userId: id },
        });
      }

      return NextResponse.json({
        message: 'User status updated successfully',
        user: { ...updatedUser, role: getHighestRole(updatedUser) },
      });
    }

    return NextResponse.json(
      {
        error: {
          type: 'VALIDATION_ERROR',
          message: 'No valid update fields provided',
        } as AuthError,
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Update user error:', error);
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

export async function DELETE(req: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Can't delete own account
    if (auth.user.id === id) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'You cannot delete your own account',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Get auth user with roles
    const authUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        ...userWithRolesInclude,
      },
    });

    if (!authUser) {
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

    // Only admins can delete users
    const hasAdmin = authUser.userRoles.some((ur) =>
      [ROLES.ADMIN, ROLES.OWNER, 'ROLE_PLATFORM_ADMIN'].includes(ur.role.name)
    );

    if (!hasAdmin) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Only administrators can delete users',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        ...userWithRolesInclude,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'User not found',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    // Delete user (cascade will handle related records including UserRole)
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
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
