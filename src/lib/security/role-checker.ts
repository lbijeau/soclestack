/**
 * Role Checker - Core role hierarchy resolution
 *
 * Extracted to prevent circular dependencies between security/index and voters.
 * This module has no dependencies on voters, so voters can safely import from here.
 */

import { prisma } from '@/lib/db';

/**
 * User type with roles included
 */
export interface UserWithRoles {
  id: string;
  userRoles?: Array<{
    organizationId: string | null;
    role: {
      id: string;
      name: string;
      parentId: string | null;
    };
  }>;
}

// Cache for role hierarchy (invalidate on role changes)
let roleHierarchyCache: Map<string, Set<string>> | null = null;

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  lastWarmTimeMs: number | null;
  lastWarmAt: Date | null;
}

// Cache metrics state
const cacheMetrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  size: 0,
  lastWarmTimeMs: null,
  lastWarmAt: null,
};

/**
 * Maximum depth for role hierarchy traversal (prevents infinite loops from cycles)
 */
const MAX_HIERARCHY_DEPTH = 10;

/**
 * Check if user has a specific role (resolves hierarchy)
 *
 * Example: User with ROLE_ADMIN also has ROLE_MODERATOR and ROLE_USER
 * because ROLE_ADMIN -> ROLE_MODERATOR -> ROLE_USER in hierarchy
 *
 * @param organizationId - Organization context (null = platform-wide, string = specific org)
 *                         SECURITY: defaults to null to prevent cross-tenant access
 */
export async function hasRole(
  user: UserWithRoles | null,
  roleName: string,
  organizationId: string | null = null
): Promise<boolean> {
  if (!user) return false;

  const userRoleNames = getUserRoleNames(user, organizationId);
  if (userRoleNames.length === 0) return false;

  const allRoles = await resolveHierarchy(userRoleNames);
  return allRoles.has(roleName);
}

/**
 * Get user's directly assigned role names, filtered by organization context
 *
 * @param organizationId - Filter by org context:
 *   - null: Return only platform-wide roles (organizationId = null)
 *   - string: Return roles for that org + platform-wide roles
 */
function getUserRoleNames(
  user: UserWithRoles,
  organizationId: string | null
): string[] {
  if (!user.userRoles || user.userRoles.length === 0) {
    return [];
  }

  // Filter by organization context
  const filteredRoles = user.userRoles.filter((ur) => {
    // Platform-wide roles (null) work everywhere
    if (ur.organizationId === null) {
      return true;
    }

    // Org-specific roles must match
    return ur.organizationId === organizationId;
  });

  return filteredRoles.map((ur) => ur.role.name);
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
 * Get role hierarchy map from database (cached)
 *
 * Returns Map where key is role name, value is Set of all roles it includes
 * Example: ROLE_ADMIN -> {ROLE_ADMIN, ROLE_MODERATOR, ROLE_USER}
 *
 * Includes cycle detection to prevent infinite loops if roles are misconfigured.
 */
async function getRoleHierarchy(): Promise<Map<string, Set<string>>> {
  if (roleHierarchyCache) {
    cacheMetrics.hits++;
    return roleHierarchyCache;
  }

  cacheMetrics.misses++;
  const startTime = Date.now();

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

  // Update cache metrics
  cacheMetrics.lastWarmTimeMs = Date.now() - startTime;
  cacheMetrics.lastWarmAt = new Date();
  cacheMetrics.size = hierarchy.size;

  return hierarchy;
}

/**
 * Clear role hierarchy cache (call when roles are modified)
 */
export function clearRoleHierarchyCache(): void {
  roleHierarchyCache = null;
  cacheMetrics.size = 0;
}

/**
 * Get current cache metrics (read-only snapshot)
 *
 * Returns hit rate, miss rate, size, and timing information.
 * Use for monitoring cache effectiveness.
 */
export function getCacheMetrics(): CacheMetrics & { hitRate: number } {
  const total = cacheMetrics.hits + cacheMetrics.misses;
  return {
    ...cacheMetrics,
    hitRate: total > 0 ? cacheMetrics.hits / total : 0,
  };
}

/**
 * Reset cache metrics counters (useful for testing or periodic reset)
 */
export function resetCacheMetrics(): void {
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  // Keep size, lastWarmTimeMs, lastWarmAt as they reflect current cache state
}
