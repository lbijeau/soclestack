import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { AuthError } from '@/types/auth';

export const runtime = 'nodejs';

// GET /api/organizations/current/members - List all members
export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHENTICATION_ERROR',
            message: 'Not authenticated',
          } as AuthError,
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        {
          error: {
            type: 'NOT_FOUND',
            message: 'You do not belong to an organization',
          } as AuthError,
        },
        { status: 404 }
      );
    }

    const members = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        organizationRole: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [
        { organizationRole: 'asc' }, // OWNER first, then ADMIN, then MEMBER
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Get members error:', error);
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
