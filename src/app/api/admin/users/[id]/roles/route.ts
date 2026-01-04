import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGranted, ROLES, clearRoleHierarchyCache } from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Validation schema for setting user roles
 */
const setUserRolesSchema = z.object({
  roleIds: z.array(z.string().min(1)).min(1, 'At least one role is required'),
});

/**
 * Get all roles a user inherits from a given set of direct roles
 */
async function getInheritedRoles(
  directRoleIds: string[]
): Promise<Array<{ id: string; name: string; description: string | null }>> {
  if (directRoleIds.length === 0) return [];

  // Get all roles to build hierarchy
  const allRoles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
    },
  });

  const roleById = new Map(allRoles.map((r) => [r.id, r]));
  const directIdSet = new Set(directRoleIds);
  const inheritedIds = new Set<string>();

  // For each direct role, walk up the parent chain
  for (const directId of directRoleIds) {
    let current = roleById.get(directId);
    const visited = new Set<string>();

    while (current?.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      // Only add to inherited if not a direct role
      if (!directIdSet.has(current.parentId)) {
        inheritedIds.add(current.parentId);
      }
      current = roleById.get(current.parentId);
    }
  }

  return Array.from(inheritedIds)
    .map((id) => roleById.get(id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
    .map((r) => ({ id: r.id, name: r.name, description: r.description }));
}

/**
 * GET /api/admin/users/[id]/roles
 *
 * Get user's assigned roles (direct and inherited).
 * Requires ROLE_ADMIN access.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (!(await isGranted(currentUser, ROLES.ADMIN))) {
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

    const { id: userId } = await params;

    // Check user exists and get their roles
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    const directRoles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
    }));

    const directRoleIds = directRoles.map((r) => r.id);
    const inheritedRoles = await getInheritedRoles(directRoleIds);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      directRoles,
      inheritedRoles,
    });
  } catch (error) {
    console.error('Admin user roles get error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to fetch user roles',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[id]/roles
 *
 * Set user's roles (replaces all existing roles).
 * Requires ROLE_ADMIN access.
 *
 * Validation:
 * - Cannot remove last ROLE_ADMIN assignment from the system
 * - All roleIds must exist
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (!(await isGranted(currentUser, ROLES.ADMIN))) {
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

    const { id: userId } = await params;

    // Parse and validate body
    const body = await req.json();
    const parseResult = setUserRolesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { roleIds } = parseResult.data;

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userRoles: {
          include: {
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

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    // Validate all roleIds exist
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true, description: true },
    });

    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r) => r.id));
      const missingIds = roleIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: `Role(s) not found: ${missingIds.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Check if removing ROLE_ADMIN from this user
    const currentAdminRole = user.userRoles.find(
      (ur) => ur.role.name === ROLES.ADMIN
    );
    const newAdminRole = roles.find((r) => r.name === ROLES.ADMIN);

    if (currentAdminRole && !newAdminRole) {
      // User currently has ROLE_ADMIN but won't after this change
      // Check if this is the last admin
      const adminCount = await prisma.userRole.count({
        where: {
          role: { name: ROLES.ADMIN },
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Cannot remove the last admin user',
            },
          },
          { status: 400 }
        );
      }
    }

    // Get current role IDs for audit log
    const previousRoleIds = user.userRoles.map((ur) => ur.role.id);
    const previousRoleNames = user.userRoles.map((ur) => ur.role.name);

    // Replace all roles in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing roles
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // Create new roles
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({
          userId,
          roleId,
        })),
      });
    });

    // Clear role hierarchy cache since user roles changed
    clearRoleHierarchyCache();

    // Audit log
    await logAuditEvent({
      action: 'ADMIN_USER_ROLES_UPDATED',
      category: 'admin',
      userId: currentUser.id,
      metadata: {
        targetUserId: userId,
        targetEmail: user.email,
        previousRoleIds,
        previousRoleNames,
        newRoleIds: roleIds,
        newRoleNames: roles.map((r) => r.name),
      },
    });

    // Fetch updated user roles for response
    const directRoles = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
    }));
    const inheritedRoles = await getInheritedRoles(roleIds);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      directRoles,
      inheritedRoles,
    });
  } catch (error) {
    console.error('Admin user roles update error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to update user roles',
        },
      },
      { status: 500 }
    );
  }
}
