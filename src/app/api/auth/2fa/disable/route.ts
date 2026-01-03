import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP, isRateLimited } from '@/lib/auth';
import { disable2FA } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import {
  assertNotImpersonating,
  ImpersonationBlockedError,
} from '@/lib/auth/impersonation';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { rotateCsrfToken } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';

const disableSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);

  try {
    // Rate limiting
    const { limit, windowMs } = SECURITY_CONFIG.rateLimits.twoFactorDisable;
    if (isRateLimited(`2fa-disable:${clientIP}`, limit, windowMs)) {
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

    const body = await req.json();
    const validationResult = disableSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid code format' } },
        { status: 400 }
      );
    }

    const context = getRequestContext(req);
    await disable2FA(session.userId, validationResult.data.code, context);

    // Rotate CSRF token after sensitive action
    const response = NextResponse.json({ message: '2FA disabled successfully' });
    rotateCsrfToken(response);
    return response;
  } catch (error) {
    return handleServiceError(error);
  }
}
