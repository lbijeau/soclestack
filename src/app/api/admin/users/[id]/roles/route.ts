import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isRateLimited,
  getCurrentUser,
  invalidateUserSessions,
} from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ROLES } from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/api-utils';

export const runtime = 'nodejs';

/** Rate limit: 50 role assignment changes per hour */
const ROLE_ASSIGNMENT_LIMIT = 50;
/** Rate limit window in milliseconds (1 hour) */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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
 * Validation schema for assigning a single role with organization context
 */
const assignRoleSchema = z.object({
  roleName: z.string().regex(/^ROLE_[A-Z][A-Z0-9_]+$/),
  organizationId: z.string().nullable().optional(),
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
 * Role data for response formatting
 */
interface RoleData {
  id: string;
  name: string;
  description: string | null;
}

/**
 * User data for response formatting
 */
interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Format user roles response (shared between GET and PUT)
 */
function formatUserRolesResponse(
  user: UserData,
  directRoles: RoleData[],
  inheritedRoles: RoleData[]
) {
  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    directRoles,
    inheritedRoles,
  };
}

/**
 * GET /api/admin/users/[id]/roles
 *
 * Get user's assigned roles (direct and inherited).
 * Requires ROLE_ADMIN access.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

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

    return NextResponse.json(
      formatUserRolesResponse(user, directRoles, inheritedRoles)
    );
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
 * - Cannot remove your own admin role (self-protection)
 * - Cannot remove last ROLE_ADMIN assignment from the system
 * - All roleIds must exist
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const currentUser = auth.user;

    // Rate limit role assignment changes per admin
    const rateLimitKey = `admin-user-roles:${currentUser.id}`;
    if (
      isRateLimited(rateLimitKey, ROLE_ASSIGNMENT_LIMIT, RATE_LIMIT_WINDOW_MS)
    ) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message:
              'Too many role assignment changes. Please try again later.',
          },
        },
        { status: 429, headers: { 'Retry-After': '3600' } }
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
    const isRemovingAdminRole = currentAdminRole && !newAdminRole;

    // Self-protection: prevent admins from removing their own admin role
    if (isRemovingAdminRole && userId === currentUser.id) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Cannot remove your own admin role',
          },
        },
        { status: 400 }
      );
    }

    // Get current role IDs for audit log
    const previousRoleIds = user.userRoles.map((ur) => ur.role.id);
    const previousRoleNames = user.userRoles.map((ur) => ur.role.name);

    // Replace all roles in a transaction with last-admin check
    await prisma.$transaction(async (tx) => {
      // Check last admin inside transaction to prevent race condition
      if (isRemovingAdminRole) {
        const adminCount = await tx.userRole.count({
          where: {
            role: { name: ROLES.ADMIN },
          },
        });

        if (adminCount <= 1) {
          throw new Error('LAST_ADMIN');
        }
      }

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

    // Invalidate user sessions to force re-authentication with new roles
    await invalidateUserSessions(userId);

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

    return NextResponse.json(
      formatUserRolesResponse(user, directRoles, inheritedRoles)
    );
  } catch (error) {
    // Handle last admin error from transaction
    if (error instanceof Error && error.message === 'LAST_ADMIN') {
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

/**
 * POST /api/admin/users/[id]/roles
 *
 * Assign a single role to a user with optional organization context.
 * - Platform admins can assign platform-wide roles (organizationId: null)
 * - Org admins can assign org-scoped roles in their organization only
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    const { id: targetUserId } = await params;

    // Parse and validate body
    const body = await req.json();
    const parseResult = assignRoleSchema.safeParse(body);

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

    const { roleName, organizationId } = parseResult.data;

    // Authorization: Only platform admin can assign platform-wide roles
    if (organizationId === null || organizationId === undefined) {
      const isPlatformAdmin = await requireAdmin(user, null);
      if (!isPlatformAdmin) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'Only platform admins can assign platform-wide roles',
            },
          },
          { status: 403 }
        );
      }
    } else {
      // Org-scoped assignment: must be admin of that org
      const isOrgAdmin = await requireAdmin(user, organizationId);
      if (!isOrgAdmin) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'Not authorized to assign roles in this organization',
            },
          },
          { status: 403 }
        );
      }
    }

    // Find role by name
    const role = await prisma.role.findUnique({
      where: { name: roleName },
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

    // Create role assignment with context
    const assignment = await prisma.userRole.create({
      data: {
        userId: targetUserId,
        roleId: role.id,
        organizationId: organizationId ?? null,
      },
      include: {
        role: true,
        organization: true,
      },
    });

    // Invalidate user sessions to force re-authentication with new role
    await invalidateUserSessions(targetUserId);

    // Audit log
    await logAuditEvent({
      action: 'ADMIN_USER_ROLE_ASSIGNED',
      category: 'admin',
      userId: user.id,
      metadata: {
        targetUserId,
        roleName,
        organizationId: assignment.organizationId,
        organizationName: assignment.organization?.name ?? null,
      },
    });

    return NextResponse.json(
      {
        assignment: {
          id: assignment.id,
          userId: assignment.userId,
          roleName: assignment.role.name,
          organizationId: assignment.organizationId,
          organizationName: assignment.organization?.name ?? null,
          createdAt: assignment.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Admin user role assignment error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to assign role',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/roles
 *
 * Remove a specific role assignment from a user.
 * Requires roleName and organizationId query parameters to identify the exact assignment.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    const { id: targetUserId } = await params;
    const { searchParams } = new URL(req.url);
    const roleName = searchParams.get('roleName');
    const organizationId = searchParams.get('organizationId'); // Can be 'null' string

    if (!roleName) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'roleName query parameter is required',
          },
        },
        { status: 400 }
      );
    }

    // Parse organizationId (handle 'null' string from query params)
    const parsedOrgId =
      organizationId === 'null' || organizationId === null
        ? null
        : organizationId;

    // Authorization check (same as POST)
    if (parsedOrgId === null) {
      const isPlatformAdmin = await requireAdmin(user, null);
      if (!isPlatformAdmin) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'Only platform admins can remove platform-wide roles',
            },
          },
          { status: 403 }
        );
      }
    } else {
      const isOrgAdmin = await requireAdmin(user, parsedOrgId);
      if (!isOrgAdmin) {
        return NextResponse.json(
          {
            error: {
              type: 'AUTHORIZATION_ERROR',
              message: 'Not authorized to remove roles in this organization',
            },
          },
          { status: 403 }
        );
      }
    }

    // Find and delete the specific role assignment
    const role = await prisma.role.findUnique({
      where: { name: roleName },
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

    await prisma.userRole.deleteMany({
      where: {
        userId: targetUserId,
        roleId: role.id,
        organizationId: parsedOrgId,
      },
    });

    // Invalidate user sessions to force re-authentication without removed role
    await invalidateUserSessions(targetUserId);

    // Audit log
    await logAuditEvent({
      action: 'ADMIN_USER_ROLE_REMOVED',
      category: 'admin',
      userId: user.id,
      metadata: {
        targetUserId,
        roleName,
        organizationId: parsedOrgId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin user role removal error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to remove role',
        },
      },
      { status: 500 }
    );
  }
}
