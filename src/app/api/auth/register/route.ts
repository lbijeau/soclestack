import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { getClientIP, getRateLimitInfo } from '@/lib/auth';
import { setRateLimitHeaders } from '@/lib/rate-limit-headers';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

const { limit: REGISTER_LIMIT, windowMs: REGISTER_WINDOW_MS } =
  SECURITY_CONFIG.rateLimits.register;

export async function POST(req: NextRequest) {
  // Get rate limit key upfront for use in both success and error paths
  const clientIP = getClientIP(req);
  const rateLimitKey = `register:${clientIP}`;

  try {
    const context = getRequestContext(req);
    const body = await req.json();

    const result = await register(body, context);

    // Get rate limit info AFTER service call to reflect accurate remaining count
    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      REGISTER_LIMIT,
      REGISTER_WINDOW_MS
    );

    const response = NextResponse.json(result, { status: 201 });
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  } catch (error) {
    // Add rate limit headers to error responses so clients know remaining attempts
    const response = handleServiceError(error);
    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      REGISTER_LIMIT,
      REGISTER_WINDOW_MS
    );
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  }
}
