import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getAuditLogs, AuditAction, AuditCategory } from '@/lib/audit';
import { isImpersonating } from '@/lib/auth/impersonation';
import { hasOrgRole } from '@/lib/organization';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    // Must be logged in
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Cannot access while impersonating
    if (isImpersonating(session)) {
      return NextResponse.json(
        { error: { type: 'FORBIDDEN', message: 'Cannot access audit logs while impersonating' } },
        { status: 403 }
      );
    }

    // Get user with organization info
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, organizationId: true, organizationRole: true }
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 10000);
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
    // System ADMIN can see all logs or filter by any org
    // Organization ADMIN can only see logs from their organization
    if (user.role === 'ADMIN') {
      // System admin - can see all or filter by specific org
      if (orgScope && orgScope !== 'all') {
        filters.organizationId = orgScope;
      }
      // If orgScope is 'all' or not specified, no filter applied (sees everything)
    } else if (user.organizationId && hasOrgRole(user.organizationRole, 'ADMIN')) {
      // Organization admin - can only see their org's logs
      filters.organizationId = user.organizationId;
    } else {
      // Not authorized to view audit logs
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
      );
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
      { error: { type: 'SERVER_ERROR', message: 'Failed to fetch audit logs' } },
      { status: 500 }
    );
  }
}
