import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH, DELETE } from '@/app/api/admin/roles/[id]/route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    role: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/security/index', () => ({
  isGranted: vi.fn(),
  ROLES: {
    ADMIN: 'ROLE_ADMIN',
    MODERATOR: 'ROLE_MODERATOR',
    USER: 'ROLE_USER',
  },
  clearRoleHierarchyCache: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGranted, clearRoleHierarchyCache } from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';

describe('Admin Roles [id] API', () => {
  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    userRoles: [{ role: { id: 'role-1', name: 'ROLE_ADMIN', parentId: null } }],
  };

  const mockRole = {
    id: 'role-support',
    name: 'ROLE_SUPPORT',
    description: 'Support team',
    parentId: 'role-user',
    isSystem: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    parent: { id: 'role-user', name: 'ROLE_USER' },
    children: [],
    userRoles: [
      {
        user: {
          id: 'user-1',
          email: 'support@example.com',
          firstName: 'Support',
          lastName: 'User',
        },
      },
    ],
    _count: { userRoles: 1, children: 0 },
  };

  const mockSystemRole = {
    id: 'role-admin',
    name: 'ROLE_ADMIN',
    description: 'Full admin access',
    parentId: 'role-mod',
    isSystem: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    parent: { id: 'role-mod', name: 'ROLE_MODERATOR' },
    children: [],
    userRoles: [],
    _count: { userRoles: 2, children: 0 },
  };

  const createParams = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/roles/[id]', () => {
    const createRequest = () =>
      new NextRequest('http://localhost/api/admin/roles/role-support');

    it('should return 401 if not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await GET(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 if not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(false);

      const response = await GET(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.type).toBe('AUTHORIZATION_ERROR');
    });

    it('should return 404 if role not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);

      const response = await GET(createRequest(), createParams('invalid-id'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.type).toBe('NOT_FOUND');
    });

    it('should return role with users and children', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRole as never);

      const response = await GET(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role.id).toBe('role-support');
      expect(data.role.name).toBe('ROLE_SUPPORT');
      expect(data.role.parentName).toBe('ROLE_USER');
      expect(data.role.users).toHaveLength(1);
      expect(data.role.users[0].email).toBe('support@example.com');
      expect(data.role.childRoles).toHaveLength(0);
      expect(data.role.totalUsers).toBe(1);
      expect(data.role.hasMoreUsers).toBe(false);
    });

    it('should accept pagination params and return paginated users', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({
        ...mockRole,
        userRoles: [mockRole.userRoles[0]],
        _count: { userRoles: 5 },
      } as never);

      const request = new NextRequest(
        'http://localhost/api/admin/roles/role-support?usersLimit=10&usersOffset=0'
      );
      const response = await GET(request, createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role.totalUsers).toBe(5);
      expect(data.role.hasMoreUsers).toBe(true);
    });

    it('should return 400 for invalid usersLimit', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);

      const request = new NextRequest(
        'http://localhost/api/admin/roles/role-support?usersLimit=-5'
      );
      const response = await GET(request, createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.type).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('usersLimit must be a non-negative integer');
    });

    it('should return 400 for invalid usersOffset', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);

      const request = new NextRequest(
        'http://localhost/api/admin/roles/role-support?usersOffset=-1'
      );
      const response = await GET(request, createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.type).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('usersOffset must be a non-negative integer');
    });

    it('should cap usersLimit at 100', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRole as never);

      const request = new NextRequest(
        'http://localhost/api/admin/roles/role-support?usersLimit=500'
      );
      await GET(request, createParams('role-support'));

      // Verify Prisma was called with capped limit
      expect(prisma.role.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            userRoles: expect.objectContaining({
              take: 100,
            }),
          }),
        })
      );
    });

    it('should return hasMoreUsers false when all users returned', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({
        ...mockRole,
        userRoles: mockRole.userRoles,
        _count: { userRoles: 1 },
      } as never);

      const response = await GET(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role.hasMoreUsers).toBe(false);
    });
  });

  describe('PATCH /api/admin/roles/[id]', () => {
    const createRequest = (body: object) =>
      new NextRequest('http://localhost/api/admin/roles/role-support', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

    it('should return 401 if not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await PATCH(
        createRequest({ description: 'New desc' }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 if not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(false);

      const response = await PATCH(
        createRequest({ description: 'New desc' }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.type).toBe('AUTHORIZATION_ERROR');
    });

    it('should return 404 if role not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);

      const response = await PATCH(
        createRequest({ description: 'New desc' }),
        createParams('invalid-id')
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.type).toBe('NOT_FOUND');
    });

    it('should reject self as parent', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRole as never);

      const response = await PATCH(
        createRequest({ parentId: 'role-support' }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Cannot set role as its own parent');
    });

    it('should reject non-existent parent', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique)
        .mockResolvedValueOnce(mockRole as never) // Role exists
        .mockResolvedValueOnce(null); // Parent not found

      const response = await PATCH(
        createRequest({ parentId: 'invalid-parent' }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Parent role not found');
    });

    it('should update description successfully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRole as never);
      vi.mocked(prisma.role.update).mockResolvedValue({
        ...mockRole,
        description: 'Updated description',
        _count: { userRoles: 1 },
      } as never);

      const response = await PATCH(
        createRequest({ description: 'Updated description' }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role.description).toBe('Updated description');
      expect(prisma.role.update).toHaveBeenCalledWith({
        where: { id: 'role-support' },
        data: { description: 'Updated description' },
        include: expect.any(Object),
      });
    });

    it('should update parent and clear cache', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique)
        .mockResolvedValueOnce(mockRole as never) // Role exists
        .mockResolvedValueOnce({ id: 'new-parent', parentId: null } as never); // Parent exists

      vi.mocked(prisma.role.update).mockResolvedValue({
        ...mockRole,
        parentId: 'new-parent',
        parent: { id: 'new-parent', name: 'ROLE_NEW_PARENT' },
        _count: { userRoles: 1 },
      } as never);

      const response = await PATCH(
        createRequest({ parentId: 'new-parent' }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role.parentId).toBe('new-parent');
      expect(clearRoleHierarchyCache).toHaveBeenCalled();
    });

    it('should reject circular hierarchy (parent is descendant)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      // Role exists
      vi.mocked(prisma.role.findUnique)
        .mockResolvedValueOnce(mockRole as never)
        // Parent exists (role-child is a child of role-support)
        .mockResolvedValueOnce({ id: 'role-child', parentId: 'role-support' } as never)
        // isDescendant walks up: role-child -> role-support (match!)
        .mockResolvedValueOnce({ parentId: 'role-support' } as never);

      const response = await PATCH(
        createRequest({ parentId: 'role-child' }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe(
        'Cannot set parent to a descendant role (circular hierarchy)'
      );
    });

    it('should allow setting parent to null', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRole as never);
      vi.mocked(prisma.role.update).mockResolvedValue({
        ...mockRole,
        parentId: null,
        parent: null,
        _count: { userRoles: 1 },
      } as never);

      const response = await PATCH(
        createRequest({ parentId: null }),
        createParams('role-support')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role.parentId).toBeNull();
    });

    it('should log audit event on update', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRole as never);
      vi.mocked(prisma.role.update).mockResolvedValue({
        ...mockRole,
        description: 'New desc',
        _count: { userRoles: 1 },
      } as never);

      await PATCH(
        createRequest({ description: 'New desc' }),
        createParams('role-support')
      );

      expect(logAuditEvent).toHaveBeenCalledWith({
        action: 'ADMIN_ROLE_UPDATED',
        category: 'admin',
        userId: 'admin-123',
        metadata: expect.objectContaining({
          roleId: 'role-support',
          roleName: 'ROLE_SUPPORT',
        }),
      });
    });
  });

  describe('DELETE /api/admin/roles/[id]', () => {
    const createRequest = () =>
      new NextRequest('http://localhost/api/admin/roles/role-support', {
        method: 'DELETE',
      });

    it('should return 401 if not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await DELETE(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 if not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(false);

      const response = await DELETE(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.type).toBe('AUTHORIZATION_ERROR');
    });

    it('should return 404 if role not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);

      const response = await DELETE(createRequest(), createParams('invalid-id'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.type).toBe('NOT_FOUND');
    });

    it('should reject deleting system roles', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockSystemRole as never);

      const response = await DELETE(createRequest(), createParams('role-admin'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Cannot delete system roles');
    });

    it('should reject deleting roles with assigned users', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 5, children: 0 },
      } as never);

      const response = await DELETE(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('5 assigned user(s)');
    });

    it('should reject deleting roles with children', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 0, children: 2 },
      } as never);

      const response = await DELETE(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('2 child role(s)');
    });

    it('should delete role successfully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 0, children: 0 },
      } as never);
      vi.mocked(prisma.role.delete).mockResolvedValue(mockRole as never);

      const response = await DELETE(createRequest(), createParams('role-support'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.role.delete).toHaveBeenCalledWith({
        where: { id: 'role-support' },
      });
    });

    it('should clear cache and log audit on delete', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue({
        ...mockRole,
        _count: { userRoles: 0, children: 0 },
      } as never);
      vi.mocked(prisma.role.delete).mockResolvedValue(mockRole as never);

      await DELETE(createRequest(), createParams('role-support'));

      expect(clearRoleHierarchyCache).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: 'ADMIN_ROLE_DELETED',
        category: 'admin',
        userId: 'admin-123',
        metadata: {
          roleId: 'role-support',
          roleName: 'ROLE_SUPPORT',
        },
      });
    });
  });
});
