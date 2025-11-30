import { prisma } from '../db';
import { logAuditEvent } from '../audit';
import { SECURITY_CONFIG } from '../config/security';
import { generateSessionToken, hashSessionToken, timeSafeEqual } from '../security';

const { tokenLifetimeDays, cookieName } = SECURITY_CONFIG.rememberMe;

export { cookieName as REMEMBER_ME_COOKIE_NAME };

export interface RememberMeValidationResult {
  valid: boolean;
  userId?: string;
  newCookie?: string;
  theftDetected?: boolean;
}

export async function createRememberMeToken(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ cookie: string; expiresAt: Date }> {
  const series = await generateSessionToken();
  const token = await generateSessionToken();
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + tokenLifetimeDays * 24 * 60 * 60 * 1000);

  await prisma.rememberMeToken.create({
    data: {
      userId,
      series,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  await logAuditEvent({
    action: 'AUTH_REMEMBER_ME_CREATED',
    category: 'authentication',
    userId,
    ipAddress,
    userAgent,
  });

  return {
    cookie: `${series}:${token}`,
    expiresAt,
  };
}

export async function validateRememberMeToken(
  cookie: string,
  ipAddress?: string,
  userAgent?: string
): Promise<RememberMeValidationResult> {
  const parts = cookie.split(':');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [series, token] = parts;
  const tokenHash = await hashSessionToken(token);

  const storedToken = await prisma.rememberMeToken.findUnique({
    where: { series },
    include: { user: true },
  });

  if (!storedToken) {
    return { valid: false };
  }

  // Check expiration
  if (storedToken.expiresAt < new Date()) {
    await prisma.rememberMeToken.delete({ where: { series } });
    return { valid: false };
  }

  // Check token hash - if mismatch, theft detected!
  // Use timing-safe comparison to prevent timing attacks
  if (!timeSafeEqual(storedToken.tokenHash, tokenHash)) {
    // Revoke ALL tokens for this user - security breach!
    await revokeAllUserTokens(storedToken.userId);

    await logAuditEvent({
      action: 'AUTH_REMEMBER_ME_THEFT_DETECTED',
      category: 'security',
      userId: storedToken.userId,
      ipAddress,
      userAgent,
      metadata: { series },
    });

    return { valid: false, theftDetected: true };
  }

  // Check user is still active
  if (!storedToken.user.isActive) {
    await prisma.rememberMeToken.delete({ where: { series } });
    return { valid: false };
  }

  // Rotate token - generate new token, keep same series
  const newToken = await generateSessionToken();
  const newTokenHash = await hashSessionToken(newToken);

  await prisma.rememberMeToken.update({
    where: { series },
    data: {
      tokenHash: newTokenHash,
      lastUsedAt: new Date(),
      ipAddress,
      userAgent,
    },
  });

  await logAuditEvent({
    action: 'AUTH_REMEMBER_ME_USED',
    category: 'authentication',
    userId: storedToken.userId,
    ipAddress,
    userAgent,
  });

  return {
    valid: true,
    userId: storedToken.userId,
    newCookie: `${series}:${newToken}`,
  };
}

export async function revokeRememberMeToken(
  series: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const token = await prisma.rememberMeToken.findUnique({
    where: { series },
  });

  if (token) {
    await prisma.rememberMeToken.delete({ where: { series } });

    await logAuditEvent({
      action: 'AUTH_REMEMBER_ME_REVOKED',
      category: 'authentication',
      userId: userId || token.userId,
      ipAddress,
      userAgent,
    });
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.rememberMeToken.deleteMany({
    where: { userId },
  });
}

export async function getUserActiveSessions(userId: string): Promise<Array<{
  id: string;
  series: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: Date;
  createdAt: Date;
}>> {
  return prisma.rememberMeToken.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      series: true,
      ipAddress: true,
      userAgent: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  });
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.rememberMeToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
