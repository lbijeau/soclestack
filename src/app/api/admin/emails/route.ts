import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isImpersonating } from '@/lib/auth/impersonation';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';
import { z } from 'zod';
import { EmailStatus, Prisma } from '@prisma/client';

export const runtime = 'nodejs';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(EmailStatus).optional(),
  type: z.string().optional(),
  search: z.string().optional(),
});

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
            message: 'Cannot access email logs while impersonating',
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

    // Only platform admins can access email logs
    const isPlatformAdmin = await isGranted(user, ROLES.ADMIN);
    if (!isPlatformAdmin) {
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

    // Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const queryResult = querySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: queryResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { page, pageSize, status, type, search } = queryResult.data;

    // Build where clause
    const where: Prisma.EmailLogWhereInput = {
      deletedAt: null, // Exclude soft-deleted emails
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { to: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count and emails in parallel
    const [total, emails] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        select: {
          id: true,
          to: true,
          from: true,
          subject: true,
          type: true,
          status: true,
          attempts: true,
          lastError: true,
          sentAt: true,
          createdAt: true,
          userId: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      emails: emails.map((email) => ({
        ...email,
        sentAt: email.sentAt?.toISOString() ?? null,
        createdAt: email.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Admin emails list error:', error);
    return NextResponse.json(
      {
        error: { type: 'SERVER_ERROR', message: 'Failed to fetch email logs' },
      },
      { status: 500 }
    );
  }
}
