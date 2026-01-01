import { NextRequest, NextResponse } from 'next/server';
import { getSession, getClientIP } from '@/lib/auth';
import { unlockAccount } from '@/lib/auth/lockout';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const session = await getSession();

    // Check authentication
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        {
          error: { type: 'AUTHENTICATION_ERROR', message: 'Not authenticated' },
        },
        { status: 401 }
      );
    }

    // Check admin role
    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            type: 'AUTHORIZATION_ERROR',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    const clientIP = getClientIP(req);
    const userAgent = req.headers.get('user-agent') || undefined;

    await unlockAccount(userId, session.userId, clientIP, userAgent);

    return NextResponse.json({ message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock account error:', error);
    return NextResponse.json(
      { error: { type: 'SERVER_ERROR', message: 'Failed to unlock account' } },
      { status: 500 }
    );
  }
}
