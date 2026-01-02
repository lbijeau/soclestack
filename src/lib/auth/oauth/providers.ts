export type OAuthProvider = 'google' | 'github';

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface OAuthUserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

const providers: Record<
  OAuthProvider,
  Omit<OAuthProviderConfig, 'clientId' | 'clientSecret'>
> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'read:user'],
  },
};

export function getProviderConfig(
  provider: OAuthProvider
): OAuthProviderConfig | null {
  const baseConfig = providers[provider];
  if (!baseConfig) return null;

  let clientId: string | undefined;
  let clientSecret: string | undefined;

  if (provider === 'google') {
    clientId = process.env.GOOGLE_CLIENT_ID;
    clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  } else if (provider === 'github') {
    clientId = process.env.GITHUB_CLIENT_ID;
    clientSecret = process.env.GITHUB_CLIENT_SECRET;
  }

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    ...baseConfig,
    clientId,
    clientSecret,
  };
}

export function isValidProvider(provider: string): provider is OAuthProvider {
  return provider === 'google' || provider === 'github';
}

export function getEnabledProviders(): OAuthProvider[] {
  const enabled: OAuthProvider[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    enabled.push('google');
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    enabled.push('github');
  }

  return enabled;
}
