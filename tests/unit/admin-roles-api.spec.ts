import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/roles/route';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  isRateLimited: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    role: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/security/index', () => ({
  isGranted: vi.fn(),
  isPlatformRole: vi.fn(),
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

import { getCurrentUser, isRateLimited } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isGranted, isPlatformRole, clearRoleHierarchyCache } from '@/lib/security/index';
import { logAuditEvent } from '@/lib/audit';

describe('Admin Roles API', () => {
  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    userRoles: [{ role: { id: 'role-1', name: 'ROLE_ADMIN', parentId: null } }],
  };

  const mockRoles = [
    {
      id: 'role-1',
      name: 'ROLE_ADMIN',
      description: 'Full platform administration',
      parentId: 'role-2',
      isSystem: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      parent: { id: 'role-2', name: 'ROLE_MODERATOR' },
      _count: { userRoles: 2 },
    },
    {
      id: 'role-2',
      name: 'ROLE_MODERATOR',
      description: 'Content moderation',
      parentId: 'role-3',
      isSystem: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      parent: { id: 'role-3', name: 'ROLE_USER' },
      _count: { userRoles: 5 },
    },
    {
      id: 'role-3',
      name: 'ROLE_USER',
      description: 'Basic user access',
      parentId: null,
      isSystem: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      parent: null,
      _count: { userRoles: 100 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: not rate limited
    vi.mocked(isRateLimited).mockReturnValue(false);
    // Mock isPlatformRole to match actual regex: ROLE_[A-Z][A-Z0-9_]+
    vi.mocked(isPlatformRole).mockImplementation((value: string) => {
      return /^ROLE_[A-Z][A-Z0-9_]+$/.test(value);
    });
  });

  describe('GET /api/admin/roles', () => {
    it('should return 401 if not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 if not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(false);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.type).toBe('AUTHORIZATION_ERROR');
    });

    it('should return all roles with hierarchy info', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findMany).mockResolvedValue(mockRoles as never);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roles).toHaveLength(3);
      expect(data.roles[0]).toEqual({
        id: 'role-1',
        name: 'ROLE_ADMIN',
        description: 'Full platform administration',
        parentId: 'role-2',
        parentName: 'ROLE_MODERATOR',
        isSystem: true,
        userCount: 2,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should handle roles without parent', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findMany).mockResolvedValue([mockRoles[2]] as never);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.roles[0].parentId).toBeNull();
      expect(data.roles[0].parentName).toBeNull();
    });
  });

  describe('POST /api/admin/roles', () => {
    const createRequest = (body: object) =>
      new NextRequest('http://localhost/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify(body),
      });

    it('should return 401 if not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const response = await POST(createRequest({ name: 'ROLE_TEST' }));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.type).toBe('AUTHENTICATION_ERROR');
    });

    it('should return 403 if not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(false);

      const response = await POST(createRequest({ name: 'ROLE_TEST' }));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error.type).toBe('AUTHORIZATION_ERROR');
    });

    it('should validate role name format', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);

      // Invalid: doesn't start with ROLE_
      const response1 = await POST(createRequest({ name: 'ADMIN' }));
      expect(response1.status).toBe(400);

      // Invalid: lowercase
      const response2 = await POST(createRequest({ name: 'ROLE_admin' }));
      expect(response2.status).toBe(400);

      // Invalid: special characters
      const response3 = await POST(createRequest({ name: 'ROLE_ADMIN-TEST' }));
      expect(response3.status).toBe(400);
    });

    it('should reject duplicate role names', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRoles[0] as never);

      const response = await POST(createRequest({ name: 'ROLE_ADMIN' }));
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error.message).toBe('Role name already exists');
    });

    it('should validate parent role exists', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique)
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(null); // Parent not found

      const response = await POST(
        createRequest({ name: 'ROLE_NEW', parentId: 'invalid-id' })
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toBe('Parent role not found');
    });

    it('should create role successfully', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique)
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(mockRoles[2] as never); // Parent exists

      const newRole = {
        id: 'new-role-id',
        name: 'ROLE_SUPPORT',
        description: 'Support team',
        parentId: 'role-3',
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: { id: 'role-3', name: 'ROLE_USER' },
      };

      vi.mocked(prisma.role.create).mockResolvedValue(newRole as never);

      const response = await POST(
        createRequest({
          name: 'ROLE_SUPPORT',
          description: 'Support team',
          parentId: 'role-3',
        })
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.role.name).toBe('ROLE_SUPPORT');
      expect(data.role.parentName).toBe('ROLE_USER');
      expect(data.role.isSystem).toBe(false);
      expect(data.role.userCount).toBe(0);
    });

    it('should clear role hierarchy cache after creation', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.role.create).mockResolvedValue({
        id: 'new-role',
        name: 'ROLE_NEW',
        description: null,
        parentId: null,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: null,
      } as never);

      await POST(createRequest({ name: 'ROLE_NEW' }));

      expect(clearRoleHierarchyCache).toHaveBeenCalled();
    });

    it('should log audit event on creation', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.role.create).mockResolvedValue({
        id: 'new-role',
        name: 'ROLE_NEW',
        description: null,
        parentId: null,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: null,
      } as never);

      await POST(createRequest({ name: 'ROLE_NEW' }));

      expect(logAuditEvent).toHaveBeenCalledWith({
        action: 'ADMIN_ROLE_CREATED',
        category: 'admin',
        userId: 'admin-123',
        metadata: {
          roleId: 'new-role',
          roleName: 'ROLE_NEW',
          parentId: null,
        },
      });
    });

    it('should create role without parent', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(mockAdminUser as never);
      vi.mocked(isGranted).mockResolvedValue(true);
      vi.mocked(prisma.role.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.role.create).mockResolvedValue({
        id: 'new-role',
        name: 'ROLE_STANDALONE',
        description: 'Standalone role',
        parentId: null,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        parent: null,
      } as never);

      const response = await POST(
        createRequest({ name: 'ROLE_STANDALONE', description: 'Standalone role' })
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.role.parentId).toBeNull();
      expect(data.role.parentName).toBeNull();
    });
  });
});
