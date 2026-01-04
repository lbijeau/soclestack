import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, JWTPayload as JoseJWTPayload } from 'jose';
import { JWTPayload, RefreshTokenPayload, PlatformRole } from '@/types/auth';
import { env } from './env';

// Valid roles for runtime validation
const VALID_ROLES: PlatformRole[] = [
  'ROLE_USER',
  'ROLE_MODERATOR',
  'ROLE_ADMIN',
];

function isValidAccessTokenPayload(
  payload: JoseJWTPayload
): payload is JoseJWTPayload & {
  sub: string;
  email: string;
  role: PlatformRole;
  jti: string;
} {
  return (
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.role === 'string' &&
    VALID_ROLES.includes(payload.role as PlatformRole) &&
    typeof payload.jti === 'string'
  );
}

function isValidRefreshTokenPayload(
  payload: JoseJWTPayload
): payload is JoseJWTPayload & {
  sub: string;
  jti: string;
} {
  return typeof payload.sub === 'string' && typeof payload.jti === 'string';
}

// Cache encoded secrets for jose
let cachedJwtSecret: Uint8Array | null = null;
let cachedJwtSecretValue: string | null = null;
let cachedRefreshSecret: Uint8Array | null = null;
let cachedRefreshSecretValue: string | null = null;

function getJwtSecret(): Uint8Array {
  const secret = env.JWT_SECRET as string;
  if (cachedJwtSecret && cachedJwtSecretValue === secret) {
    return cachedJwtSecret;
  }
  cachedJwtSecretValue = secret;
  cachedJwtSecret = new TextEncoder().encode(secret);
  return cachedJwtSecret;
}

function getRefreshSecret(): Uint8Array {
  const secret = env.JWT_REFRESH_SECRET as string;
  if (cachedRefreshSecret && cachedRefreshSecretValue === secret) {
    return cachedRefreshSecret;
  }
  cachedRefreshSecretValue = secret;
  cachedRefreshSecret = new TextEncoder().encode(secret);
  return cachedRefreshSecret;
}

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
// Note: JWT_SECRET and JWT_REFRESH_SECRET are validated by env module.
// In production they are required; in development permissive parsing is used.
export async function generateAccessToken(payload: {
  userId: string;
  email: string;
  role: PlatformRole;
}): Promise<string> {
  const crypto = await getCrypto();

  return new SignJWT({
    sub: payload.userId,
    email: payload.email,
    role: payload.role,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('soclestack')
    .setAudience('soclestack-users')
    .sign(getJwtSecret());
}

export async function generateRefreshToken(payload: {
  userId: string;
}): Promise<string> {
  const crypto = await getCrypto();

  return new SignJWT({
    sub: payload.userId,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .setIssuer('soclestack')
    .setAudience('soclestack-refresh')
    .sign(getRefreshSecret());
}

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: 'soclestack',
      audience: 'soclestack-users',
    });

    if (!isValidAccessTokenPayload(payload)) {
      throw new Error('Invalid access token payload');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
      iat: payload.iat!,
      exp: payload.exp!,
    };
  } catch {
    throw new Error('Invalid access token');
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret(), {
      issuer: 'soclestack',
      audience: 'soclestack-refresh',
    });

    if (!isValidRefreshTokenPayload(payload)) {
      throw new Error('Invalid refresh token payload');
    }

    return {
      sub: payload.sub,
      jti: payload.jti,
      iat: payload.iat!,
      exp: payload.exp!,
    };
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
