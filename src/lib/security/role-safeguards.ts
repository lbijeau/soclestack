/**
 * Role Safeguards
 *
 * Prevents dangerous role removal operations that could lock out admins.
 */

import { prisma } from '@/lib/db';
import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';
import { logAuditEvent } from '@/lib/audit';

export interface SafeguardResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if removing ROLE_ADMIN from a user would leave no platform admins.
 *
 * Platform admins have ROLE_ADMIN with organizationId: null.
 */
export async function checkLastPlatformAdmin(
  targetUserId: string,
  actorUserId: string
): Promise<SafeguardResult> {
  const platformAdminCount = await prisma.userRole.count({
    where: {
      role: { name: ROLES.ADMIN },
      organizationId: null,
    },
  });

  // Check if target user is a platform admin
  const targetIsPlatformAdmin = await prisma.userRole.findFirst({
    where: {
      userId: targetUserId,
      role: { name: ROLES.ADMIN },
      organizationId: null,
    },
  });

  if (targetIsPlatformAdmin && platformAdminCount <= 1) {
    // Log the blocked attempt
    await logAuditEvent({
      action: 'ROLE_REMOVAL_BLOCKED',
      category: 'security',
      userId: actorUserId,
      metadata: {
        targetUserId,
        reason: 'last_platform_admin',
        roleName: ROLES.ADMIN,
        adminCount: platformAdminCount,
      },
    });

    return {
      allowed: false,
      reason: 'Cannot remove the last platform administrator',
    };
  }

  return { allowed: true };
}

/**
 * Check if removing an admin role from a user would leave no admins in an organization.
 *
 * Considers both ROLE_ADMIN and ROLE_OWNER as admin-level roles for an org.
 */
export async function checkLastOrgAdmin(
  targetUserId: string,
  organizationId: string,
  roleName: string,
  actorUserId: string
): Promise<SafeguardResult> {
  // Only check for admin-level roles
  if (roleName !== ROLES.ADMIN && roleName !== ROLES.OWNER) {
    return { allowed: true };
  }

  // Count users with admin-level roles in this org
  const orgAdminCount = await prisma.userRole.count({
    where: {
      organizationId,
      role: {
        name: { in: [ROLES.ADMIN, ROLES.OWNER] },
      },
    },
  });

  // Check if target user has this role in this org
  const targetHasRole = await prisma.userRole.findFirst({
    where: {
      userId: targetUserId,
      organizationId,
      role: { name: roleName },
    },
  });

  if (targetHasRole && orgAdminCount <= 1) {
    // Get org name for better error message
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, slug: true },
    });

    // Log the blocked attempt
    await logAuditEvent({
      action: 'ROLE_REMOVAL_BLOCKED',
      category: 'security',
      userId: actorUserId,
      metadata: {
        targetUserId,
        reason: 'last_org_admin',
        roleName,
        organizationId,
        organizationName: org?.name,
        adminCount: orgAdminCount,
      },
    });

    return {
      allowed: false,
      reason: `Cannot remove the last administrator from organization "${org?.name || organizationId}"`,
    };
  }

  return { allowed: true };
}

/**
 * Combined safeguard check for role removal.
 *
 * Checks both platform admin and org admin safeguards based on context.
 */
export async function checkRoleRemovalSafeguards(
  targetUserId: string,
  roleName: string,
  organizationId: string | null,
  actorUserId: string
): Promise<SafeguardResult> {
  // Platform admin check (ROLE_ADMIN with null org)
  if (roleName === ROLES.ADMIN && organizationId === null) {
    return checkLastPlatformAdmin(targetUserId, actorUserId);
  }

  // Org admin check (ROLE_ADMIN or ROLE_OWNER with org context)
  if (
    organizationId &&
    (roleName === ROLES.ADMIN || roleName === ROLES.OWNER)
  ) {
    return checkLastOrgAdmin(
      targetUserId,
      organizationId,
      roleName,
      actorUserId
    );
  }

  return { allowed: true };
}
