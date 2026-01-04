import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/admin/users/[id]/roles/route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    role: {
      findMany: vi.fn(),
    },
    userRole: {
      count: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/security/index', () => ({
  isGranted: vi.fn(),
  ROLES: {
    ADMIN: 'ROLE_ADMIN',
    MODERATOR: 'ROLE_MODERATOR',
    USER: 'ROLE_USER',
  },
}));

vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn(),
}));

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGranted } from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';

describe('Admin User Roles API', () => {
  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    userRoles: [{ role: { id: 'role-1', name: 'ROLE_ADMIN', parentId: null } }],
  };

  const mockTargetUser = {
    id: 'user-456',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    userRoles: [
      {
        role: { id: 'role-2', name: 'ROLE_MODERATOR', description: 'Content moderation' },
      },
    ],
  };

  const mockRoles = [
    {
      id: 'role-1',
      name: 'ROLE_ADMIN',
      description: 'Full platform administration',
      parentId: 'role-2',
    },
    {
      id: 'role-2',
      name: 'ROLE_MODERATOR',
      description: 'Content moderation',
      parentId: 'role-3',
    },
    {
      id: 'role-3',
      name: 'ROLE_USER',
      description: 'Basic user access',
      parentId: null,
    },
  ];

  const createRouteParams = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/users/[id]/roles', () => {
    const createRequest = () =>
      new NextRequest('http://localhost/api/admin/users/user-456/roles', {
        method: 'GET',
      });

    it('should return 401 if not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await GET(createRequest(), createRouteParams('user-456'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 if not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(false);

      const response = await GET(createRequest(), createRouteParams('user-456'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.type).toBe('AUTHORIZATION_ERROR');
    });

    it('should return 404 if user not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await GET(createRequest(), createRouteParams('nonexistent'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.type).toBe('NOT_FOUND');
    });

    it('should return user roles with direct and inherited', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as never);
      vi.mocked(prisma.role.findMany).mockResolvedValue(mockRoles as never);

      const response = await GET(createRequest(), createRouteParams('user-456'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.userId).toBe('user-456');
      expect(data.email).toBe('user@example.com');
      expect(data.directRoles).toHaveLength(1);
      expect(data.directRoles[0].name).toBe('ROLE_MODERATOR');
      // ROLE_USER is inherited from ROLE_MODERATOR
      expect(data.inheritedRoles).toHaveLength(1);
      expect(data.inheritedRoles[0].name).toBe('ROLE_USER');
    });

    it('should return empty inheritedRoles when direct role has no parent', async () => {
      // User with only ROLE_USER (top of hierarchy, no parent)
      const userWithBaseRole = {
        id: 'user-789',
        email: 'basic@example.com',
        firstName: 'Basic',
        lastName: 'User',
        userRoles: [
          {
            role: { id: 'role-3', name: 'ROLE_USER', description: 'Basic user access' },
          },
        ],
      };

      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(userWithBaseRole as never);
      // ROLE_USER has no parent (parentId: null)
      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRoles[2]] as never);

      const response = await GET(createRequest(), createRouteParams('user-789'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.directRoles).toHaveLength(1);
      expect(data.directRoles[0].name).toBe('ROLE_USER');
      expect(data.inheritedRoles).toHaveLength(0);
    });
  });

  describe('PUT /api/admin/users/[id]/roles', () => {
    const createRequest = (body: object) =>
      new NextRequest('http://localhost/api/admin/users/user-456/roles', {
        method: 'PUT',
        body: JSON.stringify(body),
      });

    it('should return 401 if not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await PUT(
        createRequest({ roleIds: ['role-1'] }),
        createRouteParams('user-456')
      );
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 if not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(false);

      const response = await PUT(
        createRequest({ roleIds: ['role-1'] }),
        createRouteParams('user-456')
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.type).toBe('AUTHORIZATION_ERROR');
    });

    it('should validate roleIds is required and non-empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);

      // Empty array
      const response1 = await PUT(
        createRequest({ roleIds: [] }),
        createRouteParams('user-456')
      );
      expect(response1.status).toBe(400);

      // Missing roleIds
      const response2 = await PUT(createRequest({}), createRouteParams('user-456'));
      expect(response2.status).toBe(400);
    });

    it('should return 404 if user not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await PUT(
        createRequest({ roleIds: ['role-1'] }),
        createRouteParams('nonexistent')
      );
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.type).toBe('NOT_FOUND');
    });

    it('should return 400 if some roles not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as never);
      // Only return one role when two are requested
      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRoles[0]] as never);

      const response = await PUT(
        createRequest({ roleIds: ['role-1', 'invalid-role'] }),
        createRouteParams('user-456')
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.type).toBe('VALIDATION_ERROR');
      expect(data.error.message).toContain('not found');
    });

    it('should prevent admin from removing their own admin role', async () => {
      const adminUserWithRole = {
        ...mockAdminUser,
        firstName: 'Admin',
        lastName: 'User',
        userRoles: [
          { role: { id: 'role-1', name: 'ROLE_ADMIN' } },
        ],
      };

      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUserWithRole as never);
      // Return only ROLE_USER (not ROLE_ADMIN)
      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRoles[2]] as never);

      const response = await PUT(
        createRequest({ roleIds: ['role-3'] }), // Only ROLE_USER
        createRouteParams('admin-123') // Same as current user
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.type).toBe('VALIDATION_ERROR');
      expect(data.error.message).toBe('Cannot remove your own admin role');
    });

    it('should prevent removing last admin from system', async () => {
      const lastAdminUser = {
        id: 'other-admin',
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'Admin',
        userRoles: [{ role: { id: 'role-1', name: 'ROLE_ADMIN' } }],
      };

      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(lastAdminUser as never);
      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRoles[2]] as never);

      // Simulate transaction throwing LAST_ADMIN error
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('LAST_ADMIN'));

      const response = await PUT(
        createRequest({ roleIds: ['role-3'] }),
        createRouteParams('other-admin')
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Cannot remove the last admin user');
    });

    it('should update user roles successfully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as never);
      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRoles[0], mockRoles[2]] as never);
      vi.mocked(prisma.$transaction).mockResolvedValue(undefined);

      const response = await PUT(
        createRequest({ roleIds: ['role-1', 'role-3'] }),
        createRouteParams('user-456')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.userId).toBe('user-456');
      expect(data.directRoles).toHaveLength(2);
    });

    it('should log audit event on role update', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockTargetUser as never);
      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRoles[0]] as never);
      vi.mocked(prisma.$transaction).mockResolvedValue(undefined);

      await PUT(createRequest({ roleIds: ['role-1'] }), createRouteParams('user-456'));

      expect(logAuditEvent).toHaveBeenCalledWith({
        action: 'ADMIN_USER_ROLES_UPDATED',
        category: 'admin',
        userId: 'admin-123',
        metadata: expect.objectContaining({
          targetUserId: 'user-456',
          targetEmail: 'user@example.com',
        }),
      });
    });
  });
});
