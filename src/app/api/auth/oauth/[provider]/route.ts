import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  isValidProvider,
  getProviderConfig,
  buildAuthorizationUrl,
  generateOAuthState,
} from '@/lib/auth/oauth';
import { SECURITY_CONFIG } from '@/lib/config/security';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  // Validate provider
  if (!isValidProvider(provider)) {
    return NextResponse.json(
      { error: { code: 'INVALID_PROVIDER', message: 'Invalid OAuth provider' } },
      { status: 400 }
    );
  }

  // Check if provider is configured
  const config = getProviderConfig(provider);
  if (!config) {
    return NextResponse.json(
      { error: { code: 'PROVIDER_NOT_CONFIGURED', message: 'OAuth provider not configured' } },
      { status: 400 }
    );
  }

  // Get optional parameters
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('returnTo') || '/dashboard';
  const linkAccount = searchParams.get('link') === 'true';
  const inviteToken = searchParams.get('inviteToken') || undefined;

  // If linking account, require authenticated session
  let linkToUserId: string | undefined;
  if (linkAccount) {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Must be logged in to link account' } },
        { status: 401 }
      );
    }
    linkToUserId = session.userId;
  }

  // Generate state token
  const state = await generateOAuthState({
    provider,
    returnTo,
    linkToUserId,
    inviteToken,
  });

  // Build redirect URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/oauth/${provider}/callback`;
  const authUrl = buildAuthorizationUrl(provider, state, redirectUri);

  if (!authUrl) {
    return NextResponse.json(
      { error: { code: 'BUILD_AUTH_URL_FAILED', message: 'Failed to build authorization URL' } },
      { status: 500 }
    );
  }

  // Store state in cookie for verification
  const cookieStore = await cookies();
  cookieStore.set(SECURITY_CONFIG.oauth.stateCookieName, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SECURITY_CONFIG.oauth.stateTokenExpiryMinutes * 60,
    path: '/',
  });

  // Redirect to OAuth provider
  return NextResponse.redirect(authUrl);
}
