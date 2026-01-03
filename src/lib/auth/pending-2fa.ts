import { SignJWT, jwtVerify, JWTPayload } from 'jose';
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

function isValidPending2FAPayload(
  payload: JWTPayload
): payload is JWTPayload & { userId: string; type: 'pending_2fa' } {
  return typeof payload.userId === 'string' && payload.type === 'pending_2fa';
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

    if (!isValidPending2FAPayload(payload)) {
      return null;
    }

    return { userId: payload.userId };
  } catch {
    return null;
  }
}
