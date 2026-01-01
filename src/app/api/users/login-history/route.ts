import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Get login-related audit events for this user
    const loginEvents = await prisma.auditLog.findMany({
      where: {
        userId: user.id,
        action: {
          in: [
            'AUTH_LOGIN_SUCCESS',
            'AUTH_LOGIN_FAILED',
            'AUTH_LOGOUT',
            'AUTH_2FA_SUCCESS',
            'AUTH_2FA_FAILED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Parse metadata and format response
    const history = loginEvents.map((event) => {
      let metadata: Record<string, unknown> = {};
      if (event.metadata) {
        try {
          metadata = JSON.parse(event.metadata);
        } catch {
          // Ignore parse errors
        }
      }

      return {
        id: event.id,
        action: event.action,
        success: event.action.includes('SUCCESS'),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        reason: metadata.reason as string | undefined,
        createdAt: event.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Get login history error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to get login history',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
