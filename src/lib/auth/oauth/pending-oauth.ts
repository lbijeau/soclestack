import { SignJWT, jwtVerify } from 'jose';
import { SECURITY_CONFIG } from '@/lib/config/security';
import type { OAuthProvider, OAuthUserProfile } from './providers';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required for pending OAuth tokens'
    );
  }
  return new TextEncoder().encode(secret);
}

export interface PendingOAuthPayload {
  provider: OAuthProvider;
  providerAccountId: string;
  profile: OAuthUserProfile;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number; // Unix timestamp
  existingUserId?: string; // Set when email matches existing user (needs password verification)
  inviteToken?: string; // Set when registering via invite
}

export async function createPendingOAuthToken(
  payload: PendingOAuthPayload
): Promise<string> {
  const expiresAt = new Date(
    Date.now() + SECURITY_CONFIG.oauth.pendingLinkExpiryMinutes * 60 * 1000
  );

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(getJwtSecret());

  return token;
}

export async function verifyPendingOAuthToken(
  token: string
): Promise<PendingOAuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as PendingOAuthPayload;
  } catch {
    return null;
  }
}
