import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { login } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { REMEMBER_ME_COOKIE_NAME } from '@/lib/auth/remember-me';
import { CSRF_CONFIG } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const context = getRequestContext(req);
    const body = await req.json();

    const result = await login(body, context);

    // Handle 2FA required response
    if ('requiresTwoFactor' in result) {
      return NextResponse.json({
        requiresTwoFactor: result.requiresTwoFactor,
        pendingToken: result.pendingToken,
      });
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

    // Return success response
    return NextResponse.json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
