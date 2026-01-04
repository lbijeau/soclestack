import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasRequiredRole } from '@/lib/auth';
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '@/lib/validations';
import { prisma } from '@/lib/db';
import { AuthError } from '@/types/auth';
import { canAccessUserInOrg } from '@/lib/organization';

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

    // Users can view their own profile, admins/moderators can view profiles in their org
    if (auth.user.id !== id && !hasRequiredRole(auth.user.role, 'MODERATOR')) {
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

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
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

    // Check organization-level access for non-self requests
    if (
      auth.user.id !== id &&
      !canAccessUserInOrg(auth.user.organizationId, user.organizationId)
    ) {
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

    return NextResponse.json({ user });
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

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, email: true, organizationId: true },
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

    // Check organization-level access
    if (
      !canAccessUserInOrg(auth.user.organizationId, targetUser.organizationId)
    ) {
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
      if (!hasRequiredRole(auth.user.role, 'ADMIN')) {
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

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role: validationResult.data.role },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        message: 'User role updated successfully',
        user: updatedUser,
      });
    }

    // Check if trying to update status
    if ('isActive' in body) {
      // Only admins can change user status
      if (!hasRequiredRole(auth.user.role, 'ADMIN')) {
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
          role: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
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
        user: updatedUser,
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

    // Only admins can delete users
    if (!hasRequiredRole(auth.user.role, 'ADMIN')) {
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

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
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

    // Check organization-level access
    if (
      !canAccessUserInOrg(auth.user.organizationId, targetUser.organizationId)
    ) {
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

    // Delete user (cascade will handle related records)
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
