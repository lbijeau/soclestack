import { OrganizationRole } from '@prisma/client';
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
      OR: [
        { slug: baseSlug },
        { slug: { startsWith: `${baseSlug}-` } },
      ],
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
 * Check if a user has the required organization role or higher
 */
export function hasOrgRole(
  userRole: OrganizationRole,
  requiredRole: OrganizationRole
): boolean {
  const roleHierarchy: Record<OrganizationRole, number> = {
    MEMBER: 0,
    ADMIN: 1,
    OWNER: 2,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if user can manage another user in the organization
 * - Cannot manage yourself
 * - Cannot manage someone with equal or higher role
 * - Must be at least ADMIN to manage anyone
 */
export function canManageUser(
  managerRole: OrganizationRole,
  targetRole: OrganizationRole,
  isSelf: boolean
): boolean {
  if (isSelf) return false;
  if (!hasOrgRole(managerRole, 'ADMIN')) return false;
  if (hasOrgRole(targetRole, managerRole)) return false;
  return true;
}

/**
 * Get the display name for an organization role
 */
export function getOrgRoleDisplayName(role: OrganizationRole): string {
  const displayNames: Record<OrganizationRole, string> = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MEMBER: 'Member',
  };
  return displayNames[role];
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
 * Check if an admin user can access/manage a target user based on organization membership.
 *
 * Rules:
 * - Platform super-admins (no organizationId) can access any user
 * - Organization-bound admins can only access users in their organization
 *
 * @param adminOrgId - The admin's organizationId (null for platform super-admins)
 * @param targetOrgId - The target user's organizationId
 * @returns true if the admin can access the target user
 */
export function canAccessUserInOrg(
  adminOrgId: string | null,
  targetOrgId: string | null
): boolean {
  // Platform super-admins (no org) can access anyone
  if (adminOrgId === null) {
    return true;
  }

  // Organization-bound admins can only access users in their org
  return adminOrgId === targetOrgId;
}
