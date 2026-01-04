import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, createUserSession, getClientIP } from '@/lib/auth';
import {
  validateRememberMeToken,
  REMEMBER_ME_COOKIE_NAME,
} from '@/lib/auth/remember-me';
import { prisma } from '@/lib/db';
import {
  isImpersonating,
  hasImpersonationExpired,
  getImpersonationTimeRemaining,
  getImpersonationDuration,
} from '@/lib/auth/impersonation';
import { logAuditEvent } from '@/lib/audit';
import { computeLegacyRole, userWithRolesInclude } from '@/lib/security/index';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    // Check existing session first
    const session = await getSession();
    if (session.isLoggedIn && session.userId) {
      // Check if impersonation has expired
      if (isImpersonating(session) && hasImpersonationExpired(session)) {
        const impersonating = session.impersonating!;
        const duration = getImpersonationDuration(session);
        const targetUserId = session.userId;
        const targetEmail = session.email;

        // Restore original admin
        session.userId = impersonating.originalUserId;
        session.email = impersonating.originalEmail;
        session.role = impersonating.originalRole;
        session.impersonating = undefined;
        await session.save();

        // Log expiry
        await logAuditEvent({
          action: 'ADMIN_IMPERSONATION_EXPIRED',
          category: 'admin',
          userId: impersonating.originalUserId,
          ipAddress: clientIP,
          userAgent,
          metadata: {
            adminUserId: impersonating.originalUserId,
            adminEmail: impersonating.originalEmail,
            targetUserId,
            targetEmail,
            durationSeconds: duration,
          },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: session.userId, isActive: true },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          emailVerified: true,
          ...userWithRolesInclude,
        },
      });

      if (user) {
        const userWithRole = { ...user, role: computeLegacyRole(user) };
        const response: Record<string, unknown> = { user: userWithRole, authenticated: true };

        if (isImpersonating(session)) {
          response.impersonating = {
            originalEmail: session.impersonating!.originalEmail,
            timeRemainingMinutes: getImpersonationTimeRemaining(session),
          };
        }

        return NextResponse.json(response);
      }
    }

    // No active session, check remember-me cookie
    const cookieStore = await cookies();
    const rememberMeCookie = cookieStore.get(REMEMBER_ME_COOKIE_NAME);

    if (rememberMeCookie?.value) {
      const result = await validateRememberMeToken(
        rememberMeCookie.value,
        clientIP,
        userAgent
      );

      if (result.theftDetected) {
        // Clear the cookie and force re-login
        cookieStore.delete(REMEMBER_ME_COOKIE_NAME);
        return NextResponse.json(
          {
            error: 'Session compromised. Please login again.',
            authenticated: false,
          },
          { status: 401 }
        );
      }

      if (result.valid && result.userId) {
        const user = await prisma.user.findUnique({
          where: { id: result.userId, isActive: true },
        });

        if (user && user.emailVerified) {
          // Create new session
          await createUserSession(user, clientIP, userAgent);

          // Update cookie with rotated token
          if (result.newCookie) {
            cookieStore.set(REMEMBER_ME_COOKIE_NAME, result.newCookie, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 30 * 24 * 60 * 60, // 30 days
              path: '/',
            });
          }

          return NextResponse.json({
            user: {
              id: user.id,
              email: user.email,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              role: computeLegacyRole(user as Parameters<typeof computeLegacyRole>[0]),
              isActive: user.isActive,
              emailVerified: user.emailVerified,
            },
            authenticated: true,
            rememberMeUsed: true,
          });
        }
      }

      // Invalid remember-me token, clear it
      cookieStore.delete(REMEMBER_ME_COOKIE_NAME);
    }

    return NextResponse.json({ authenticated: false });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
