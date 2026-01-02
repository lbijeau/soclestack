import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginSchema } from '@/lib/validations';
import {
  authenticateUser,
  createUserSession,
  getClientIP,
  isRateLimited,
} from '@/lib/auth';
import { AuthError } from '@/types/auth';
import {
  checkAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
} from '@/lib/auth/lockout';
import {
  createRememberMeToken,
  REMEMBER_ME_COOKIE_NAME,
} from '@/lib/auth/remember-me';
import { createPending2FAToken } from '@/lib/auth/pending-2fa';
import { logAuditEvent } from '@/lib/audit';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { prisma } from '@/lib/db';
import { sendNewDeviceAlert, isKnownDevice } from '@/lib/email';
import { parseUserAgent } from '@/lib/utils/user-agent';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    // Rate limiting
    const rateLimitKey = `login:${clientIP}`;

    if (isRateLimited(rateLimitKey, 10, 15 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Too many login attempts. Please try again later.',
          } as AuthError,
        },
        { status: 429 }
      );
    }

    const body = await req.json();

    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: validationResult.error.flatten().fieldErrors,
          } as AuthError,
        },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = validationResult.data;

    // Find user first to check lockout
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Check if account is locked
      const lockoutStatus = await checkAccountLocked(user.id);
      if (lockoutStatus.isLocked) {
        const retryAfterSeconds = lockoutStatus.lockedUntil
          ? Math.ceil((lockoutStatus.lockedUntil.getTime() - Date.now()) / 1000)
          : SECURITY_CONFIG.lockout.durationMinutes * 60;

        return NextResponse.json(
          {
            error: {
              type: 'ACCOUNT_LOCKED',
              message:
                'Account temporarily locked due to too many failed attempts',
              lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
              retryAfterSeconds,
            },
          },
          { status: 423 }
        );
      }
    }

    // Authenticate user
    const authenticatedUser = await authenticateUser(email, password);
    if (!authenticatedUser) {
      // Record failed attempt if user exists
      if (user) {
        const lockoutStatus = await recordFailedAttempt(
          user.id,
          clientIP,
          userAgent
        );

        await logAuditEvent({
          action: 'AUTH_LOGIN_FAILURE',
          category: 'authentication',
          userId: user.id,
          ipAddress: clientIP,
          userAgent,
          metadata: { reason: 'invalid_password' },
        });

        if (lockoutStatus.isLocked) {
          const retryAfterSeconds = lockoutStatus.lockedUntil
            ? Math.ceil(
                (lockoutStatus.lockedUntil.getTime() - Date.now()) / 1000
              )
            : SECURITY_CONFIG.lockout.durationMinutes * 60;

          return NextResponse.json(
            {
              error: {
                type: 'ACCOUNT_LOCKED',
                message:
                  'Account temporarily locked due to too many failed attempts',
                lockedUntil: lockoutStatus.lockedUntil?.toISOString(),
                retryAfterSeconds,
              },
            },
            { status: 423 }
          );
        }
      } else {
        await logAuditEvent({
          action: 'AUTH_LOGIN_FAILURE',
          category: 'authentication',
          ipAddress: clientIP,
          userAgent,
          metadata: { reason: 'user_not_found', email },
        });
      }

      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Invalid email or password',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!authenticatedUser.emailVerified) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Please verify your email before logging in',
          } as AuthError,
        },
        { status: 403 }
      );
    }

    // Reset failed attempts on successful login
    await resetFailedAttempts(authenticatedUser.id);

    // Check if 2FA is enabled
    if (authenticatedUser.twoFactorEnabled) {
      const pendingToken = createPending2FAToken(authenticatedUser.id);

      await logAuditEvent({
        action: 'AUTH_LOGIN_SUCCESS',
        category: 'authentication',
        userId: authenticatedUser.id,
        ipAddress: clientIP,
        userAgent,
        metadata: { requires2FA: true },
      });

      return NextResponse.json({
        requiresTwoFactor: true,
        pendingToken,
      });
    }

    // Check if this is a new device BEFORE logging the successful login
    const knownDevice = await isKnownDevice(
      authenticatedUser.id,
      clientIP,
      userAgent
    );

    // Create session (no 2FA)
    const tokens = await createUserSession(
      authenticatedUser,
      clientIP,
      userAgent
    );

    // Log successful login
    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      category: 'authentication',
      userId: authenticatedUser.id,
      ipAddress: clientIP,
      userAgent,
    });

    // Send new device alert if this is an unknown device (fire-and-forget)
    if (!knownDevice && clientIP && userAgent) {
      const deviceInfo = parseUserAgent(userAgent);
      sendNewDeviceAlert(
        authenticatedUser.email,
        deviceInfo,
        clientIP,
        new Date()
      ).catch((err) => console.error('Failed to send new device alert:', err));
    }

    // Handle Remember Me
    const cookieStore = await cookies();
    if (rememberMe) {
      const rememberMeResult = await createRememberMeToken(
        authenticatedUser.id,
        clientIP,
        userAgent
      );

      cookieStore.set(REMEMBER_ME_COOKIE_NAME, rememberMeResult.cookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: rememberMeResult.expiresAt,
        path: '/',
      });
    }

    // Return success response
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        username: authenticatedUser.username,
        firstName: authenticatedUser.firstName,
        lastName: authenticatedUser.lastName,
        role: authenticatedUser.role,
        isActive: authenticatedUser.isActive,
        emailVerified: authenticatedUser.emailVerified,
        lastLoginAt: authenticatedUser.lastLoginAt,
        createdAt: authenticatedUser.createdAt,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: {
          type: 'SERVER_ERROR',
          message: 'An internal server error occurred',
        } as AuthError,
      },
      { status: 500 }
    );
  }
}
