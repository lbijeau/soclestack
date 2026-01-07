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
      count: vi.fn(),
      findFirst: vi.fn(),
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
      vi.mocked(prisma.userRole.count).mockResolvedValue(3);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        roleId: 'admin-role',
        organizationId: null,
        createdAt: new Date(),
      });

      const result = await checkLastPlatformAdmin('user-1', 'actor-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it('should block removal when only one platform admin exists', async () => {
      vi.mocked(prisma.userRole.count).mockResolvedValue(1);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        roleId: 'admin-role',
        organizationId: null,
        createdAt: new Date(),
      });

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
      vi.mocked(prisma.userRole.count).mockResolvedValue(1);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue(null);

      const result = await checkLastPlatformAdmin('user-1', 'actor-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('checkLastOrgAdmin', () => {
    it('should allow removal when multiple org admins exist', async () => {
      vi.mocked(prisma.userRole.count).mockResolvedValue(2);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        roleId: 'admin-role',
        organizationId: 'org-1',
        createdAt: new Date(),
      });

      const result = await checkLastOrgAdmin('user-1', 'org-1', ROLES.ADMIN, 'actor-1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should block removal when only one org admin exists', async () => {
      vi.mocked(prisma.userRole.count).mockResolvedValue(1);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        roleId: 'admin-role',
        organizationId: 'org-1',
        createdAt: new Date(),
      });
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
      expect(prisma.userRole.count).not.toHaveBeenCalled();
    });

    it('should check for ROLE_OWNER as admin-level', async () => {
      vi.mocked(prisma.userRole.count).mockResolvedValue(1);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        roleId: 'owner-role',
        organizationId: 'org-1',
        createdAt: new Date(),
      });
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
  });

  describe('checkRoleRemovalSafeguards', () => {
    it('should check platform admin for ROLE_ADMIN with null org', async () => {
      vi.mocked(prisma.userRole.count).mockResolvedValue(2);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        roleId: 'admin-role',
        organizationId: null,
        createdAt: new Date(),
      });

      const result = await checkRoleRemovalSafeguards(
        'user-1',
        ROLES.ADMIN,
        null,
        'actor-1'
      );

      expect(result.allowed).toBe(true);
      expect(prisma.userRole.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: null,
          }),
        })
      );
    });

    it('should check org admin for ROLE_ADMIN with org context', async () => {
      vi.mocked(prisma.userRole.count).mockResolvedValue(2);
      vi.mocked(prisma.userRole.findFirst).mockResolvedValue({
        id: 'role-1',
        userId: 'user-1',
        roleId: 'admin-role',
        organizationId: 'org-1',
        createdAt: new Date(),
      });

      const result = await checkRoleRemovalSafeguards(
        'user-1',
        ROLES.ADMIN,
        'org-1',
        'actor-1'
      );

      expect(result.allowed).toBe(true);
      expect(prisma.userRole.count).toHaveBeenCalledWith(
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
      expect(prisma.userRole.count).not.toHaveBeenCalled();
    });
  });
});
