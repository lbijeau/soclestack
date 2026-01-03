import { NextResponse } from 'next/server';
import { getCurrentUser, isRateLimited } from '@/lib/auth';
import { resendVerificationEmail } from '@/services/auth.service';
import { handleServiceError } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          },
        },
        { status: 401 }
      );
    }

    // Rate limit: 3 resend attempts per hour
    const rateLimitKey = `resend-verification:${user.id}`;
    if (isRateLimited(rateLimitKey, 3, 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'RATE_LIMIT_ERROR',
            message:
              'Too many verification emails sent. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    await resendVerificationEmail(user.id);

    return NextResponse.json({
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
