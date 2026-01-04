/**
 * Security Service - Symfony-style RBAC
 *
 * Main authorization check using role hierarchy and voters.
 * Roles are stored in database with parent-child relationships.
 * ROLE_ADMIN inherits from ROLE_MODERATOR inherits from ROLE_USER.
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';

import type { User, UserRole } from '@prisma/client';
import type { PlatformRole } from '@/types/auth';
import { VoteResult } from './voter';
import { voters } from './voters';

// Voter class names for debug logging
const VOTER_NAMES = ['OrganizationVoter', 'UserVoter'] as const;

/**
 * Role name constants to avoid magic strings
 */
export const ROLES = {
  ADMIN: 'ROLE_ADMIN',
  MODERATOR: 'ROLE_MODERATOR',
  USER: 'ROLE_USER',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// Cache for role hierarchy (invalidate on role changes)
let roleHierarchyCache: Map<string, Set<string>> | null = null;

// Cache for voter lookup by attribute (maps attribute -> voter index or -1 if none)
const voterCache = new Map<string, number>();

/**
 * User type with roles included
 */
export interface UserWithRoles {
  id: string;
  userRoles?: Array<{
    role: {
      id: string;
      name: string;
      parentId: string | null;
    };
  }>;
}

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
 * @param subject - Optional subject for voter-based contextual checks
 */
export async function isGranted(
  user: UserWithRoles | null,
  attribute: string,
  subject?: unknown
): Promise<boolean> {
  if (!user) return false;

  // Role-based check (ROLE_* attributes)
  if (attribute.startsWith('ROLE_')) {
    return hasRole(user, attribute);
  }

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

/**
 * Check if user has a specific role (resolves hierarchy)
 *
 * Example: User with ROLE_ADMIN also has ROLE_MODERATOR and ROLE_USER
 * because ROLE_ADMIN -> ROLE_MODERATOR -> ROLE_USER in hierarchy
 */
export async function hasRole(
  user: UserWithRoles | null,
  roleName: string
): Promise<boolean> {
  if (!user) return false;

  const userRoleNames = getUserRoleNames(user);
  if (userRoleNames.length === 0) return false;

  const allRoles = await resolveHierarchy(userRoleNames);
  return allRoles.has(roleName);
}

/**
 * Get user's directly assigned role names
 */
function getUserRoleNames(user: UserWithRoles): string[] {
  if (!user.userRoles || user.userRoles.length === 0) {
    return [];
  }
  return user.userRoles.map((ur) => ur.role.name);
}

/**
 * Resolve role hierarchy - returns all roles including inherited
 *
 * Example: ['ROLE_ADMIN'] resolves to {'ROLE_ADMIN', 'ROLE_MODERATOR', 'ROLE_USER'}
 */
async function resolveHierarchy(roleNames: string[]): Promise<Set<string>> {
  const hierarchy = await getRoleHierarchy();
  const allRoles = new Set<string>();

  for (const roleName of roleNames) {
    const inherited = hierarchy.get(roleName);
    if (inherited) {
      for (const role of inherited) {
        allRoles.add(role);
      }
    }
  }

  return allRoles;
}

/**
 * Maximum depth for role hierarchy traversal (prevents infinite loops from cycles)
 */
const MAX_HIERARCHY_DEPTH = 10;

/**
 * Get role hierarchy map from database (cached)
 *
 * Returns Map where key is role name, value is Set of all roles it includes
 * Example: ROLE_ADMIN -> {ROLE_ADMIN, ROLE_MODERATOR, ROLE_USER}
 *
 * Includes cycle detection to prevent infinite loops if roles are misconfigured.
 */
async function getRoleHierarchy(): Promise<Map<string, Set<string>>> {
  if (roleHierarchyCache) {
    return roleHierarchyCache;
  }

  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      parentId: true,
    },
  });

  const roleMap = new Map(roles.map((r) => [r.id, r]));
  const hierarchy = new Map<string, Set<string>>();

  for (const role of roles) {
    const inherited = new Set<string>([role.name]);
    const visited = new Set<string>([role.id]); // Track visited IDs for cycle detection

    // Walk up the hierarchy with cycle detection
    let current = role;
    let depth = 0;

    while (current.parentId && depth < MAX_HIERARCHY_DEPTH) {
      // Cycle detection: if we've seen this ID before, stop
      if (visited.has(current.parentId)) {
        console.warn(
          `Role hierarchy cycle detected at role "${current.name}" (id: ${current.id})`
        );
        break;
      }

      const parent = roleMap.get(current.parentId);
      if (parent) {
        visited.add(parent.id);
        inherited.add(parent.name);
        current = parent;
        depth++;
      } else {
        break;
      }
    }

    if (depth >= MAX_HIERARCHY_DEPTH) {
      console.warn(
        `Role hierarchy depth exceeded for role "${role.name}" - possible cycle or very deep hierarchy`
      );
    }

    hierarchy.set(role.name, inherited);
  }

  roleHierarchyCache = hierarchy;
  return hierarchy;
}

/**
 * Clear role hierarchy cache (call when roles are modified)
 */
export function clearRoleHierarchyCache(): void {
  roleHierarchyCache = null;
}

/**
 * Clear voter lookup cache (call if voters are dynamically modified)
 */
export function clearVoterCache(): void {
  voterCache.clear();
}

/**
 * Legacy compatibility - check if user has required role level
 *
 * @deprecated Use hasRole() or isGranted() instead
 */
export async function hasRequiredRoleAsync(
  user: UserWithRoles | null,
  requiredRole: 'USER' | 'MODERATOR' | 'ADMIN'
): Promise<boolean> {
  return hasRole(user, `ROLE_${requiredRole}`);
}

/**
 * Get user's highest role name (for display purposes)
 *
 * Returns the most privileged role: ROLE_ADMIN > ROLE_MODERATOR > ROLE_USER
 */
export async function getUserRoleDisplay(
  user: UserWithRoles | null
): Promise<PlatformRole> {
  if (!user) return ROLES.USER;

  if (await hasRole(user, ROLES.ADMIN)) return ROLES.ADMIN;
  if (await hasRole(user, ROLES.MODERATOR)) return ROLES.MODERATOR;
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
    include: {
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

// Re-export voter types
export { VoteResult, VotingStrategy } from './voter';
export type { Voter } from './voter';

// Re-export runtime type guards
export { isPlatformRole } from '../security';
