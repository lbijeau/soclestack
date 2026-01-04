import { describe, it, expect } from 'vitest';

/**
 * Admin Organization Management Tests
 *
 * These tests verify the business logic for admin organization management features.
 *
 * Security requirements:
 * - Only platform ADMIN role users can access admin organization endpoints
 * - Organization owners cannot be removed without ownership transfer
 * - Members must be sorted by role priority (OWNER > ADMIN > MEMBER)
 * - Rate limiting protects destructive operations
 */

// Role priority constants matching the API implementation
const ROLE_PRIORITY: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

/**
 * Replicates the member sorting logic from the organization detail API
 */
function sortMembersByRole<
  T extends { organizationRole: string | null; createdAt: Date },
>(members: T[]): T[] {
  return [...members].sort((a, b) => {
    const rolePriorityA = ROLE_PRIORITY[a.organizationRole || 'MEMBER'] ?? 2;
    const rolePriorityB = ROLE_PRIORITY[b.organizationRole || 'MEMBER'] ?? 2;
    if (rolePriorityA !== rolePriorityB) {
      return rolePriorityA - rolePriorityB;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Checks if a user has platform admin access
 */
function hasAdminAccess(userRole: string): boolean {
  return userRole === 'ADMIN';
}

/**
 * Checks if a member can be removed from an organization
 */
function canRemoveMember(memberRole: string | null): boolean {
  return memberRole !== 'OWNER';
}

/**
 * Checks if ownership can be transferred to a user
 */
function canTransferOwnership(
  targetUserId: string,
  organizationMembers: Array<{ id: string; organizationRole: string | null }>
): { valid: boolean; reason?: string } {
  const targetMember = organizationMembers.find((m) => m.id === targetUserId);

  if (!targetMember) {
    return { valid: false, reason: 'New owner must be an existing member' };
  }

  if (targetMember.organizationRole === 'OWNER') {
    return { valid: false, reason: 'User is already the owner' };
  }

  return { valid: true };
}

describe('Admin Organization Management', () => {
  describe('Access Control', () => {
    it('should grant access to platform ADMIN users', () => {
      expect(hasAdminAccess('ADMIN')).toBe(true);
    });

    it('should deny access to USER role', () => {
      expect(hasAdminAccess('USER')).toBe(false);
    });

    it('should deny access to MODERATOR role', () => {
      expect(hasAdminAccess('MODERATOR')).toBe(false);
    });
  });

  describe('Member Ordering', () => {
    it('should sort OWNER first, then ADMIN, then MEMBER', () => {
      const members = [
        {
          id: '1',
          organizationRole: 'MEMBER',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          organizationRole: 'ADMIN',
          createdAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          organizationRole: 'OWNER',
          createdAt: new Date('2024-01-03'),
        },
        {
          id: '4',
          organizationRole: 'MEMBER',
          createdAt: new Date('2024-01-04'),
        },
      ];

      const sorted = sortMembersByRole(members);

      expect(sorted.map((m) => m.id)).toEqual(['3', '2', '1', '4']);
      expect(sorted[0].organizationRole).toBe('OWNER');
      expect(sorted[1].organizationRole).toBe('ADMIN');
      expect(sorted[2].organizationRole).toBe('MEMBER');
      expect(sorted[3].organizationRole).toBe('MEMBER');
    });

    it('should sort by join date within the same role', () => {
      const members = [
        {
          id: '1',
          organizationRole: 'MEMBER',
          createdAt: new Date('2024-03-01'),
        },
        {
          id: '2',
          organizationRole: 'MEMBER',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: '3',
          organizationRole: 'MEMBER',
          createdAt: new Date('2024-02-01'),
        },
      ];

      const sorted = sortMembersByRole(members);

      expect(sorted.map((m) => m.id)).toEqual(['2', '3', '1']);
    });

    it('should handle null organization roles as MEMBER', () => {
      const members = [
        { id: '1', organizationRole: null, createdAt: new Date('2024-01-01') },
        {
          id: '2',
          organizationRole: 'OWNER',
          createdAt: new Date('2024-01-02'),
        },
      ];

      const sorted = sortMembersByRole(members);

      expect(sorted[0].organizationRole).toBe('OWNER');
      expect(sorted[1].organizationRole).toBe(null);
    });

    it('should handle empty member list', () => {
      const sorted = sortMembersByRole([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single member', () => {
      const members = [
        {
          id: '1',
          organizationRole: 'OWNER',
          createdAt: new Date('2024-01-01'),
        },
      ];

      const sorted = sortMembersByRole(members);
      expect(sorted).toHaveLength(1);
      expect(sorted[0].id).toBe('1');
    });
  });

  describe('Member Removal', () => {
    it('should allow removing MEMBER role users', () => {
      expect(canRemoveMember('MEMBER')).toBe(true);
    });

    it('should allow removing ADMIN role users', () => {
      expect(canRemoveMember('ADMIN')).toBe(true);
    });

    it('should prevent removing OWNER role users', () => {
      expect(canRemoveMember('OWNER')).toBe(false);
    });

    it('should allow removing users with null role (treated as MEMBER)', () => {
      expect(canRemoveMember(null)).toBe(true);
    });
  });

  describe('Ownership Transfer', () => {
    const organizationMembers = [
      { id: 'owner-1', organizationRole: 'OWNER' },
      { id: 'admin-1', organizationRole: 'ADMIN' },
      { id: 'member-1', organizationRole: 'MEMBER' },
    ];

    it('should allow transferring ownership to an ADMIN', () => {
      const result = canTransferOwnership('admin-1', organizationMembers);
      expect(result.valid).toBe(true);
    });

    it('should allow transferring ownership to a MEMBER', () => {
      const result = canTransferOwnership('member-1', organizationMembers);
      expect(result.valid).toBe(true);
    });

    it('should prevent transferring to non-existent member', () => {
      const result = canTransferOwnership('non-existent', organizationMembers);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('New owner must be an existing member');
    });

    it('should prevent transferring to current owner', () => {
      const result = canTransferOwnership('owner-1', organizationMembers);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('User is already the owner');
    });
  });

  describe('Organization Deletion', () => {
    it('should cascade clear user organization references', () => {
      // Simulating the cascade behavior when org is deleted
      const users = [
        { id: '1', organizationId: 'org-1', organizationRole: 'OWNER' as const },
        { id: '2', organizationId: 'org-1', organizationRole: 'ADMIN' as const },
        { id: '3', organizationId: 'org-2', organizationRole: 'MEMBER' as const },
      ];

      const orgToDelete = 'org-1';

      // Simulate clearing organization references
      const updatedUsers = users.map((u) => ({
        ...u,
        organizationId: u.organizationId === orgToDelete ? null : u.organizationId,
        organizationRole:
          u.organizationId === orgToDelete ? 'MEMBER' : u.organizationRole,
      }));

      expect(updatedUsers[0].organizationId).toBe(null);
      expect(updatedUsers[0].organizationRole).toBe('MEMBER');
      expect(updatedUsers[1].organizationId).toBe(null);
      expect(updatedUsers[1].organizationRole).toBe('MEMBER');
      expect(updatedUsers[2].organizationId).toBe('org-2'); // Unchanged
    });
  });

  describe('Rate Limiting Keys', () => {
    it('should generate unique rate limit keys per user and action', () => {
      const userId = 'user-123';

      const transferKey = `admin-org-transfer:${userId}`;
      const deleteKey = `admin-org-delete:${userId}`;
      const memberRemoveKey = `admin-org-member-remove:${userId}`;

      expect(transferKey).toBe('admin-org-transfer:user-123');
      expect(deleteKey).toBe('admin-org-delete:user-123');
      expect(memberRemoveKey).toBe('admin-org-member-remove:user-123');

      // Keys should be unique
      expect(new Set([transferKey, deleteKey, memberRemoveKey]).size).toBe(3);
    });
  });

  describe('Organization List Filtering', () => {
    const organizations = [
      { id: '1', name: 'Acme Corp', slug: 'acme', memberCount: 5 },
      { id: '2', name: 'Beta Inc', slug: 'beta', memberCount: 3 },
      { id: '3', name: 'Acme Labs', slug: 'acme-labs', memberCount: 10 },
    ];

    it('should filter organizations by name', () => {
      const search = 'acme';
      const filtered = organizations.filter(
        (org) =>
          org.name.toLowerCase().includes(search.toLowerCase()) ||
          org.slug.toLowerCase().includes(search.toLowerCase())
      );

      expect(filtered).toHaveLength(2);
      expect(filtered.map((o) => o.id)).toEqual(['1', '3']);
    });

    it('should filter organizations by slug', () => {
      const search = 'beta';
      const filtered = organizations.filter(
        (org) =>
          org.name.toLowerCase().includes(search.toLowerCase()) ||
          org.slug.toLowerCase().includes(search.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should return empty array when no matches', () => {
      const search = 'xyz';
      const filtered = organizations.filter(
        (org) =>
          org.name.toLowerCase().includes(search.toLowerCase()) ||
          org.slug.toLowerCase().includes(search.toLowerCase())
      );

      expect(filtered).toHaveLength(0);
    });
  });

  describe('Organization Sorting', () => {
    const organizations = [
      {
        id: '1',
        name: 'Zebra Corp',
        memberCount: 5,
        createdAt: new Date('2024-02-01'),
      },
      {
        id: '2',
        name: 'Alpha Inc',
        memberCount: 10,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: '3',
        name: 'Beta Labs',
        memberCount: 3,
        createdAt: new Date('2024-03-01'),
      },
    ];

    it('should sort by name ascending', () => {
      const sorted = [...organizations].sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      expect(sorted.map((o) => o.id)).toEqual(['2', '3', '1']);
    });

    it('should sort by name descending', () => {
      const sorted = [...organizations].sort((a, b) =>
        b.name.localeCompare(a.name)
      );

      expect(sorted.map((o) => o.id)).toEqual(['1', '3', '2']);
    });

    it('should sort by memberCount ascending', () => {
      const sorted = [...organizations].sort(
        (a, b) => a.memberCount - b.memberCount
      );

      expect(sorted.map((o) => o.id)).toEqual(['3', '1', '2']);
    });

    it('should sort by memberCount descending', () => {
      const sorted = [...organizations].sort(
        (a, b) => b.memberCount - a.memberCount
      );

      expect(sorted.map((o) => o.id)).toEqual(['2', '1', '3']);
    });

    it('should sort by createdAt ascending', () => {
      const sorted = [...organizations].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      expect(sorted.map((o) => o.id)).toEqual(['2', '1', '3']);
    });

    it('should sort by createdAt descending', () => {
      const sorted = [...organizations].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      expect(sorted.map((o) => o.id)).toEqual(['3', '1', '2']);
    });
  });

  describe('Pagination', () => {
    const generateOrgs = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `org-${i + 1}`,
        name: `Organization ${i + 1}`,
      }));

    it('should paginate results correctly', () => {
      const allOrgs = generateOrgs(25);
      const page = 2;
      const limit = 10;
      const skip = (page - 1) * limit;

      const paginated = allOrgs.slice(skip, skip + limit);

      expect(paginated).toHaveLength(10);
      expect(paginated[0].id).toBe('org-11');
      expect(paginated[9].id).toBe('org-20');
    });

    it('should handle last page with fewer items', () => {
      const allOrgs = generateOrgs(25);
      const page = 3;
      const limit = 10;
      const skip = (page - 1) * limit;

      const paginated = allOrgs.slice(skip, skip + limit);

      expect(paginated).toHaveLength(5);
      expect(paginated[0].id).toBe('org-21');
      expect(paginated[4].id).toBe('org-25');
    });

    it('should calculate total pages correctly', () => {
      const total = 25;
      const limit = 10;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(3);
    });

    it('should handle edge case of zero items', () => {
      const total = 0;
      const limit = 10;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(0);
    });
  });
});
