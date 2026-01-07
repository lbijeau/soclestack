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
 * Uses a single query to get all platform admins and check if target is one.
 */
export async function checkLastPlatformAdmin(
  targetUserId: string,
  actorUserId: string
): Promise<SafeguardResult> {
  // Single query: get all platform admin user IDs
  const platformAdmins = await prisma.userRole.findMany({
    where: {
      role: { name: ROLES.ADMIN },
      organizationId: null,
    },
    select: { userId: true },
  });

  const platformAdminCount = platformAdmins.length;
  const targetIsPlatformAdmin = platformAdmins.some(
    (admin) => admin.userId === targetUserId
  );

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
 * Uses a single query to get admin roles and check if target has the specific role.
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

  // Single query: get all admin-level role assignments in this org
  const orgAdminRoles = await prisma.userRole.findMany({
    where: {
      organizationId,
      role: {
        name: { in: [ROLES.ADMIN, ROLES.OWNER] },
      },
    },
    select: {
      userId: true,
      role: { select: { name: true } },
    },
  });

  const orgAdminCount = orgAdminRoles.length;
  const targetHasRole = orgAdminRoles.some(
    (assignment) =>
      assignment.userId === targetUserId && assignment.role.name === roleName
  );

  if (targetHasRole && orgAdminCount <= 1) {
    // Only fetch org name when we need it for the error message
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
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
