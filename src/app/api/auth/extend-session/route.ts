import { NextResponse } from 'next/server';
import {
  extendSession,
  getSessionStatus,
  SESSION_DURATION_MS,
} from '@/lib/auth';

export const runtime = 'nodejs';

// POST /api/auth/extend-session - Extend current session
export async function POST() {
  try {
    const success = await extendSession();

    if (!success) {
      return NextResponse.json(
        {
          error: {
            type: 'UNAUTHORIZED',
            message: 'No active session to extend',
          },
        },
        { status: 401 }
      );
    }

    const status = await getSessionStatus();

    return NextResponse.json({
      success: true,
      message: 'Session extended successfully',
      expiresAt: status.expiresAt,
      timeRemainingMs: status.timeRemainingMs,
      sessionDurationMs: SESSION_DURATION_MS,
    });
  } catch (error) {
    console.error('Failed to extend session:', error);
    return NextResponse.json(
      {
        error: { type: 'INTERNAL_ERROR', message: 'Failed to extend session' },
      },
      { status: 500 }
    );
  }
}
