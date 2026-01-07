/**
 * Security Service - Symfony-style RBAC
 *
 * Main authorization check using role hierarchy and voters.
 * Roles are stored in database with parent-child relationships.
 * ROLE_ADMIN inherits from ROLE_MODERATOR inherits from ROLE_USER.
 */

import { log } from '@/lib/logger';

import type { User, UserRole } from '@prisma/client';
import type { PlatformRole } from '@/types/auth';
import { VoteResult } from './voter';
import { voters } from './voters';
import { ROLE_NAMES } from '@/lib/constants/roles';
import {
  hasRole,
  clearRoleHierarchyCache,
  type UserWithRoles,
} from './role-checker';
import type { Permission } from './permissions';

// Voter class names for debug logging
const VOTER_NAMES = ['OrganizationVoter', 'UserVoter'] as const;

/**
 * Role name constants to avoid magic strings
 * Re-exported from shared constants for backward compatibility
 */
export const ROLES = ROLE_NAMES;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Cache for voter lookup by attribute (maps attribute -> voter index or -1 if none)
const voterCache = new Map<string, number>();

// Re-export UserWithRoles type for backward compatibility
export type { UserWithRoles };

/**
 * Extended User type that includes userRoles relation and computed role
 */
export type UserWithComputedRole = User & {
  userRoles: Array<
    UserRole & {
      role: { id: string; name: string; parentId: string | null };
    }
  >;
  /** Computed platform role (highest role from userRoles) */
  role: PlatformRole;
};

/**
 * Main authorization check - like Symfony's isGranted()
 *
 * Uses affirmative voting strategy: first voter to GRANT wins.
 * If no voter grants, returns false (denied by default).
 *
 * @param user - User object (must include userRoles relation)
 * @param attribute - Role name (e.g., 'ROLE_ADMIN') or permission (e.g., 'organization.edit')
 * @param context - Optional context (organizationId, subject for voters)
 */
export async function isGranted(
  user: UserWithRoles | null,
  attribute: Permission | RoleName,
  context?: {
    organizationId?: string | null;
    subject?: unknown;
  }
): Promise<boolean> {
  if (!user) return false;

  // Role-based check (ROLE_* attributes)
  if (attribute.startsWith('ROLE_')) {
    return hasRole(user, attribute, context?.organizationId);
  }

  // Extract subject from context for backward compatibility
  const subject = context?.subject;

  // Check voter cache first
  const cachedIndex = voterCache.get(attribute);
  if (cachedIndex !== undefined) {
    if (cachedIndex === -1) {
      // Cached as "no voter supports this attribute"
      return false;
    }
    const voter = voters[cachedIndex];
    const voterName = VOTER_NAMES[cachedIndex];
    // Still need to check supports() for subject validation
    if (await voter.supports(attribute, subject)) {
      const result = await voter.vote(user, attribute, subject);
      log.debug('voter decision', {
        voterName,
        attribute,
        result,
        userId: user.id,
      });
      if (result === VoteResult.GRANTED) return true;
      if (result === VoteResult.DENIED) return false;
    }
    // Voter didn't support this subject, fall through to full search
  }

  // Voter-based checks for contextual permissions
  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i];
    const voterName = VOTER_NAMES[i];
    const supports = await voter.supports(attribute, subject);
    if (supports) {
      // Cache this attribute -> voter mapping
      voterCache.set(attribute, i);
      const result = await voter.vote(user, attribute, subject);
      log.debug('voter decision', {
        voterName,
        attribute,
        result,
        userId: user.id,
      });
      if (result === VoteResult.GRANTED) {
        return true;
      }
      if (result === VoteResult.DENIED) {
        return false;
      }
      // ABSTAIN continues to next voter
    }
  }

  // No voter supports this attribute - cache as -1
  if (!voterCache.has(attribute)) {
    voterCache.set(attribute, -1);
  }

  // No voter granted - deny by default
  return false;
}

// Re-export hasRole and clearRoleHierarchyCache for backward compatibility
export { hasRole, clearRoleHierarchyCache };

/**
 * Clear voter lookup cache (call if voters are dynamically modified)
 */
export function clearVoterCache(): void {
  voterCache.clear();
}

/**
 * Legacy compatibility - check if user has required role level (platform-wide)
 *
 * @deprecated Use hasRole() or isGranted() instead
 */
export async function hasRequiredRoleAsync(
  user: UserWithRoles | null,
  requiredRole: 'USER' | 'MODERATOR' | 'ADMIN'
): Promise<boolean> {
  return hasRole(user, `ROLE_${requiredRole}`, null);
}

/**
 * Get user's highest role name (for display purposes)
 *
 * Returns the most privileged role: ROLE_ADMIN > ROLE_MODERATOR > ROLE_USER
 * Checks platform-wide roles only (organizationId = null)
 */
export async function getUserRoleDisplay(
  user: UserWithRoles | null
): Promise<PlatformRole> {
  if (!user) return ROLES.USER;

  if (await hasRole(user, ROLES.ADMIN, null)) return ROLES.ADMIN;
  if (await hasRole(user, ROLES.MODERATOR, null)) return ROLES.MODERATOR;
  return ROLES.USER;
}

/**
 * Get user's highest role for display purposes (no DB call)
 *
 * Returns the most privileged role: ROLE_ADMIN > ROLE_MODERATOR > ROLE_USER
 * Use this for UI display, not authorization. For permission checks,
 * use hasRole() or isGranted() instead.
 */
export function getHighestRole(user: UserWithRoles | null): PlatformRole {
  if (!user?.userRoles?.length) return ROLES.USER;

  const roleNames = user.userRoles.map((ur) => ur.role.name);

  // Check highest first (ADMIN > MODERATOR > USER)
  if (roleNames.includes(ROLES.ADMIN)) return ROLES.ADMIN;
  if (roleNames.includes(ROLES.MODERATOR)) return ROLES.MODERATOR;
  return ROLES.USER;
}

/**
 * Include clause for Prisma queries to get user with roles
 */
export const userWithRolesInclude = {
  userRoles: {
    select: {
      id: true,
      createdAt: true,
      userId: true,
      roleId: true,
      organizationId: true,
      role: {
        select: {
          id: true,
          name: true,
          parentId: true,
        },
      },
    },
  },
} as const;

// Re-export runtime type guards
export { isPlatformRole } from '../security';

// Re-export voter types
export { VoteResult, VotingStrategy } from './voter';
export type { Voter } from './voter';

// Re-export permission constants, type guards, and types
export {
  PERMISSIONS,
  ORGANIZATION_PERMISSIONS,
  USER_PERMISSIONS,
  isOrganizationPermission,
  isUserPermission,
  isPermission,
} from './permissions';
export type {
  Permission,
  OrganizationPermission,
  UserPermission,
} from './permissions';
