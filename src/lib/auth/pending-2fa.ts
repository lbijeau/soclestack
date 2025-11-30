import jwt from 'jsonwebtoken';
import { SECURITY_CONFIG } from '../config/security';

const { pendingTokenExpiryMinutes } = SECURITY_CONFIG.twoFactor;

interface Pending2FAPayload {
  userId: string;
  email: string;
  type: 'pending_2fa';
  iat: number;
  exp: number;
}

export function createPending2FAToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(
    { userId, email, type: 'pending_2fa' },
    secret,
    { expiresIn: `${pendingTokenExpiryMinutes}m` }
  );
}

export function verifyPending2FAToken(token: string): { userId: string; email: string } | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    const payload = jwt.verify(token, secret) as Pending2FAPayload;
    if (payload.type !== 'pending_2fa') {
      return null;
    }
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
