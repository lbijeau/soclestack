import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWTPayload, RefreshTokenPayload } from '@/types/auth';
import { Role } from '@prisma/client';

// Dynamic crypto import for Edge Runtime compatibility
async function getCrypto() {
  if (typeof window !== 'undefined') {
    // Browser environment
    return {
      randomBytes: (size: number) =>
        crypto.getRandomValues(new Uint8Array(size)),
      createHash: (_algorithm: string) => ({
        update: (data: string) => ({
          digest: async (_encoding: string) => {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hash = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = new Uint8Array(hash);
            return Array.from(hashArray)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
          },
        }),
      }),
      randomUUID: () => crypto.randomUUID(),
    };
  } else {
    // Node.js environment
    const crypto = await import('crypto');
    return {
      randomBytes: (size: number) => crypto.randomBytes(size),
      createHash: (algorithm: string) => crypto.createHash(algorithm),
      randomUUID: () => crypto.randomUUID(),
    };
  }
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT token utilities
export async function generateAccessToken(payload: {
  userId: string;
  email: string;
  role: Role;
}): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }

  const crypto = await getCrypto();

  const jwtPayload: Omit<JWTPayload, 'iat' | 'exp'> = {
    sub: payload.userId,
    email: payload.email,
    role: payload.role,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(jwtPayload, jwtSecret, {
    expiresIn: '15m',
    issuer: 'soclestack',
    audience: 'soclestack-users',
  });
}

export async function generateRefreshToken(payload: {
  userId: string;
}): Promise<string> {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not defined');
  }

  const crypto = await getCrypto();

  const refreshPayload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: payload.userId,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(refreshPayload, refreshSecret, {
    expiresIn: '7d',
    issuer: 'soclestack',
    audience: 'soclestack-refresh',
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }

  try {
    return jwt.verify(token, jwtSecret, {
      issuer: 'soclestack',
      audience: 'soclestack-users',
    }) as JWTPayload;
  } catch {
    throw new Error('Invalid access token');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) {
    throw new Error('JWT_REFRESH_SECRET is not defined');
  }

  try {
    return jwt.verify(token, refreshSecret, {
      issuer: 'soclestack',
      audience: 'soclestack-refresh',
    }) as RefreshTokenPayload;
  } catch {
    throw new Error('Invalid refresh token');
  }
}

// Session token utilities
export async function generateSessionToken(): Promise<string> {
  const crypto = await getCrypto();
  const bytes = crypto.randomBytes(32);
  if (bytes instanceof Uint8Array) {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return (bytes as Buffer).toString('hex');
}

export async function hashSessionToken(token: string): Promise<string> {
  const crypto = await getCrypto();
  const hasher = crypto.createHash('sha256');
  const result = hasher.update(token).digest('hex');
  if (typeof result === 'string') {
    return result;
  }
  return await result;
}

// Password reset token utilities
export async function generateResetToken(): Promise<string> {
  const crypto = await getCrypto();
  const bytes = crypto.randomBytes(32);
  if (bytes instanceof Uint8Array) {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return (bytes as Buffer).toString('hex');
}

export async function hashResetToken(token: string): Promise<string> {
  const crypto = await getCrypto();
  const hasher = crypto.createHash('sha256');
  const result = hasher.update(token).digest('hex');
  if (typeof result === 'string') {
    return result;
  }
  return await result;
}

// CSRF token utilities
export async function generateCSRFToken(): Promise<string> {
  const crypto = await getCrypto();
  const bytes = crypto.randomBytes(32);
  if (bytes instanceof Uint8Array) {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return (bytes as Buffer).toString('hex');
}

// Rate limiting utilities
export function createRateLimitKey(
  identifier: string,
  endpoint: string
): string {
  return `rate_limit:${identifier}:${endpoint}`;
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      case "'":
        return '&#x27;';
      default:
        return char;
    }
  });
}

// Time-safe string comparison
export function timeSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
