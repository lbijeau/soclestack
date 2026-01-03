import { NextRequest, NextResponse } from 'next/server';
import { getClientIP, getRateLimitInfo } from '@/lib/auth';
import { requestPasswordReset } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { setRateLimitHeaders } from '@/lib/rate-limit-headers';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

const { limit: FORGOT_PASSWORD_LIMIT, windowMs: FORGOT_PASSWORD_WINDOW_MS } =
  SECURITY_CONFIG.rateLimits.forgotPassword;

export async function POST(req: NextRequest) {
  // Get rate limit key upfront for use in both success and error paths
  const clientIP = getClientIP(req);
  const rateLimitKey = `forgot-password:${clientIP}`;

  try {
    const context = getRequestContext(req);
    const body = await req.json();

    const result = await requestPasswordReset(body, context);

    // Get rate limit info AFTER service call to reflect accurate remaining count
    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      FORGOT_PASSWORD_LIMIT,
      FORGOT_PASSWORD_WINDOW_MS
    );

    const response = NextResponse.json({ message: result.message });
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  } catch (error) {
    // Add rate limit headers to error responses so clients know remaining attempts
    const response = handleServiceError(error);
    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      FORGOT_PASSWORD_LIMIT,
      FORGOT_PASSWORD_WINDOW_MS
    );
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  }
}
