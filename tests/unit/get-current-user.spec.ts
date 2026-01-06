import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Now import after mocks are set up
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getIronSession } from 'iron-session';

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include userRoles relation with role details', async () => {
    const mockSession = {
      userId: 'user-123',
      email: 'test@example.com',
      isLoggedIn: true,
    };

    const mockUserWithRoles = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      organizationId: null,
      userRoles: [
        {
          userId: 'user-123',
          roleId: 'role-1',
          organizationId: null,
          role: {
            id: 'role-1',
            name: 'ROLE_ADMIN',
            parentId: null,
          },
        },
      ],
    };

    // Mock getIronSession to return our mock session
    vi.mocked(getIronSession).mockResolvedValue(mockSession as any);

    // Mock prisma.user.findUnique to return our mock user with roles
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithRoles as any);

    const user = await getCurrentUser();

    // Verify the Prisma query includes the correct relations
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123', isActive: true },
      include: {
        userRoles: {
          select: {
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
      },
    });

    // Verify userRoles are present in the returned user
    expect(user).toBeDefined();
    expect(user?.userRoles).toBeDefined();
    expect(user?.userRoles).toHaveLength(1);
    expect(user?.userRoles[0].role).toBeDefined();
    expect(user?.userRoles[0].role.id).toBe('role-1');
    expect(user?.userRoles[0].role.name).toBe('ROLE_ADMIN');
    expect(user?.userRoles[0].role.parentId).toBeNull();
    expect(user?.userRoles[0].organizationId).toBeNull();
  });

  it('should return null if user is not logged in', async () => {
    const mockSession = {
      isLoggedIn: false,
    };

    vi.mocked(getIronSession).mockResolvedValue(mockSession as any);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should return null if userId is missing from session', async () => {
    const mockSession = {
      isLoggedIn: true,
      userId: '',
    };

    vi.mocked(getIronSession).mockResolvedValue(mockSession as any);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should return null if user is not found in database', async () => {
    const mockSession = {
      userId: 'user-123',
      email: 'test@example.com',
      isLoggedIn: true,
    };

    vi.mocked(getIronSession).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('should include organizationId in userRoles when present', async () => {
    const mockSession = {
      userId: 'user-123',
      email: 'test@example.com',
      isLoggedIn: true,
    };

    const mockUserWithOrgRole = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      isActive: true,
      organizationId: 'org-1',
      userRoles: [
        {
          userId: 'user-123',
          roleId: 'role-2',
          organizationId: 'org-1',
          role: {
            id: 'role-2',
            name: 'ROLE_MODERATOR',
            parentId: 'role-1',
          },
        },
      ],
    };

    vi.mocked(getIronSession).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithOrgRole as any);

    const user = await getCurrentUser();

    expect(user).toBeDefined();
    expect(user?.userRoles[0].organizationId).toBe('org-1');
    expect(user?.userRoles[0].role.parentId).toBe('role-1');
  });
});
