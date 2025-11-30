import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAuditLogs, AuditAction, AuditCategory } from '@/lib/audit';
import { isImpersonating } from '@/lib/auth/impersonation';

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

    // Must be ADMIN (not MODERATOR - audit logs are sensitive)
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: { type: 'AUTHORIZATION_ERROR', message: 'Admin access required' } },
        { status: 403 }
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
