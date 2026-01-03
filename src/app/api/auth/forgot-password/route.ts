import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, isRateLimited, getRateLimitInfo } from '@/lib/auth';
import { requestPasswordReset } from '@/services/auth.service';
import { handleServiceError } from '@/lib/api-utils';
import {
  setRateLimitHeaders,
  createRateLimitResponse,
} from '@/lib/rate-limit-headers';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

const { limit: FORGOT_PASSWORD_LIMIT, windowMs: FORGOT_PASSWORD_WINDOW_MS } =
  SECURITY_CONFIG.rateLimits.forgotPassword;

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimitKey = `forgot-password:${clientIP}`;

    if (
      isRateLimited(
        rateLimitKey,
        FORGOT_PASSWORD_LIMIT,
        FORGOT_PASSWORD_WINDOW_MS
      )
    ) {
      // Get rate limit info for error response (after isRateLimited call)
      const rateLimitInfo = getRateLimitInfo(
        rateLimitKey,
        FORGOT_PASSWORD_LIMIT,
        FORGOT_PASSWORD_WINDOW_MS
      );
      return createRateLimitResponse(
        rateLimitInfo,
        'Too many password reset requests. Please try again later.'
      );
    }

    const body = await req.json();
    const result = await requestPasswordReset(body);

    // Get rate limit info AFTER processing to reflect accurate remaining count
    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      FORGOT_PASSWORD_LIMIT,
      FORGOT_PASSWORD_WINDOW_MS
    );

    const response = NextResponse.json({ message: result.message });
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  } catch (error) {
    return handleServiceError(error);
  }
}
