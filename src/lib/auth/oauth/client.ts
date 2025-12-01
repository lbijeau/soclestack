import { getProviderConfig, type OAuthProvider, type OAuthUserProfile } from './providers';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export function buildAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  redirectUri: string
): string | null {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  // Google-specific params
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  return `${config.authUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<TokenResponse | null> {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // GitHub requires Accept header for JSON response
  if (provider === 'github') {
    headers['Accept'] = 'application/json';
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString(),
  });

  if (!response.ok) {
    console.error(`OAuth token exchange failed for ${provider}:`, await response.text());
    return null;
  }

  return response.json();
}

export async function fetchUserProfile(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthUserProfile | null> {
  const config = getProviderConfig(provider);
  if (!config) return null;

  try {
    if (provider === 'google') {
      return await fetchGoogleProfile(accessToken, config.userInfoUrl);
    } else if (provider === 'github') {
      return await fetchGitHubProfile(accessToken, config.userInfoUrl);
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch ${provider} user profile:`, error);
    return null;
  }
}

async function fetchGoogleProfile(
  accessToken: string,
  userInfoUrl: string
): Promise<OAuthUserProfile | null> {
  const response = await fetch(userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;

  const data = await response.json();

  return {
    id: data.sub,
    email: data.email,
    emailVerified: data.email_verified === true,
    firstName: data.given_name || null,
    lastName: data.family_name || null,
    avatarUrl: data.picture || null,
  };
}

async function fetchGitHubProfile(
  accessToken: string,
  userInfoUrl: string
): Promise<OAuthUserProfile | null> {
  // Fetch user info
  const userResponse = await fetch(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!userResponse.ok) return null;

  const userData = await userResponse.json();

  // GitHub doesn't always include email in user response, need to fetch separately
  let email: string | null = userData.email;
  let emailVerified = false;

  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (emailsResponse.ok) {
      const emails = await emailsResponse.json();
      // Find primary verified email
      const primaryEmail = emails.find(
        (e: { primary: boolean; verified: boolean }) => e.primary && e.verified
      );
      if (primaryEmail) {
        email = primaryEmail.email;
        emailVerified = primaryEmail.verified;
      } else {
        // Fall back to any verified email
        const verifiedEmail = emails.find((e: { verified: boolean }) => e.verified);
        if (verifiedEmail) {
          email = verifiedEmail.email;
          emailVerified = verifiedEmail.verified;
        }
      }
    }
  } else {
    // If email was in user response, assume verified
    emailVerified = true;
  }

  if (!email) return null;

  // Parse name
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (userData.name) {
    const parts = userData.name.split(' ');
    firstName = parts[0] || null;
    lastName = parts.slice(1).join(' ') || null;
  }

  return {
    id: String(userData.id),
    email,
    emailVerified,
    firstName,
    lastName,
    avatarUrl: userData.avatar_url || null,
  };
}
