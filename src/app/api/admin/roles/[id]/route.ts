import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isRateLimited } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { clearRoleHierarchyCache } from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/api-utils';

export const runtime = 'nodejs';

/** Maximum number of users to return in a single request */
const MAX_USERS_LIMIT = 100;

/** Rate limit: 30 role updates per hour */
const ROLE_UPDATE_LIMIT = 30;
/** Rate limit: 10 role deletions per hour */
const ROLE_DELETE_LIMIT = 10;
/** Rate limit window in milliseconds (1 hour) */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Validation schema for updating a role
 */
const updateRoleSchema = z.object({
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

/**
 * Check if targetId is a descendant of roleId (would create circular hierarchy)
 */
async function isDescendant(
  roleId: string,
  targetId: string
): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = targetId;

  while (currentId && !visited.has(currentId)) {
    if (currentId === roleId) {
      return true;
    }
    visited.add(currentId);

    const parentLookup: { parentId: string | null } | null =
      await prisma.role.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

    currentId = parentLookup?.parentId ?? null;
  }

  return false;
}

/**
 * GET /api/admin/roles/[id]
 *
 * Get role details with assigned users and child roles.
 * Requires ROLE_ADMIN access.
 *
 * Query params:
 * - usersLimit: number (optional) - Max users to return (default: all)
 * - usersOffset: number (optional) - Offset for pagination (default: 0)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;

    // Parse pagination params
    const searchParams = req.nextUrl.searchParams;
    const usersLimitParam = searchParams.get('usersLimit');
    const usersOffsetParam = searchParams.get('usersOffset');

    const usersLimit = usersLimitParam
      ? Math.min(parseInt(usersLimitParam, 10), MAX_USERS_LIMIT)
      : undefined;
    const usersOffset = usersOffsetParam ? parseInt(usersOffsetParam, 10) : 0;

    // Validate pagination params
    if (usersLimit !== undefined && (isNaN(usersLimit) || usersLimit < 0)) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'usersLimit must be a non-negative integer',
          },
        },
        { status: 400 }
      );
    }

    if (isNaN(usersOffset) || usersOffset < 0) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'usersOffset must be a non-negative integer',
          },
        },
        { status: 400 }
      );
    }

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
          },
        },
        userRoles: {
          skip: usersOffset,
          take: usersLimit,
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Role not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        parentId: role.parentId,
        parentName: role.parent?.name ?? null,
        isSystem: role.isSystem,
        users: role.userRoles.map((ur) => ({
          id: ur.user.id,
          email: ur.user.email,
          firstName: ur.user.firstName,
          lastName: ur.user.lastName,
        })),
        totalUsers: role._count.userRoles,
        hasMoreUsers:
          usersOffset + role.userRoles.length < role._count.userRoles,
        childRoles: role.children.map((child) => ({
          id: child.id,
          name: child.name,
        })),
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin role get error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to fetch role',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/roles/[id]
 *
 * Update role description and/or parent.
 * Requires ROLE_ADMIN access.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    // Rate limit role updates per admin
    const rateLimitKey = `admin-role-update:${user.id}`;
    if (isRateLimited(rateLimitKey, ROLE_UPDATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many role updates. Please try again later.',
          },
        },
        { status: 429, headers: { 'Retry-After': '3600' } }
      );
    }

    const { id } = await params;

    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Role not found',
          },
        },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parseResult = updateRoleSchema.safeParse(body);

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

    const { description, parentId } = parseResult.data;

    // Validate parent if provided
    if (parentId !== undefined && parentId !== null) {
      // Cannot set parent to self
      if (parentId === id) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Cannot set role as its own parent',
            },
          },
          { status: 400 }
        );
      }

      // Check parent exists
      const parentRole = await prisma.role.findUnique({
        where: { id: parentId },
      });

      if (!parentRole) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message: 'Parent role not found',
            },
          },
          { status: 400 }
        );
      }

      // Check for circular hierarchy (parent is a descendant of this role)
      if (await isDescendant(id, parentId)) {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message:
                'Cannot set parent to a descendant role (circular hierarchy)',
            },
          },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: {
      description?: string | null;
      parentId?: string | null;
    } = {};

    if (description !== undefined) {
      updateData.description = description;
    }

    if (parentId !== undefined) {
      updateData.parentId = parentId;
    }

    const role = await prisma.role.update({
      where: { id },
      data: updateData,
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    // Clear role hierarchy cache since we may have changed parent
    if (parentId !== undefined) {
      clearRoleHierarchyCache();
    }

    // Audit log
    await logAuditEvent({
      action: 'ADMIN_ROLE_UPDATED',
      category: 'admin',
      userId: user.id,
      metadata: {
        roleId: role.id,
        roleName: role.name,
        changes: updateData,
      },
    });

    return NextResponse.json({
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        parentId: role.parentId,
        parentName: role.parent?.name ?? null,
        isSystem: role.isSystem,
        userCount: role._count.userRoles,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin role update error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to update role',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/roles/[id]
 *
 * Delete a non-system role.
 * Requires ROLE_ADMIN access.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    // Rate limit role deletions per admin
    const rateLimitKey = `admin-role-delete:${user.id}`;
    if (isRateLimited(rateLimitKey, ROLE_DELETE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many role deletions. Please try again later.',
          },
        },
        { status: 429, headers: { 'Retry-After': '3600' } }
      );
    }

    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userRoles: true,
            children: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'Role not found',
          },
        },
        { status: 404 }
      );
    }

    // Cannot delete system roles
    if (role.isSystem) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Cannot delete system roles',
          },
        },
        { status: 400 }
      );
    }

    // Cannot delete roles with assigned users
    if (role._count.userRoles > 0) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: `Cannot delete role with ${role._count.userRoles} assigned user(s)`,
          },
        },
        { status: 400 }
      );
    }

    // Cannot delete roles with children
    if (role._count.children > 0) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: `Cannot delete role with ${role._count.children} child role(s)`,
          },
        },
        { status: 400 }
      );
    }

    await prisma.role.delete({
      where: { id },
    });

    // Clear role hierarchy cache
    clearRoleHierarchyCache();

    // Audit log
    await logAuditEvent({
      action: 'ADMIN_ROLE_DELETED',
      category: 'admin',
      userId: user.id,
      metadata: {
        roleId: role.id,
        roleName: role.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin role delete error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to delete role',
        },
      },
      { status: 500 }
    );
  }
}
