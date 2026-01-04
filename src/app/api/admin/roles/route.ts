import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isRateLimited } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { clearRoleHierarchyCache } from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';
import { requireAdmin } from '@/lib/api-utils';

export const runtime = 'nodejs';

/** Rate limit: 20 role creations per hour */
const ROLE_CREATE_LIMIT = 20;
/** Rate limit window in milliseconds (1 hour) */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

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
            children: true,
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
        childCount: role._count.children,
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
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    // Rate limit role creations per admin
    const rateLimitKey = `admin-role-create:${user.id}`;
    if (isRateLimited(rateLimitKey, ROLE_CREATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message: 'Too many role creations. Please try again later.',
          },
        },
        { status: 429, headers: { 'Retry-After': '3600' } }
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
          childCount: 0,
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
