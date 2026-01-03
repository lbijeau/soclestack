import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP, isRateLimited } from '@/lib/auth';
import { setup2FA } from '@/services/auth.service';
import { handleServiceError } from '@/lib/api-utils';
import {
  assertNotImpersonating,
  ImpersonationBlockedError,
} from '@/lib/auth/impersonation';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const { limit, windowMs } = SECURITY_CONFIG.rateLimits.twoFactorSetup;
    if (isRateLimited(`2fa-setup:${clientIP}`, limit, windowMs)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many requests. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Block during impersonation
    try {
      assertNotImpersonating(session);
    } catch (error) {
      if (error instanceof ImpersonationBlockedError) {
        return NextResponse.json(
          { error: { type: 'FORBIDDEN', message: error.message } },
          { status: 403 }
        );
      }
      throw error;
    }

    const result = await setup2FA(session.userId);

    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error);
  }
}
