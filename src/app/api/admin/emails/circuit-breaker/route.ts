import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isImpersonating } from '@/lib/auth/impersonation';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';
import { getEmailCircuitBreaker } from '@/lib/email/circuit-breaker';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

/**
 * Verify admin access for circuit breaker endpoints.
 * Returns user ID if authorized, or error response.
 */
async function verifyAdminAccess(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    return {
      error: NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      ),
    };
  }

  if (isImpersonating(session)) {
    return {
      error: NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot access while impersonating',
          },
        },
        { status: 403 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, ...userWithRolesInclude },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      ),
    };
  }

  if (!(await isGranted(user, ROLES.ADMIN))) {
    return {
      error: NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      ),
    };
  }

  return { userId: session.userId };
}

/**
 * GET /api/admin/emails/circuit-breaker
 * Get current circuit breaker state for monitoring.
 */
export async function GET() {
  try {
    const auth = await verifyAdminAccess();
    if ('error' in auth) return auth.error;

    const circuitBreaker = getEmailCircuitBreaker();
    const state = circuitBreaker.getState();

    return NextResponse.json({ state });
  } catch (error) {
    console.error('Circuit breaker status error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to fetch circuit breaker status',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/emails/circuit-breaker/reset
 * Manually reset the circuit breaker to CLOSED state.
 */
export async function POST() {
  try {
    const auth = await verifyAdminAccess();
    if ('error' in auth) return auth.error;

    const circuitBreaker = getEmailCircuitBreaker();
    const stateBefore = circuitBreaker.getState();

    circuitBreaker.reset();

    const stateAfter = circuitBreaker.getState();

    // Log the action
    const headersList = await headers();
    await logAuditEvent({
      action: 'ADMIN_CIRCUIT_BREAKER_RESET',
      category: 'admin',
      userId: auth.userId,
      ipAddress: headersList.get('x-forwarded-for') ?? undefined,
      userAgent: headersList.get('user-agent') ?? undefined,
      metadata: {
        stateBefore: stateBefore.state,
        stateAfter: stateAfter.state,
      },
    });

    return NextResponse.json({
      success: true,
      stateBefore,
      stateAfter,
    });
  } catch (error) {
    console.error('Circuit breaker reset error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'Failed to reset circuit breaker',
        },
      },
      { status: 500 }
    );
  }
}
