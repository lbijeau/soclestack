import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAuditLogs, AuditAction, AuditCategory } from '@/lib/audit';
import { isImpersonating } from '@/lib/auth/impersonation';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    // Must be logged in
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Cannot access while impersonating
    if (isImpersonating(session)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot access audit logs while impersonating',
          },
        },
        { status: 403 }
      );
    }

    // Get user with roles
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        ...userWithRolesInclude,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as AuditCategory | null;
    const action = searchParams.get('action') as AuditAction | null;
    const userEmail = searchParams.get('userEmail');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      10000
    );
    const orgScope = searchParams.get('organizationId'); // 'all' for system admins to see everything

    // Build filters
    const filters: Parameters<typeof getAuditLogs>[0] = {
      limit,
      offset: (page - 1) * limit,
    };

    if (category) filters.category = category;
    if (action) filters.action = action;
    if (userEmail) filters.userEmail = userEmail;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);

    // Determine organization scoping
    // Platform ADMIN can see all logs or filter by any org
    // Organization ADMIN can only see logs from their organization(s)
    const isPlatformAdmin = await isGranted(user, ROLES.ADMIN);

    if (isPlatformAdmin) {
      // Platform admin - can see all or filter by specific org
      if (orgScope && orgScope !== 'all') {
        filters.organizationId = orgScope;
      }
      // If orgScope is 'all' or not specified, no filter applied (sees everything)
    } else {
      // Check if user is admin of any organizations
      const adminOrgs = user.userRoles.filter(
        (ur) =>
          ur.organizationId &&
          (ur.role.name === 'ROLE_ADMIN' || ur.role.name === 'ROLE_OWNER')
      );

      if (adminOrgs.length === 0) {
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

      // Org admin can only see their org(s) logs
      if (adminOrgs.length === 1) {
        filters.organizationId = adminOrgs[0].organizationId!;
      } else if (orgScope && orgScope !== 'all') {
        // Verify they're admin of the requested org
        const hasAccess = adminOrgs.some(
          (ur) => ur.organizationId === orgScope
        );
        if (!hasAccess) {
          return NextResponse.json(
            {
              error: {
                type: 'AUTHORIZATION_ERROR',
                message: 'Not authorized for this organization',
              },
            },
            { status: 403 }
          );
        }
        filters.organizationId = orgScope;
      } else {
        return NextResponse.json(
          {
            error: {
              type: 'VALIDATION_ERROR',
              message:
                'You are admin of multiple organizations. Please specify organizationId parameter.',
            },
          },
          { status: 400 }
        );
      }
    }

    const result = await getAuditLogs(filters);

    return NextResponse.json({
      logs: result.logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
      })),
      total: result.total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to fetch audit logs' },
      },
      { status: 500 }
    );
  }
}
