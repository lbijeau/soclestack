import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, isRateLimited, getRateLimitInfo } from '@/lib/auth';
import { requestPasswordReset } from '@/services/auth.service';
import { handleServiceError } from '@/lib/api-utils';
import {
  setRateLimitHeaders,
  createRateLimitResponse,
} from '@/lib/rate-limit-headers';

export const runtime = 'nodejs';

const FORGOT_PASSWORD_LIMIT = 3;
const FORGOT_PASSWORD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimitKey = `forgot-password:${clientIP}`;

    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      FORGOT_PASSWORD_LIMIT,
      FORGOT_PASSWORD_WINDOW_MS
    );

    if (isRateLimited(rateLimitKey, FORGOT_PASSWORD_LIMIT, FORGOT_PASSWORD_WINDOW_MS)) {
      return createRateLimitResponse(
        rateLimitInfo,
        'Too many password reset requests. Please try again later.'
      );
    }

    const body = await req.json();
    const result = await requestPasswordReset(body);

    const response = NextResponse.json({ message: result.message });
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  } catch (error) {
    return handleServiceError(error);
  }
}
