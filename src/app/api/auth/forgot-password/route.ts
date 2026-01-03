import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, isRateLimited } from '@/lib/auth';
import { requestPasswordReset } from '@/services/auth.service';
import { handleServiceError } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimitKey = `forgot-password:${clientIP}`;

    if (isRateLimited(rateLimitKey, 3, 60 * 60 * 1000)) {
      // 3 attempts per hour
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message:
              'Too many password reset requests. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = await requestPasswordReset(body);

    return NextResponse.json({ message: result.message });
  } catch (error) {
    return handleServiceError(error);
  }
}
