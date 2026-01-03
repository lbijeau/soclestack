import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { getClientIP, getRateLimitInfo } from '@/lib/auth';
import { setRateLimitHeaders } from '@/lib/rate-limit-headers';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

const { limit: REGISTER_LIMIT, windowMs: REGISTER_WINDOW_MS } = SECURITY_CONFIG.rateLimits.register;

export async function POST(req: NextRequest) {
  try {
    const context = getRequestContext(req);
    const body = await req.json();

    // Get rate limit key for headers (info retrieved after service call)
    const clientIP = getClientIP(req);
    const rateLimitKey = `register:${clientIP}`;

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
    return handleServiceError(error);
  }
}
