import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validate2FA } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';
import { CSRF_CONFIG } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const context = getRequestContext(req);
    const body = await req.json();

    const result = await validate2FA(body, context);

    // Set CSRF token cookie
    const cookieStore = await cookies();
    cookieStore.set(
      CSRF_CONFIG.cookieName,
      result.csrfToken,
      CSRF_CONFIG.cookieOptions
    );

    return NextResponse.json({
      message: 'Login successful',
      user: result.user,
      tokens: result.tokens,
      warnings: result.warnings,
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
