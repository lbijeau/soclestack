import { NextResponse } from 'next/server';
import { getEmailCircuitBreaker } from '@/lib/email/circuit-breaker';
import { logAuditEvent } from '@/lib/audit';
import { headers } from 'next/headers';
import { verifyAdminAccess } from '../_lib/verify-admin';

export const runtime = 'nodejs';

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
