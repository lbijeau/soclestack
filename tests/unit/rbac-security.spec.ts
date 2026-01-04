/**
 * Unit tests for RBAC Security Service
 *
 * Tests role hierarchy resolution, isGranted(), hasRole(), and computeLegacyRole()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma before importing the module
vi.mock('@/lib/db', () => ({
  prisma: {
    role: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';
import {
  computeLegacyRole,
  clearRoleHierarchyCache,
  ROLES,
  type UserWithRoles,
} from '@/lib/security/index';

// Helper to create mock user with roles
function createMockUser(roleNames: string[]): UserWithRoles {
  return {
    id: 'user-123',
    userRoles: roleNames.map((name, index) => ({
      role: {
        id: `role-${index}`,
        name,
        parentId: null,
      },
    })),
  };
}

// Mock role hierarchy data (matches seed.ts structure)
const mockRolesWithHierarchy = [
  { id: 'role-user', name: ROLES.USER, parentId: null },
  { id: 'role-mod', name: ROLES.MODERATOR, parentId: 'role-user' },
  { id: 'role-admin', name: ROLES.ADMIN, parentId: 'role-mod' },
];

describe('RBAC Security Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearRoleHierarchyCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ROLES constants', () => {
    it('should have correct role name constants', () => {
      expect(ROLES.ADMIN).toBe('ROLE_ADMIN');
      expect(ROLES.MODERATOR).toBe('ROLE_MODERATOR');
      expect(ROLES.USER).toBe('ROLE_USER');
    });
  });

  describe('computeLegacyRole', () => {
    it('should return USER for null user', () => {
      expect(computeLegacyRole(null)).toBe('USER');
    });

    it('should return USER for user with no roles', () => {
      const user: UserWithRoles = { id: 'user-1', userRoles: [] };
      expect(computeLegacyRole(user)).toBe('USER');
    });

    it('should return USER for user with undefined userRoles', () => {
      const user: UserWithRoles = { id: 'user-1' };
      expect(computeLegacyRole(user)).toBe('USER');
    });

    it('should return ADMIN for user with ROLE_ADMIN', () => {
      const user = createMockUser([ROLES.ADMIN]);
      expect(computeLegacyRole(user)).toBe('ADMIN');
    });

    it('should return MODERATOR for user with ROLE_MODERATOR', () => {
      const user = createMockUser([ROLES.MODERATOR]);
      expect(computeLegacyRole(user)).toBe('MODERATOR');
    });

    it('should return USER for user with only ROLE_USER', () => {
      const user = createMockUser([ROLES.USER]);
      expect(computeLegacyRole(user)).toBe('USER');
    });

    it('should return highest role when user has multiple roles', () => {
      // User with both MODERATOR and USER should return MODERATOR
      const user = createMockUser([ROLES.MODERATOR, ROLES.USER]);
      expect(computeLegacyRole(user)).toBe('MODERATOR');
    });

    it('should return ADMIN when user has all roles', () => {
      const user = createMockUser([ROLES.USER, ROLES.MODERATOR, ROLES.ADMIN]);
      expect(computeLegacyRole(user)).toBe('ADMIN');
    });

    it('should handle unknown roles gracefully', () => {
      const user = createMockUser(['ROLE_UNKNOWN']);
      expect(computeLegacyRole(user)).toBe('USER');
    });
  });

  describe('hasRole with hierarchy', () => {
    // Import dynamically to use mocked prisma
    let hasRole: typeof import('@/lib/security/index').hasRole;

    beforeEach(async () => {
      // Setup mock to return role hierarchy
      vi.mocked(prisma.role.findMany).mockResolvedValue(mockRolesWithHierarchy);

      // Re-import to get fresh module with mocks
      const module = await import('@/lib/security/index');
      hasRole = module.hasRole;
      module.clearRoleHierarchyCache();
    });

    it('should return false for null user', async () => {
      expect(await hasRole(null, ROLES.USER)).toBe(false);
    });

    it('should return false for user with no roles', async () => {
      const user: UserWithRoles = { id: 'user-1', userRoles: [] };
      expect(await hasRole(user, ROLES.USER)).toBe(false);
    });

    it('should return true for exact role match', async () => {
      const user = createMockUser([ROLES.USER]);
      expect(await hasRole(user, ROLES.USER)).toBe(true);
    });

    it('should inherit parent roles (ADMIN has MODERATOR)', async () => {
      const user = createMockUser([ROLES.ADMIN]);
      expect(await hasRole(user, ROLES.ADMIN)).toBe(true);
      expect(await hasRole(user, ROLES.MODERATOR)).toBe(true);
      expect(await hasRole(user, ROLES.USER)).toBe(true);
    });

    it('should inherit parent roles (MODERATOR has USER)', async () => {
      const user = createMockUser([ROLES.MODERATOR]);
      expect(await hasRole(user, ROLES.MODERATOR)).toBe(true);
      expect(await hasRole(user, ROLES.USER)).toBe(true);
      expect(await hasRole(user, ROLES.ADMIN)).toBe(false);
    });

    it('should not grant child roles to parent', async () => {
      const user = createMockUser([ROLES.USER]);
      expect(await hasRole(user, ROLES.USER)).toBe(true);
      expect(await hasRole(user, ROLES.MODERATOR)).toBe(false);
      expect(await hasRole(user, ROLES.ADMIN)).toBe(false);
    });

    it('should cache role hierarchy after first call', async () => {
      const user = createMockUser([ROLES.ADMIN]);

      await hasRole(user, ROLES.ADMIN);
      await hasRole(user, ROLES.MODERATOR);
      await hasRole(user, ROLES.USER);

      // Should only query database once due to caching
      expect(prisma.role.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('isGranted', () => {
    let isGranted: typeof import('@/lib/security/index').isGranted;

    beforeEach(async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue(mockRolesWithHierarchy);
      const module = await import('@/lib/security/index');
      isGranted = module.isGranted;
      module.clearRoleHierarchyCache();
    });

    it('should return false for null user', async () => {
      expect(await isGranted(null, ROLES.USER)).toBe(false);
    });

    it('should check role for ROLE_* attributes', async () => {
      const user = createMockUser([ROLES.ADMIN]);
      expect(await isGranted(user, ROLES.ADMIN)).toBe(true);
      expect(await isGranted(user, ROLES.MODERATOR)).toBe(true);
    });

    it('should return false for non-role attributes (voters not implemented)', async () => {
      const user = createMockUser([ROLES.ADMIN]);
      // Non-ROLE_ attributes would be handled by voters (not yet implemented)
      expect(await isGranted(user, 'organization.edit')).toBe(false);
    });
  });

  describe('clearRoleHierarchyCache', () => {
    let hasRole: typeof import('@/lib/security/index').hasRole;

    beforeEach(async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue(mockRolesWithHierarchy);
      const module = await import('@/lib/security/index');
      hasRole = module.hasRole;
      module.clearRoleHierarchyCache();
    });

    it('should force re-fetch from database after cache clear', async () => {
      const user = createMockUser([ROLES.ADMIN]);

      // First call - populates cache
      await hasRole(user, ROLES.ADMIN);
      expect(prisma.role.findMany).toHaveBeenCalledTimes(1);

      // Clear cache
      clearRoleHierarchyCache();

      // Second call - should fetch again
      await hasRole(user, ROLES.ADMIN);
      expect(prisma.role.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('cycle detection', () => {
    let hasRole: typeof import('@/lib/security/index').hasRole;

    beforeEach(async () => {
      const module = await import('@/lib/security/index');
      hasRole = module.hasRole;
      module.clearRoleHierarchyCache();
    });

    it('should handle self-referencing role (direct cycle)', async () => {
      // Role that points to itself
      const cyclicRoles = [
        { id: 'role-a', name: 'ROLE_A', parentId: 'role-a' }, // Self-reference
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValue(cyclicRoles);

      const user = createMockUser(['ROLE_A']);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not hang, should return the role itself
      const result = await hasRole(user, 'ROLE_A');
      expect(result).toBe(true);

      // Should have logged a warning about cycle
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('cycle detected')
      );
    });

    it('should handle indirect cycle (A -> B -> A)', async () => {
      const cyclicRoles = [
        { id: 'role-a', name: 'ROLE_A', parentId: 'role-b' },
        { id: 'role-b', name: 'ROLE_B', parentId: 'role-a' },
      ];
      vi.mocked(prisma.role.findMany).mockResolvedValue(cyclicRoles);

      const user = createMockUser(['ROLE_A']);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not hang
      const result = await hasRole(user, 'ROLE_A');
      expect(result).toBe(true);

      // Should have detected the cycle
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle very deep hierarchy without hanging', async () => {
      // Create a chain of 15 roles (exceeds MAX_HIERARCHY_DEPTH of 10)
      const deepRoles = [];
      for (let i = 0; i < 15; i++) {
        deepRoles.push({
          id: `role-${i}`,
          name: `ROLE_LEVEL_${i}`,
          parentId: i > 0 ? `role-${i - 1}` : null,
        });
      }
      vi.mocked(prisma.role.findMany).mockResolvedValue(deepRoles);

      const user = createMockUser(['ROLE_LEVEL_14']);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should complete without hanging
      await hasRole(user, 'ROLE_LEVEL_14');

      // Should warn about depth exceeded
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('depth exceeded')
      );
    });
  });

  describe('hasRequiredRoleAsync', () => {
    let hasRequiredRoleAsync: typeof import('@/lib/security/index').hasRequiredRoleAsync;

    beforeEach(async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue(mockRolesWithHierarchy);
      const module = await import('@/lib/security/index');
      hasRequiredRoleAsync = module.hasRequiredRoleAsync;
      module.clearRoleHierarchyCache();
    });

    it('should delegate to hasRole with ROLE_ prefix', async () => {
      const user = createMockUser([ROLES.ADMIN]);
      expect(await hasRequiredRoleAsync(user, 'ADMIN')).toBe(true);
      expect(await hasRequiredRoleAsync(user, 'MODERATOR')).toBe(true);
      expect(await hasRequiredRoleAsync(user, 'USER')).toBe(true);
    });
  });

  describe('getUserRoleDisplay', () => {
    let getUserRoleDisplay: typeof import('@/lib/security/index').getUserRoleDisplay;

    beforeEach(async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue(mockRolesWithHierarchy);
      const module = await import('@/lib/security/index');
      getUserRoleDisplay = module.getUserRoleDisplay;
      module.clearRoleHierarchyCache();
    });

    it('should return USER for null user', async () => {
      expect(await getUserRoleDisplay(null)).toBe('USER');
    });

    it('should return highest role for display', async () => {
      const adminUser = createMockUser([ROLES.ADMIN]);
      expect(await getUserRoleDisplay(adminUser)).toBe('ADMIN');

      const modUser = createMockUser([ROLES.MODERATOR]);
      expect(await getUserRoleDisplay(modUser)).toBe('MODERATOR');

      const regularUser = createMockUser([ROLES.USER]);
      expect(await getUserRoleDisplay(regularUser)).toBe('USER');
    });
  });
});
