import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { login } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { REMEMBER_ME_COOKIE_NAME } from '@/lib/auth/remember-me';
import { CSRF_CONFIG } from '@/lib/csrf';
import { getClientIP, getRateLimitInfo } from '@/lib/auth';
import { setRateLimitHeaders } from '@/lib/rate-limit-headers';
import { SECURITY_CONFIG } from '@/lib/config/security';

export const runtime = 'nodejs';

const { limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS } =
  SECURITY_CONFIG.rateLimits.login;

export async function POST(req: NextRequest) {
  // Get rate limit key upfront for use in both success and error paths
  const clientIP = getClientIP(req);
  const rateLimitKey = `login:${clientIP}`;

  try {
    const context = getRequestContext(req);
    const body = await req.json();

    const result = await login(body, context);

    // Get rate limit info AFTER service call to reflect accurate remaining count
    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      LOGIN_LIMIT,
      LOGIN_WINDOW_MS
    );

    // Handle 2FA required response
    if ('requiresTwoFactor' in result) {
      const response = NextResponse.json({
        requiresTwoFactor: result.requiresTwoFactor,
        pendingToken: result.pendingToken,
      });
      setRateLimitHeaders(response.headers, rateLimitInfo);
      return response;
    }

    // Set cookies
    const cookieStore = await cookies();

    // Remember Me cookie
    if (result.rememberMeCookie) {
      cookieStore.set(REMEMBER_ME_COOKIE_NAME, result.rememberMeCookie.value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: result.rememberMeCookie.expiresAt,
        path: '/',
      });
    }

    // CSRF token cookie
    cookieStore.set(
      CSRF_CONFIG.cookieName,
      result.csrfToken,
      CSRF_CONFIG.cookieOptions
    );

    // Return success response with rate limit headers
    const response = NextResponse.json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens,
    });
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  } catch (error) {
    // Add rate limit headers to error responses so clients know remaining attempts
    const response = handleServiceError(error);
    const rateLimitInfo = getRateLimitInfo(
      rateLimitKey,
      LOGIN_LIMIT,
      LOGIN_WINDOW_MS
    );
    setRateLimitHeaders(response.headers, rateLimitInfo);
    return response;
  }
}
