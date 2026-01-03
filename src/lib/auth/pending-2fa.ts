import { SignJWT, jwtVerify } from 'jose';
import { SECURITY_CONFIG } from '../config/security';
import { env } from '../env';

const { pendingTokenExpiryMinutes } = SECURITY_CONFIG.twoFactor;

// Cache encoded secret
let cachedSecret: Uint8Array | null = null;
let cachedSecretValue: string | null = null;

function getJwtSecret(): Uint8Array {
  const secret = env.JWT_SECRET as string;
  if (cachedSecret && cachedSecretValue === secret) {
    return cachedSecret;
  }
  cachedSecretValue = secret;
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

interface Pending2FAPayload {
  userId: string;
  type: 'pending_2fa';
  iat: number;
  exp: number;
}

export async function createPending2FAToken(userId: string): Promise<string> {
  return new SignJWT({ userId, type: 'pending_2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${pendingTokenExpiryMinutes}m`)
    .sign(getJwtSecret());
}

export async function verifyPending2FAToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const pending2FAPayload = payload as unknown as Pending2FAPayload;
    if (pending2FAPayload.type !== 'pending_2fa') {
      return null;
    }
    return { userId: pending2FAPayload.userId };
  } catch {
    return null;
  }
}
