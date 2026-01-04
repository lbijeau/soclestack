import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AuditAction, AuditCategory } from '@/lib/audit';
import { isImpersonating } from '@/lib/auth/impersonation';
import { hasOrgRole } from '@/lib/organization';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';
import log from '@/lib/logger';

export const runtime = 'nodejs';

// Batch size for streaming - smaller batches = lower memory, more queries
const BATCH_SIZE = 500;
// Maximum total rows to export (safety limit)
const MAX_EXPORT_ROWS = 100000;

// Safe JSON parse helper - returns raw string if invalid JSON
function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// CSV escape helper
function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Format a single audit log row as CSV
function formatCsvRow(log: {
  id: string;
  createdAt: Date;
  user: { email: string } | null;
  action: string;
  category: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: string | null;
}): string {
  const fields = [
    log.id,
    log.createdAt.toISOString(),
    log.user?.email ?? '',
    log.action,
    log.category,
    log.ipAddress ?? '',
    log.userAgent ?? '',
    log.metadata ?? '',
  ];
  return fields.map(escapeCsvField).join(',');
}

// Format a single audit log as JSON object
function formatJsonRow(logEntry: {
  id: string;
  userId: string | null;
  createdAt: Date;
  user: { email: string } | null;
  action: string;
  category: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: string | null;
}): object {
  return {
    id: logEntry.id,
    userId: logEntry.userId,
    userEmail: logEntry.user?.email ?? null,
    action: logEntry.action,
    category: logEntry.category,
    ipAddress: logEntry.ipAddress,
    userAgent: logEntry.userAgent,
    metadata: logEntry.metadata ? safeJsonParse(logEntry.metadata) : null,
    createdAt: logEntry.createdAt.toISOString(),
  };
}

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
      select: {
        id: true,
        organizationId: true,
        organizationRole: true,
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
    if (await isGranted(user, ROLES.ADMIN)) {
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

    const timestamp = new Date().toISOString().split('T')[0];
    const encoder = new TextEncoder();

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let cursor: string | undefined;
          let totalExported = 0;
          let isFirst = true;

          // Write header/opening for format
          if (format === 'csv') {
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
            controller.enqueue(encoder.encode(csvHeaders.join(',') + '\n'));
          } else {
            // JSON array opening
            controller.enqueue(encoder.encode('[\n'));
          }

          // Fetch and stream in batches
          while (totalExported < MAX_EXPORT_ROWS) {
            const batch = await prisma.auditLog.findMany({
              where,
              include: {
                user: {
                  select: { email: true },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: BATCH_SIZE,
              ...(cursor && {
                skip: 1,
                cursor: { id: cursor },
              }),
            });

            if (batch.length === 0) {
              break;
            }

            // Process each row in the batch
            for (const logEntry of batch) {
              if (format === 'csv') {
                controller.enqueue(
                  encoder.encode(formatCsvRow(logEntry) + '\n')
                );
              } else {
                const prefix = isFirst ? '  ' : ',\n  ';
                controller.enqueue(
                  encoder.encode(
                    prefix + JSON.stringify(formatJsonRow(logEntry))
                  )
                );
                isFirst = false;
              }
              totalExported++;
            }

            // Update cursor for next batch
            cursor = batch[batch.length - 1].id;

            // Log progress for large exports
            if (totalExported % 10000 === 0 && totalExported > 0) {
              log.debug('Audit log export progress', { totalExported, format });
            }

            // If we got fewer than BATCH_SIZE, we've reached the end
            if (batch.length < BATCH_SIZE) {
              break;
            }
          }

          // Write closing for JSON format
          if (format === 'json') {
            // Only add newline before closing bracket if we wrote any rows
            controller.enqueue(encoder.encode(isFirst ? ']\n' : '\n]\n'));
          }

          controller.close();
        } catch (error) {
          log.error('Streaming audit log export error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          controller.error(error);
        }
      },
    });

    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const extension = format;

    return new Response(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.${extension}"`,
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    log.error('Audit log export error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to export audit logs' },
      },
      { status: 500 }
    );
  }
}
