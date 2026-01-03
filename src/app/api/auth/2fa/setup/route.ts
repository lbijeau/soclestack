import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { setup2FA } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { isImpersonating } from '@/lib/auth/impersonation';

export const runtime = 'nodejs';

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

    const context = {
      ...getRequestContext(req),
      isImpersonating: isImpersonating(session),
    };
    const result = await setup2FA(session.userId, context);

    return NextResponse.json(result);
  } catch (error) {
    return handleServiceError(error);
  }
}
