import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession, getClientIP } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { getEnabledProviders } from '@/lib/auth/oauth';
import { rotateCsrfToken } from '@/lib/csrf';

// GET /api/auth/oauth/accounts - List linked OAuth accounts
export async function GET() {
  try {
    const session = await getSession();

    if (!session.userId) {
      return NextResponse.json(
        { error: { type: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const accounts = await prisma.oAuthAccount.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        provider: true,
        email: true,
        createdAt: true,
      },
    });

    // Get user to check if they have a password
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { password: true },
    });

    const hasPassword = !!user?.password;
    const enabledProviders = getEnabledProviders();

    return NextResponse.json({
      accounts,
      hasPassword,
      enabledProviders,
    });
  } catch (error) {
    console.error('Get OAuth accounts error:', error);
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

// DELETE /api/auth/oauth/accounts?provider=google - Unlink OAuth account
export async function DELETE(req: NextRequest) {
  const ipAddress = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const session = await getSession();

    if (!session.userId) {
      return NextResponse.json(
        { error: { type: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        {
          error: { type: 'VALIDATION_ERROR', message: 'Provider is required' },
        },
        { status: 400 }
      );
    }

    // Get user to check if they have a password
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        password: true,
        oauthAccounts: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    // Cannot unlink if this is the only auth method
    const hasPassword = !!user.password;
    const oauthAccountCount = user.oauthAccounts.length;

    if (!hasPassword && oauthAccountCount <= 1) {
      return NextResponse.json(
        {
          error: {
            type: 'CANNOT_UNLINK',
            message:
              'Cannot unlink your only authentication method. Set a password first.',
          },
        },
        { status: 400 }
      );
    }

    // Find the OAuth account to unlink
    const oauthAccount = await prisma.oAuthAccount.findFirst({
      where: {
        userId: session.userId,
        provider,
      },
    });

    if (!oauthAccount) {
      return NextResponse.json(
        { error: { type: 'NOT_FOUND', message: 'OAuth account not found' } },
        { status: 404 }
      );
    }

    // Delete the OAuth account
    await prisma.oAuthAccount.delete({
      where: { id: oauthAccount.id },
    });

    await logAuditEvent({
      action: 'AUTH_OAUTH_ACCOUNT_UNLINKED',
      category: 'authentication',
      userId: session.userId,
      ipAddress,
      userAgent,
      metadata: { provider },
    });

    // Rotate CSRF token after sensitive action
    const response = NextResponse.json({ success: true });
    rotateCsrfToken(response);
    return response;
  } catch (error) {
    console.error('Unlink OAuth account error:', error);
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
