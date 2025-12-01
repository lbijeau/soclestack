import { randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { SECURITY_CONFIG } from '@/lib/config/security';
import type { OAuthProvider } from './providers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'oauth-state-secret-change-me'
);

export interface OAuthStatePayload {
  provider: OAuthProvider;
  nonce: string;
  returnTo?: string;
  linkToUserId?: string; // Set when linking OAuth to existing account from profile
  inviteToken?: string; // Set when registering via invite
}

export async function generateOAuthState(payload: Omit<OAuthStatePayload, 'nonce'>): Promise<string> {
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = new Date(
    Date.now() + SECURITY_CONFIG.oauth.stateTokenExpiryMinutes * 60 * 1000
  );

  const token = await new SignJWT({ ...payload, nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(JWT_SECRET);

  return token;
}

export async function verifyOAuthState(token: string): Promise<OAuthStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as OAuthStatePayload;
  } catch {
    return null;
  }
}
