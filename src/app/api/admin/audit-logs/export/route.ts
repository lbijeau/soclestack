import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AuditAction, AuditCategory } from '@/lib/audit';
import { isImpersonating } from '@/lib/auth/impersonation';
import { hasOrgRole } from '@/lib/organization';

export const runtime = 'nodejs';

const MAX_EXPORT_ROWS = 10000;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    if (isImpersonating(session)) {
      return NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot export audit logs while impersonating',
          },
        },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true, organizationId: true, organizationRole: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const category = searchParams.get('category') as AuditCategory | null;
    const action = searchParams.get('action') as AuditAction | null;
    const userEmail = searchParams.get('userEmail');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const orgScope = searchParams.get('organizationId');

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Format must be csv or json',
          },
        },
        { status: 400 }
      );
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (category) where.category = category;
    if (action) where.action = action;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (userEmail) {
      where.user = { email: { contains: userEmail } };
    }

    // Authorization and org scoping
    if (user.role === 'ADMIN') {
      if (orgScope && orgScope !== 'all') {
        where.user = { ...where.user, organizationId: orgScope };
      }
    } else if (
      user.organizationId &&
      hasOrgRole(user.organizationRole, 'ADMIN')
    ) {
      where.user = { ...where.user, organizationId: user.organizationId };
    } else {
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

    // Fetch logs with limit
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const jsonData = logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        userEmail: log.user?.email ?? null,
        action: log.action,
        category: log.category,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        createdAt: log.createdAt.toISOString(),
      }));

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.json"`,
        },
      });
    }

    // CSV format
    const csvHeaders = [
      'ID',
      'Timestamp',
      'User Email',
      'Action',
      'Category',
      'IP Address',
      'User Agent',
      'Metadata',
    ];
    const csvRows = logs.map((log) => [
      log.id,
      log.createdAt.toISOString(),
      log.user?.email ?? '',
      log.action,
      log.category,
      log.ipAddress ?? '',
      log.userAgent ?? '',
      log.metadata ? log.metadata.replace(/"/g, '""') : '',
    ]);

    const escapeCsvField = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field}"`;
      }
      return field;
    };

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) => row.map(escapeCsvField).join(',')),
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('Audit log export error:', error);
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to export audit logs' },
      },
      { status: 500 }
    );
  }
}
