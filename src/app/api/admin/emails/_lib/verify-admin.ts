import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isImpersonating } from '@/lib/auth/impersonation';
import { isGranted, ROLES, userWithRolesInclude } from '@/lib/security/index';

/**
 * Verify admin access for email management endpoints.
 * Returns user ID if authorized, or error response.
 */
export async function verifyAdminAccess(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    return {
      error: NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      ),
    };
  }

  if (isImpersonating(session)) {
    return {
      error: NextResponse.json(
        {
          error: {
            type: 'FORBIDDEN',
            message: 'Cannot access while impersonating',
          },
        },
        { status: 403 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, ...userWithRolesInclude },
  });

  if (!user) {
    return {
      error: NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      ),
    };
  }

  if (!(await isGranted(user, ROLES.ADMIN))) {
    return {
      error: NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      ),
    };
  }

  return { userId: session.userId };
}
