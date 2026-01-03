import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, hasRequiredRole } from '@/lib/auth';
import { userListParamsSchema } from '@/lib/validations';
import { prisma } from '@/lib/db';
import { AuthError } from '@/types/auth';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const currentUser = await getCurrentUser();
    if (!currentUser) {
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

    // Check authorization (only admins and moderators can list users)
    if (!hasRequiredRole(currentUser.role, 'MODERATOR')) {
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
    const where: Prisma.UserWhereInput = {
      // Organization-level access filter
      ...(currentUser.organizationId !== null && {
        organizationId: currentUser.organizationId,
      }),
      ...(search && {
        OR: [
          { email: { contains: search } },
          { username: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      }),
      ...(role && { role }),
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
        role: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(totalUsers / limit);

    return NextResponse.json({
      users,
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
