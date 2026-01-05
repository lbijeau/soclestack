import { prisma } from './db';
import crypto from 'crypto';

/**
 * Generate a URL-friendly slug from an organization name.
 * Handles duplicates by appending a number suffix.
 * Uses a single query to find existing slugs instead of N+1 queries.
 */
export async function generateSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Fetch all existing slugs that match the base slug or have numeric suffixes
  // Use OR to avoid false positives (e.g., "test" matching "testing")
  const existingSlugs = await prisma.organization.findMany({
    where: {
      OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-` } }],
    },
    select: { slug: true },
  });

  // If no conflicts, use the base slug
  const slugSet = new Set(existingSlugs.map((org) => org.slug));
  if (!slugSet.has(baseSlug)) {
    return baseSlug;
  }

  // Find the next available suffix
  let counter = 1;
  while (slugSet.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}

/**
 * Generate a secure invite token
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Invite expiry duration in days
 */
export const INVITE_EXPIRY_DAYS = 7;

/**
 * Create an invite expiry date
 */
export function createInviteExpiry(): Date {
  const date = new Date();
  date.setDate(date.getDate() + INVITE_EXPIRY_DAYS);
  return date;
}

/**
 * Get user's current organization
 * For now, returns the organization ID if user belongs to exactly one organization
 * Returns null if user belongs to zero or multiple organizations
 *
 * @param userId - The user ID to check
 * @returns Organization ID if user has exactly one org, null otherwise
 */
export async function getCurrentOrganizationId(
  userId: string
): Promise<string | null> {
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      organizationId: { not: null },
    },
    select: {
      organizationId: true,
    },
    distinct: ['organizationId'],
  });

  // User has exactly one organization
  if (userRoles.length === 1 && userRoles[0].organizationId) {
    return userRoles[0].organizationId;
  }

  // User has zero or multiple organizations
  return null;
}
