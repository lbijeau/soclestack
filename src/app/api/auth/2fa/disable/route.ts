import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { disable2FA } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { isImpersonating } from '@/lib/auth/impersonation';
import { rotateCsrfToken } from '@/lib/csrf';
import { z } from 'zod';

export const runtime = 'nodejs';

const disableSchema = z.object({
  code: z.string().length(6).regex(/^\d+$/, 'Code must be 6 digits'),
});

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const validationResult = disableSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: { type: 'VALIDATION_ERROR', message: 'Invalid code format' } },
        { status: 400 }
      );
    }

    const context = {
      ...getRequestContext(req),
      isImpersonating: isImpersonating(session),
    };
    await disable2FA(session.userId, validationResult.data.code, context);

    // Rotate CSRF token after sensitive action
    const response = NextResponse.json({
      message: '2FA disabled successfully',
    });
    rotateCsrfToken(response);
    return response;
  } catch (error) {
    return handleServiceError(error);
  }
}
