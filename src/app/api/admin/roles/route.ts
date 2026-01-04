import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  isGranted,
  ROLES,
  clearRoleHierarchyCache,
} from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * Validation schema for creating a new role
 */
const createRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(
      /^ROLE_[A-Z][A-Z0-9_]*$/,
      'Role name must start with ROLE_ and contain only uppercase letters, numbers, and underscores'
    ),
  description: z.string().optional(),
  parentId: z.string().optional(),
});

/**
 * GET /api/admin/roles
 *
 * List all roles with hierarchy info and user counts.
 * Requires ROLE_ADMIN access.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (!(await isGranted(user, ROLES.ADMIN))) {
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

    const roles = await prisma.role.findMany({
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
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        parentId: role.parentId,
        parentName: role.parent?.name ?? null,
        isSystem: role.isSystem,
        userCount: role._count.userRoles,
        createdAt: role.createdAt.toISOString(),
        updatedAt: role.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Admin roles list error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to fetch roles',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/roles
 *
 * Create a new role.
 * Requires ROLE_ADMIN access.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (!(await isGranted(user, ROLES.ADMIN))) {
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

    const body = await req.json();
    const parseResult = createRoleSchema.safeParse(body);

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

    const { name, description, parentId } = parseResult.data;

    // Check for duplicate name
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Role name already exists',
          },
        },
        { status: 409 }
      );
    }

    // Validate parent exists if provided
    if (parentId) {
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
    }

    // Create the role
    const role = await prisma.role.create({
      data: {
        name,
        description: description ?? null,
        parentId: parentId ?? null,
        isSystem: false,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Clear role hierarchy cache since we added a new role
    clearRoleHierarchyCache();

    // Audit log
    await logAuditEvent({
      action: 'ADMIN_ROLE_CREATED',
      category: 'admin',
      userId: user.id,
      metadata: {
        roleId: role.id,
        roleName: role.name,
        parentId: role.parentId,
      },
    });

    return NextResponse.json(
      {
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
          parentId: role.parentId,
          parentName: role.parent?.name ?? null,
          isSystem: role.isSystem,
          userCount: 0,
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Admin role create error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to create role',
        },
      },
      { status: 500 }
    );
  }
}
