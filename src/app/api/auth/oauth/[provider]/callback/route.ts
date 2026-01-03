import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { createUserSession, getClientIP } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { SECURITY_CONFIG } from '@/lib/config/security';
import {
  isValidProvider,
  verifyOAuthState,
  exchangeCodeForTokens,
  fetchUserProfile,
  createPendingOAuthToken,
  type OAuthProvider,
} from '@/lib/auth/oauth';
import { generateCsrfToken, CSRF_CONFIG } from '@/lib/csrf';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error from ${provider}:`, error);
    return NextResponse.redirect(`${appUrl}/login?error=oauth_denied`);
  }

  // Validate provider
  if (!isValidProvider(provider)) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_provider`);
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_params`);
  }

  // Verify state token
  const cookieStore = await cookies();
  const storedState = cookieStore.get(
    SECURITY_CONFIG.oauth.stateCookieName
  )?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  const statePayload = await verifyOAuthState(state);
  if (!statePayload || statePayload.provider !== provider) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_state`);
  }

  // Clear state cookie
  cookieStore.delete(SECURITY_CONFIG.oauth.stateCookieName);

  // Exchange code for tokens
  const redirectUri = `${appUrl}/api/auth/oauth/${provider}/callback`;
  const tokens = await exchangeCodeForTokens(
    provider as OAuthProvider,
    code,
    redirectUri
  );

  if (!tokens) {
    return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
  }

  // Fetch user profile
  const profile = await fetchUserProfile(
    provider as OAuthProvider,
    tokens.access_token
  );

  if (!profile || !profile.email) {
    return NextResponse.redirect(`${appUrl}/login?error=profile_fetch_failed`);
  }

  // Check if this OAuth account is already linked
  const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: profile.id,
      },
    },
    include: { user: true },
  });

  // Case 1: Linking OAuth to existing account from profile
  if (statePayload.linkToUserId) {
    return await handleLinkToExistingAccount(
      provider as OAuthProvider,
      profile,
      tokens,
      statePayload.linkToUserId,
      existingOAuthAccount,
      ipAddress,
      userAgent,
      appUrl
    );
  }

  // Case 2: OAuth account already linked - log them in
  if (existingOAuthAccount) {
    return await handleExistingOAuthLogin(
      existingOAuthAccount.user,
      provider as OAuthProvider,
      ipAddress,
      userAgent,
      statePayload.returnTo || '/dashboard',
      appUrl
    );
  }

  // Case 3: Check if email exists in system (needs password verification)
  const existingUser = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (existingUser) {
    // User exists but OAuth not linked - need password verification
    const pendingToken = await createPendingOAuthToken({
      provider: provider as OAuthProvider,
      providerAccountId: profile.id,
      profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_in
        ? Math.floor(Date.now() / 1000) + tokens.expires_in
        : undefined,
      existingUserId: existingUser.id,
      inviteToken: statePayload.inviteToken,
    });

    return NextResponse.redirect(
      `${appUrl}/auth/oauth/link?token=${encodeURIComponent(pendingToken)}`
    );
  }

  // Case 4: New user - needs to complete registration (create org or use invite)
  const pendingToken = await createPendingOAuthToken({
    provider: provider as OAuthProvider,
    providerAccountId: profile.id,
    profile,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : undefined,
    inviteToken: statePayload.inviteToken,
  });

  return NextResponse.redirect(
    `${appUrl}/auth/oauth/complete?token=${encodeURIComponent(pendingToken)}`
  );
}

async function handleLinkToExistingAccount(
  provider: OAuthProvider,
  profile: { id: string; email: string },
  tokens: { access_token: string; refresh_token?: string; expires_in?: number },
  userId: string,
  existingOAuthAccount: { user: { id: string } } | null,
  ipAddress: string,
  userAgent: string | undefined,
  appUrl: string
) {
  // Check if this OAuth is already linked to another account
  if (existingOAuthAccount && existingOAuthAccount.user.id !== userId) {
    return NextResponse.redirect(
      `${appUrl}/profile/security?error=oauth_already_linked`
    );
  }

  // Already linked to this user
  if (existingOAuthAccount) {
    return NextResponse.redirect(
      `${appUrl}/profile/security?message=oauth_already_linked`
    );
  }

  // Link the OAuth account
  await prisma.oAuthAccount.create({
    data: {
      userId,
      provider,
      providerAccountId: profile.id,
      email: profile.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
    },
  });

  await logAuditEvent({
    action: 'AUTH_OAUTH_ACCOUNT_LINKED',
    category: 'authentication',
    userId,
    ipAddress,
    userAgent,
    metadata: { provider },
  });

  return NextResponse.redirect(
    `${appUrl}/profile/security?message=oauth_linked`
  );
}

async function handleExistingOAuthLogin(
  user: {
    id: string;
    isActive: boolean;
    twoFactorEnabled: boolean;
    email: string;
    role: string;
    organizationId: string | null;
  },
  provider: OAuthProvider,
  ipAddress: string,
  userAgent: string | undefined,
  returnTo: string,
  appUrl: string
) {
  // Check if user is active
  if (!user.isActive) {
    await logAuditEvent({
      action: 'AUTH_OAUTH_LOGIN_FAILURE',
      category: 'authentication',
      userId: user.id,
      ipAddress,
      userAgent,
      metadata: { provider, reason: 'account_inactive' },
    });
    return NextResponse.redirect(`${appUrl}/login?error=account_inactive`);
  }

  // Check if 2FA is required
  if (user.twoFactorEnabled) {
    // Create pending 2FA token (reuse existing 2FA flow)
    const { createPending2FAToken } = await import('@/lib/auth/pending-2fa');
    const pending2FAToken = await createPending2FAToken(user.id);
    return NextResponse.redirect(
      `${appUrl}/auth/two-factor?token=${encodeURIComponent(pending2FAToken)}&returnTo=${encodeURIComponent(returnTo)}`
    );
  }

  // Update last login time
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Create session
  await createUserSession(
    user as Parameters<typeof createUserSession>[0],
    ipAddress,
    userAgent
  );

  await logAuditEvent({
    action: 'AUTH_OAUTH_LOGIN_SUCCESS',
    category: 'authentication',
    userId: user.id,
    ipAddress,
    userAgent,
    metadata: { provider },
  });

  // Set CSRF token cookie on redirect response
  const csrfToken = generateCsrfToken();
  const redirectResponse = NextResponse.redirect(`${appUrl}${returnTo}`);
  redirectResponse.cookies.set(
    CSRF_CONFIG.cookieName,
    csrfToken,
    CSRF_CONFIG.cookieOptions
  );

  return redirectResponse;
}
