import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createUserSession, getClientIP, isRateLimited } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { verifyPendingOAuthToken } from '@/lib/auth/oauth';
import { z } from 'zod';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { generateCsrfToken, CSRF_CONFIG } from '@/lib/csrf';

const linkOAuthSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  const ipAddress = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    // Rate limiting
    const { limit, windowMs } = SECURITY_CONFIG.rateLimits.oauthLink;
    if (isRateLimited(`oauth-link:${ipAddress}`, limit, windowMs)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many requests. Please try again later.',
          },
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = linkOAuthSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Verify pending OAuth token
    const oauthData = await verifyPendingOAuthToken(token);
    if (!oauthData || !oauthData.existingUserId) {
      return NextResponse.json(
        {
          error: {
            type: 'INVALID_TOKEN',
            message: 'OAuth session expired. Please try again.',
          },
        },
        { status: 400 }
      );
    }

    // Get existing user
    const user = await prisma.user.findUnique({
      where: { id: oauthData.existingUserId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found or inactive' } },
        { status: 404 }
      );
    }

    // User must have a password to link
    if (!user.password) {
      return NextResponse.json(
        {
          error: {
            type: 'NO_PASSWORD',
            message:
              'This account was created with OAuth. Please log in with your original OAuth provider.',
          },
        },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      await logAuditEvent({
        action: 'AUTH_OAUTH_LOGIN_FAILURE',
        category: 'authentication',
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: { provider: oauthData.provider, reason: 'invalid_password' },
      });

      return NextResponse.json(
        { error: { type: 'INVALID_PASSWORD', message: 'Invalid password' } },
        { status: 401 }
      );
    }

    // Check if this OAuth account is already linked to another user
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: oauthData.provider,
          providerAccountId: oauthData.providerAccountId,
        },
      },
    });

    if (existingOAuth) {
      return NextResponse.json(
        {
          error: {
            type: 'CONFLICT',
            message: 'This OAuth account is already linked to another user.',
          },
        },
        { status: 409 }
      );
    }

    // Link OAuth account
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: oauthData.provider,
        providerAccountId: oauthData.providerAccountId,
        email: oauthData.profile.email,
        accessToken: oauthData.accessToken,
        refreshToken: oauthData.refreshToken,
        tokenExpiresAt: oauthData.tokenExpiresAt
          ? new Date(oauthData.tokenExpiresAt * 1000)
          : null,
      },
    });

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Check if 2FA is required
    if (user.twoFactorEnabled) {
      const { createPending2FAToken } = await import('@/lib/auth/pending-2fa');
      const pending2FAToken = await createPending2FAToken(user.id);

      await logAuditEvent({
        action: 'AUTH_OAUTH_ACCOUNT_LINKED',
        category: 'authentication',
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: { provider: oauthData.provider },
      });

      return NextResponse.json({
        requiresTwoFactor: true,
        pendingToken: pending2FAToken,
      });
    }

    // Create session
    await createUserSession(
      user as Parameters<typeof createUserSession>[0],
      ipAddress,
      userAgent
    );

    await logAuditEvent({
      action: 'AUTH_OAUTH_ACCOUNT_LINKED',
      category: 'authentication',
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { provider: oauthData.provider },
    });

    await logAuditEvent({
      action: 'AUTH_OAUTH_LOGIN_SUCCESS',
      category: 'authentication',
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { provider: oauthData.provider },
    });

    // Set CSRF token cookie
    const csrfToken = generateCsrfToken();
    const cookieStore = await cookies();
    cookieStore.set(CSRF_CONFIG.cookieName, csrfToken, CSRF_CONFIG.cookieOptions);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('OAuth link error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        },
      },
      { status: 500 }
    );
  }
}
