import { describe, it, expect, beforeEach } from 'vitest';
import { isGranted, clearVoterCache } from '@/lib/security/index';
import { voters } from '@/lib/security/voters';

describe('Voter Registry Integration', () => {
  beforeEach(() => {
    // Clear voter cache between tests
    clearVoterCache();
  });

  describe('voters array', () => {
    it('should export voters array with OrganizationVoter and UserVoter', () => {
      expect(voters).toBeDefined();
      expect(Array.isArray(voters)).toBe(true);
      expect(voters.length).toBe(2);
    });

    it('should have voters with supports and vote methods', () => {
      for (const voter of voters) {
        expect(typeof voter.supports).toBe('function');
        expect(typeof voter.vote).toBe('function');
      }
    });
  });

  describe('isGranted() with voters', () => {
    const createUser = (id: string, orgId?: string, orgRole?: string) => ({
      id,
      organizationId: orgId,
      organizationRole: orgRole,
      userRoles: [],
    });

    describe('organization permissions (via OrganizationVoter)', () => {
      it('should grant organization.view to org member', async () => {
        const org = { id: 'org-123', slug: 'test-org' };
        const user = createUser('user-1', org.id, 'MEMBER');

        const result = await isGranted(user, 'organization.view', { subject: org });
        expect(result).toBe(true);
      });

      it('should deny organization.view to non-member', async () => {
        const org = { id: 'org-123', slug: 'test-org' };
        const user = createUser('user-1', 'other-org', 'MEMBER');

        const result = await isGranted(user, 'organization.view', { subject: org });
        expect(result).toBe(false);
      });

      it('should deny organization.edit to MEMBER', async () => {
        const org = { id: 'org-123', slug: 'test-org' };
        const user = createUser('user-1', org.id, 'MEMBER');

        const result = await isGranted(user, 'organization.edit', { subject: org });
        expect(result).toBe(false);
      });

      it('should grant organization.edit to org ADMIN', async () => {
        const org = { id: 'org-123', slug: 'test-org' };
        const user = createUser('user-1', org.id, 'ADMIN');

        const result = await isGranted(user, 'organization.edit', { subject: org });
        expect(result).toBe(true);
      });

      it('should grant organization.delete to OWNER', async () => {
        const org = { id: 'org-123', slug: 'test-org' };
        const user = createUser('user-1', org.id, 'OWNER');

        const result = await isGranted(user, 'organization.delete', { subject: org });
        expect(result).toBe(true);
      });

      it('should deny organization.delete to ADMIN', async () => {
        const org = { id: 'org-123', slug: 'test-org' };
        const user = createUser('user-1', org.id, 'ADMIN');

        const result = await isGranted(user, 'organization.delete', { subject: org });
        expect(result).toBe(false);
      });
    });

    describe('user permissions - self access (via UserVoter)', () => {
      // Self-access tests don't require hasRole mocking
      it('should grant user.view for self-access', async () => {
        const user = createUser('user-123');
        const targetUser = { id: 'user-123' };

        const result = await isGranted(user, 'user.view', { subject: targetUser });
        expect(result).toBe(true);
      });

      it('should grant user.edit for self-access', async () => {
        const user = createUser('user-123');
        const targetUser = { id: 'user-123' };

        const result = await isGranted(user, 'user.edit', { subject: targetUser });
        expect(result).toBe(true);
      });

      it('should deny user.delete for self-access', async () => {
        const user = createUser('user-123');
        const targetUser = { id: 'user-123' };

        const result = await isGranted(user, 'user.delete', { subject: targetUser });
        expect(result).toBe(false);
      });

      it('should deny user.roles.manage for self-access', async () => {
        const user = createUser('user-123');
        const targetUser = { id: 'user-123' };

        const result = await isGranted(user, 'user.roles.manage', { subject: targetUser });
        expect(result).toBe(false);
      });
    });

    describe('unknown permissions', () => {
      it('should deny unknown permissions', async () => {
        const user = createUser('user-1');

        const result = await isGranted(user, 'unknown.permission', { subject: {} });
        expect(result).toBe(false);
      });

      it('should deny when no subject provided for voter-based permission', async () => {
        const user = createUser('user-1');

        const result = await isGranted(user, 'organization.view', { subject: undefined });
        expect(result).toBe(false);
      });
    });

    describe('null user', () => {
      it('should deny all permissions for null user', async () => {
        const result = await isGranted(null, 'organization.view', {
          subject: {
            id: 'org-1',
            slug: 'test',
          },
        });
        expect(result).toBe(false);
      });
    });

    describe('voter caching', () => {
      it('should return consistent results with caching', async () => {
        const org = { id: 'org-123', slug: 'test-org' };
        const user = createUser('user-1', org.id, 'ADMIN');

        // First call - populates cache
        const result1 = await isGranted(user, 'organization.edit', { subject: org });
        expect(result1).toBe(true);

        // Second call - uses cache
        const result2 = await isGranted(user, 'organization.edit', { subject: org });
        expect(result2).toBe(true);
      });

      it('should cache unknown attributes as unsupported', async () => {
        const user = createUser('user-1');

        // First call - finds no voter, caches as -1
        const result1 = await isGranted(user, 'unknown.attribute', { subject: {} });
        expect(result1).toBe(false);

        // Second call - uses cached -1
        const result2 = await isGranted(user, 'unknown.attribute', { subject: {} });
        expect(result2).toBe(false);
      });

      it('should handle different subjects for same attribute', async () => {
        const org1 = { id: 'org-1', slug: 'org-1' };
        const org2 = { id: 'org-2', slug: 'org-2' };
        const user = createUser('user-1', org1.id, 'MEMBER');

        // Same attribute, different subjects
        const result1 = await isGranted(user, 'organization.view', { subject: org1 });
        expect(result1).toBe(true);

        const result2 = await isGranted(user, 'organization.view', { subject: org2 });
        expect(result2).toBe(false); // Different org, not a member
      });
    });
  });
});
