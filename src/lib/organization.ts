import { OrganizationRole } from '@prisma/client';
import { prisma } from './db';
import crypto from 'crypto';

/**
 * Generate a URL-friendly slug from an organization name.
 * Handles duplicates by appending a number suffix.
 */
export async function generateSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check if slug exists
  let slug = baseSlug;
  let counter = 1;

  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
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
