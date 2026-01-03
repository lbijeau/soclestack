import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { getClientIP, getRateLimitInfo } from '@/lib/auth';
import { setRateLimitHeaders } from '@/lib/rate-limit-headers';

export const runtime = 'nodejs';

const REGISTER_LIMIT = 3;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const context = getRequestContext(req);
    const body = await req.json();

    // Get rate limit info for headers
    const clientIP = getClientIP(req);
    const rateLimitKey = `register:${clientIP}`;
    const rateLimitInfo = getRateLimitInfo(rateLimitKey, REGISTER_LIMIT, REGISTER_WINDOW_MS);

    const result = await register(body, context);

    const response = NextResponse.json(result, { status: 201 });
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  } catch (error) {
    return handleServiceError(error);
  }
}
