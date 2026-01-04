import { describe, it, expect } from 'vitest';
import { OrganizationVoter } from '@/lib/security/voters/organization-voter';
import { VoteResult } from '@/lib/security/voter';

describe('OrganizationVoter', () => {
  const voter = new OrganizationVoter();

  // Test fixtures
  const org = { id: 'org-123', slug: 'test-org', name: 'Test Org' };
  const otherOrg = { id: 'org-456', slug: 'other-org', name: 'Other Org' };

  const createUser = (
    orgId: string | null,
    orgRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null
  ) => ({
    id: 'user-123',
    organizationId: orgId,
    organizationRole: orgRole,
    userRoles: [],
  });

  describe('supports()', () => {
    it('should support organization.view with organization subject', () => {
      expect(voter.supports('organization.view', org)).toBe(true);
    });

    it('should support organization.edit with organization subject', () => {
      expect(voter.supports('organization.edit', org)).toBe(true);
    });

    it('should support organization.delete with organization subject', () => {
      expect(voter.supports('organization.delete', org)).toBe(true);
    });

    it('should support organization.members.view with organization subject', () => {
      expect(voter.supports('organization.members.view', org)).toBe(true);
    });

    it('should support organization.members.manage with organization subject', () => {
      expect(voter.supports('organization.members.manage', org)).toBe(true);
    });

    it('should support organization.invites.manage with organization subject', () => {
      expect(voter.supports('organization.invites.manage', org)).toBe(true);
    });

    it('should not support unknown attributes', () => {
      expect(voter.supports('unknown.attribute', org)).toBe(false);
    });

    it('should not support without organization subject', () => {
      expect(voter.supports('organization.view', null)).toBe(false);
      expect(voter.supports('organization.view', undefined)).toBe(false);
      expect(voter.supports('organization.view', { id: '123' })).toBe(false);
    });

    it('should not support non-organization subjects', () => {
      expect(voter.supports('organization.view', { name: 'not-org' })).toBe(
        false
      );
      expect(voter.supports('organization.view', 'string')).toBe(false);
      expect(voter.supports('organization.view', 123)).toBe(false);
    });
  });

  describe('vote()', () => {
    describe('non-members', () => {
      it('should deny access for users not in the organization', async () => {
        const user = createUser(otherOrg.id, 'ADMIN');
        const result = await voter.vote(user, 'organization.view', org);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny access for users with no organization', async () => {
        const user = createUser(null, null);
        const result = await voter.vote(user, 'organization.view', org);
        expect(result).toBe(VoteResult.DENIED);
      });
    });

    describe('organization.view (requires MEMBER)', () => {
      it('should grant access to MEMBER', async () => {
        const user = createUser(org.id, 'MEMBER');
        const result = await voter.vote(user, 'organization.view', org);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant access to ADMIN', async () => {
        const user = createUser(org.id, 'ADMIN');
        const result = await voter.vote(user, 'organization.view', org);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant access to OWNER', async () => {
        const user = createUser(org.id, 'OWNER');
        const result = await voter.vote(user, 'organization.view', org);
        expect(result).toBe(VoteResult.GRANTED);
      });
    });

    describe('organization.edit (requires ADMIN)', () => {
      it('should deny access to MEMBER', async () => {
        const user = createUser(org.id, 'MEMBER');
        const result = await voter.vote(user, 'organization.edit', org);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should grant access to ADMIN', async () => {
        const user = createUser(org.id, 'ADMIN');
        const result = await voter.vote(user, 'organization.edit', org);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant access to OWNER', async () => {
        const user = createUser(org.id, 'OWNER');
        const result = await voter.vote(user, 'organization.edit', org);
        expect(result).toBe(VoteResult.GRANTED);
      });
    });

    describe('organization.delete (requires OWNER)', () => {
      it('should deny access to MEMBER', async () => {
        const user = createUser(org.id, 'MEMBER');
        const result = await voter.vote(user, 'organization.delete', org);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny access to ADMIN', async () => {
        const user = createUser(org.id, 'ADMIN');
        const result = await voter.vote(user, 'organization.delete', org);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should grant access to OWNER', async () => {
        const user = createUser(org.id, 'OWNER');
        const result = await voter.vote(user, 'organization.delete', org);
        expect(result).toBe(VoteResult.GRANTED);
      });
    });

    describe('organization.members.view (requires MEMBER)', () => {
      it('should grant access to MEMBER', async () => {
        const user = createUser(org.id, 'MEMBER');
        const result = await voter.vote(user, 'organization.members.view', org);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant access to ADMIN', async () => {
        const user = createUser(org.id, 'ADMIN');
        const result = await voter.vote(user, 'organization.members.view', org);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant access to OWNER', async () => {
        const user = createUser(org.id, 'OWNER');
        const result = await voter.vote(user, 'organization.members.view', org);
        expect(result).toBe(VoteResult.GRANTED);
      });
    });

    describe('organization.members.manage (requires ADMIN)', () => {
      it('should deny access to MEMBER', async () => {
        const user = createUser(org.id, 'MEMBER');
        const result = await voter.vote(
          user,
          'organization.members.manage',
          org
        );
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should grant access to ADMIN', async () => {
        const user = createUser(org.id, 'ADMIN');
        const result = await voter.vote(
          user,
          'organization.members.manage',
          org
        );
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant access to OWNER', async () => {
        const user = createUser(org.id, 'OWNER');
        const result = await voter.vote(
          user,
          'organization.members.manage',
          org
        );
        expect(result).toBe(VoteResult.GRANTED);
      });
    });

    describe('organization.invites.manage (requires ADMIN)', () => {
      it('should deny access to MEMBER', async () => {
        const user = createUser(org.id, 'MEMBER');
        const result = await voter.vote(
          user,
          'organization.invites.manage',
          org
        );
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should grant access to ADMIN', async () => {
        const user = createUser(org.id, 'ADMIN');
        const result = await voter.vote(
          user,
          'organization.invites.manage',
          org
        );
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant access to OWNER', async () => {
        const user = createUser(org.id, 'OWNER');
        const result = await voter.vote(
          user,
          'organization.invites.manage',
          org
        );
        expect(result).toBe(VoteResult.GRANTED);
      });
    });

    describe('edge cases', () => {
      it('should deny access when user has no organization role', async () => {
        const user = createUser(org.id, null);
        const result = await voter.vote(user, 'organization.view', org);
        expect(result).toBe(VoteResult.DENIED);
      });
    });
  });
});
