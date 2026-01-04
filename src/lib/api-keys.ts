import { randomBytes, createHash } from 'crypto';
import { prisma } from './db';
import { ApiKeyPermission } from '@prisma/client';
import { getHighestRole, userWithRolesInclude } from './security/index';

const API_KEY_PREFIX = 'lsk_';
const API_KEY_BYTES = 32;
const MAX_KEYS_PER_USER = 10;

export interface GeneratedApiKey {
  key: string; // Full key (shown once)
  keyHash: string; // SHA-256 hash for storage
  keyPrefix: string; // First 8 chars for identification
}

export interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  permission: ApiKeyPermission;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

/**
 * Generate a new API key with prefix, hash, and prefix for identification
 */
export function generateApiKey(): GeneratedApiKey {
  const bytes = randomBytes(API_KEY_BYTES);
  const randomPart = bytes.toString('base64url');
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(key);
  const keyPrefix = key.substring(0, 8);

  return { key, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX) && key.length >= 40;
}

/**
 * Check if user has reached the API key limit
 */
export async function hasReachedKeyLimit(userId: string): Promise<boolean> {
  const count = await prisma.apiKey.count({
    where: {
      userId,
      revokedAt: null,
    },
  });
  return count >= MAX_KEYS_PER_USER;
}

/**
 * Get count of user's active API keys
 */
export async function getActiveKeyCount(userId: string): Promise<number> {
  return prisma.apiKey.count({
    where: {
      userId,
      revokedAt: null,
    },
  });
}

/**
 * Validate an API key and return the associated user if valid
 */
export async function validateApiKey(key: string): Promise<{
  valid: boolean;
  apiKey?: {
    id: string;
    permission: ApiKeyPermission;
    user: {
      id: string;
      email: string;
      role: string;
      isActive: boolean;
      organizationId: string | null;
    };
  };
  error?: string;
}> {
  if (!isValidApiKeyFormat(key)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          organizationId: true,
          ...userWithRolesInclude,
        },
      },
    },
  });

  if (!apiKey) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Check if key is expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key has expired' };
  }

  // Check if user is active
  if (!apiKey.user.isActive) {
    return { valid: false, error: 'User account is deactivated' };
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Ignore errors from updating lastUsedAt
    });

  return {
    valid: true,
    apiKey: {
      id: apiKey.id,
      permission: apiKey.permission,
      user: {
        id: apiKey.user.id,
        email: apiKey.user.email,
        role: getHighestRole(apiKey.user),
        isActive: apiKey.user.isActive,
        organizationId: apiKey.user.organizationId,
      },
    },
  };
}

/**
 * Check if a permission level allows the given HTTP method
 */
export function isMethodAllowed(
  permission: ApiKeyPermission,
  method: string
): boolean {
  const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];

  if (permission === 'READ_WRITE') {
    return true;
  }

  return readOnlyMethods.includes(method.toUpperCase());
}

export { MAX_KEYS_PER_USER };
