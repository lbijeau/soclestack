import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkLastPlatformAdmin,
  checkLastOrgAdmin,
  checkRoleRemovalSafeguards,
} from '@/lib/security/role-safeguards';
import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    userRole: {
      findMany: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock audit logger
vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

describe('Role Safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkLastPlatformAdmin', () => {
    it('should allow removal when multiple platform admins exist', async () => {
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      const result = await checkLastPlatformAdmin('user-1', 'actor-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it('should block removal when only one platform admin exists', async () => {
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1' },
      ]);

      const result = await checkLastPlatformAdmin('user-1', 'actor-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot remove the last platform administrator');
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_REMOVAL_BLOCKED',
          category: 'security',
          metadata: expect.objectContaining({
            reason: 'last_platform_admin',
          }),
        })
      );
    });

    it('should allow removal when target is not a platform admin', async () => {
      // One admin exists, but it's not the target user
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'other-user' },
      ]);

      const result = await checkLastPlatformAdmin('user-1', 'actor-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('checkLastOrgAdmin', () => {
    it('should allow removal when multiple org admins exist', async () => {
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1', role: { name: ROLES.ADMIN } },
        { userId: 'user-2', role: { name: ROLES.ADMIN } },
      ]);

      const result = await checkLastOrgAdmin('user-1', 'org-1', ROLES.ADMIN, 'actor-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block removal when only one org admin exists', async () => {
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1', role: { name: ROLES.ADMIN } },
      ]);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkLastOrgAdmin('user-1', 'org-1', ROLES.ADMIN, 'actor-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot remove the last administrator from organization "Test Org"');
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROLE_REMOVAL_BLOCKED',
          category: 'security',
          metadata: expect.objectContaining({
            reason: 'last_org_admin',
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should allow removal of non-admin roles without checking', async () => {
      const result = await checkLastOrgAdmin('user-1', 'org-1', ROLES.USER, 'actor-1');

      expect(result.allowed).toBe(true);
      expect(prisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('should check for ROLE_OWNER as admin-level', async () => {
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1', role: { name: ROLES.OWNER } },
      ]);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await checkLastOrgAdmin('user-1', 'org-1', ROLES.OWNER, 'actor-1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Cannot remove the last administrator');
    });

    it('should allow removal when user has both ROLE_ADMIN and ROLE_OWNER', async () => {
      // User has both admin roles - removing one still leaves one admin role
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1', role: { name: ROLES.ADMIN } },
        { userId: 'user-1', role: { name: ROLES.OWNER } },
      ]);

      const result = await checkLastOrgAdmin('user-1', 'org-1', ROLES.ADMIN, 'actor-1');

      // Should allow because there are 2 admin-level role assignments (count=2)
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('checkRoleRemovalSafeguards', () => {
    it('should check platform admin for ROLE_ADMIN with null org', async () => {
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);

      const result = await checkRoleRemovalSafeguards(
        'user-1',
        ROLES.ADMIN,
        null,
        'actor-1'
      );

      expect(result.allowed).toBe(true);
      expect(prisma.userRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: null,
          }),
        })
      );
    });

    it('should check org admin for ROLE_ADMIN with org context', async () => {
      vi.mocked(prisma.userRole.findMany).mockResolvedValue([
        { userId: 'user-1', role: { name: ROLES.ADMIN } },
        { userId: 'user-2', role: { name: ROLES.ADMIN } },
      ]);

      const result = await checkRoleRemovalSafeguards(
        'user-1',
        ROLES.ADMIN,
        'org-1',
        'actor-1'
      );

      expect(result.allowed).toBe(true);
      expect(prisma.userRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('should allow removal of non-critical roles without checks', async () => {
      const result = await checkRoleRemovalSafeguards(
        'user-1',
        ROLES.USER,
        null,
        'actor-1'
      );

      expect(result.allowed).toBe(true);
      expect(prisma.userRole.findMany).not.toHaveBeenCalled();
    });
  });
});
