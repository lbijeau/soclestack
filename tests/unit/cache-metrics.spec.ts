import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasRole,
  clearRoleHierarchyCache,
  getCacheMetrics,
  resetCacheMetrics,
} from '@/lib/security/role-checker';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    role: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/db';

describe('Cache Metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRoleHierarchyCache();
    resetCacheMetrics();
  });

  describe('getCacheMetrics', () => {
    it('should return initial metrics with zero values', () => {
      const metrics = getCacheMetrics();

      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.size).toBe(0);
      expect(metrics.hitRate).toBe(0);
      expect(metrics.lastWarmTimeMs).toBeNull();
      expect(metrics.lastWarmAt).toBeNull();
    });

    it('should track cache miss on first access', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      await hasRole(user, 'ROLE_USER', null);

      const metrics = getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });

    it('should track cache hit on subsequent access', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      // First call - cache miss
      await hasRole(user, 'ROLE_USER', null);
      // Second call - cache hit
      await hasRole(user, 'ROLE_USER', null);

      const metrics = getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(1);
      expect(metrics.hitRate).toBe(0.5);
    });

    it('should track cache size after warming', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
        { id: 'role-2', name: 'ROLE_MODERATOR', parentId: 'role-1' },
        { id: 'role-3', name: 'ROLE_ADMIN', parentId: 'role-2' },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      await hasRole(user, 'ROLE_USER', null);

      const metrics = getCacheMetrics();
      expect(metrics.size).toBe(3);
    });

    it('should track warm time after cache build', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      await hasRole(user, 'ROLE_USER', null);

      const metrics = getCacheMetrics();
      expect(metrics.lastWarmTimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.lastWarmAt).toBeInstanceOf(Date);
    });

    it('should calculate hit rate correctly', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      // 1 miss, then 4 hits
      await hasRole(user, 'ROLE_USER', null);
      await hasRole(user, 'ROLE_USER', null);
      await hasRole(user, 'ROLE_USER', null);
      await hasRole(user, 'ROLE_USER', null);
      await hasRole(user, 'ROLE_USER', null);

      const metrics = getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(4);
      expect(metrics.hitRate).toBe(0.8);
    });
  });

  describe('resetCacheMetrics', () => {
    it('should reset hit and miss counters', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      await hasRole(user, 'ROLE_USER', null);
      await hasRole(user, 'ROLE_USER', null);

      // Verify counts before reset
      let metrics = getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(1);

      // Reset counters
      resetCacheMetrics();

      // Verify counters are reset but cache state preserved
      metrics = getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.size).toBe(1); // Size preserved
      expect(metrics.lastWarmTimeMs).not.toBeNull(); // Warm time preserved
    });
  });

  describe('clearRoleHierarchyCache', () => {
    it('should reset cache size to zero', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
        { id: 'role-2', name: 'ROLE_MODERATOR', parentId: 'role-1' },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      await hasRole(user, 'ROLE_USER', null);

      let metrics = getCacheMetrics();
      expect(metrics.size).toBe(2);

      clearRoleHierarchyCache();

      metrics = getCacheMetrics();
      expect(metrics.size).toBe(0);
    });

    it('should cause cache miss on next access after clear', async () => {
      vi.mocked(prisma.role.findMany).mockResolvedValue([
        { id: 'role-1', name: 'ROLE_USER', parentId: null },
      ]);

      const user = {
        id: 'user-1',
        userRoles: [
          {
            organizationId: null,
            role: { id: 'role-1', name: 'ROLE_USER', parentId: null },
          },
        ],
      };

      // First access - miss
      await hasRole(user, 'ROLE_USER', null);
      // Second access - hit
      await hasRole(user, 'ROLE_USER', null);

      let metrics = getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(1);

      // Clear cache
      clearRoleHierarchyCache();
      resetCacheMetrics();

      // Third access - miss again
      await hasRole(user, 'ROLE_USER', null);

      metrics = getCacheMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);
    });
  });
});
