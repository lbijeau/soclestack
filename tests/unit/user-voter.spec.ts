import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserVoter } from '@/lib/security/voters/user-voter';
import { VoteResult } from '@/lib/security/voter';
import * as roleChecker from '@/lib/security/role-checker';

// Mock the hasRole function from role-checker (where UserVoter imports it)
vi.mock('@/lib/security/role-checker', async () => {
  const actual = await vi.importActual('@/lib/security/role-checker');
  return {
    ...actual,
    hasRole: vi.fn(),
  };
});

describe('UserVoter', () => {
  const voter = new UserVoter();

  // Test fixtures
  const targetUser = { id: 'user-456', email: 'target@example.com' };
  const otherTarget = { id: 'user-789', email: 'other@example.com' };

  const createUser = (
    id: string,
    mockRole: 'ADMIN' | 'MODERATOR' | 'USER' | null
  ) => {
    const user = {
      id,
      userRoles: [],
    };

    // Set up hasRole mock based on role
    vi.mocked(roleChecker.hasRole).mockImplementation(async (_user, roleName) => {
      if (mockRole === 'ADMIN') {
        return (
          roleName === 'ROLE_ADMIN' ||
          roleName === 'ROLE_MODERATOR' ||
          roleName === 'ROLE_USER'
        );
      }
      if (mockRole === 'MODERATOR') {
        return roleName === 'ROLE_MODERATOR' || roleName === 'ROLE_USER';
      }
      if (mockRole === 'USER') {
        return roleName === 'ROLE_USER';
      }
      return false;
    });

    return user;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('supports()', () => {
    it('should support user.view with user subject', () => {
      expect(voter.supports('user.view', targetUser)).toBe(true);
    });

    it('should support user.edit with user subject', () => {
      expect(voter.supports('user.edit', targetUser)).toBe(true);
    });

    it('should support user.delete with user subject', () => {
      expect(voter.supports('user.delete', targetUser)).toBe(true);
    });

    it('should support user.roles.manage with user subject', () => {
      expect(voter.supports('user.roles.manage', targetUser)).toBe(true);
    });

    it('should not support unknown attributes', () => {
      expect(voter.supports('unknown.attribute', targetUser)).toBe(false);
    });

    it('should not support without user subject', () => {
      expect(voter.supports('user.view', null)).toBe(false);
      expect(voter.supports('user.view', undefined)).toBe(false);
    });

    it('should not support non-user subjects', () => {
      expect(voter.supports('user.view', 'string')).toBe(false);
      expect(voter.supports('user.view', 123)).toBe(false);
    });

    it('should support any object with id as user subject', () => {
      expect(voter.supports('user.view', { id: '123' })).toBe(true);
    });
  });

  describe('vote()', () => {
    describe('self-access', () => {
      it('should grant self view access', async () => {
        const user = createUser(targetUser.id, 'USER');
        const result = await voter.vote(user, 'user.view', targetUser);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant self edit access', async () => {
        const user = createUser(targetUser.id, 'USER');
        const result = await voter.vote(user, 'user.edit', targetUser);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should deny self delete access', async () => {
        const user = createUser(targetUser.id, 'USER');
        const result = await voter.vote(user, 'user.delete', targetUser);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny self roles.manage access', async () => {
        const user = createUser(targetUser.id, 'USER');
        const result = await voter.vote(user, 'user.roles.manage', targetUser);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny self delete even for ADMIN', async () => {
        const user = createUser(targetUser.id, 'ADMIN');
        const result = await voter.vote(user, 'user.delete', targetUser);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny self roles.manage even for ADMIN', async () => {
        const user = createUser(targetUser.id, 'ADMIN');
        const result = await voter.vote(user, 'user.roles.manage', targetUser);
        expect(result).toBe(VoteResult.DENIED);
      });
    });

    describe('ADMIN access to other users', () => {
      it('should grant view access to other users', async () => {
        const user = createUser('admin-123', 'ADMIN');
        const result = await voter.vote(user, 'user.view', otherTarget);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant edit access to other users', async () => {
        const user = createUser('admin-123', 'ADMIN');
        const result = await voter.vote(user, 'user.edit', otherTarget);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant delete access to other users', async () => {
        const user = createUser('admin-123', 'ADMIN');
        const result = await voter.vote(user, 'user.delete', otherTarget);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant roles.manage access to other users', async () => {
        const user = createUser('admin-123', 'ADMIN');
        const result = await voter.vote(user, 'user.roles.manage', otherTarget);
        expect(result).toBe(VoteResult.GRANTED);
      });
    });

    describe('MODERATOR access to other users', () => {
      it('should grant view access to other users', async () => {
        const user = createUser('mod-123', 'MODERATOR');
        const result = await voter.vote(user, 'user.view', otherTarget);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should grant edit access to other users', async () => {
        const user = createUser('mod-123', 'MODERATOR');
        const result = await voter.vote(user, 'user.edit', otherTarget);
        expect(result).toBe(VoteResult.GRANTED);
      });

      it('should deny delete access to other users', async () => {
        const user = createUser('mod-123', 'MODERATOR');
        const result = await voter.vote(user, 'user.delete', otherTarget);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny roles.manage access to other users', async () => {
        const user = createUser('mod-123', 'MODERATOR');
        const result = await voter.vote(user, 'user.roles.manage', otherTarget);
        expect(result).toBe(VoteResult.DENIED);
      });
    });

    describe('regular USER access to other users', () => {
      it('should deny view access to other users', async () => {
        const user = createUser('user-123', 'USER');
        const result = await voter.vote(user, 'user.view', otherTarget);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny edit access to other users', async () => {
        const user = createUser('user-123', 'USER');
        const result = await voter.vote(user, 'user.edit', otherTarget);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny delete access to other users', async () => {
        const user = createUser('user-123', 'USER');
        const result = await voter.vote(user, 'user.delete', otherTarget);
        expect(result).toBe(VoteResult.DENIED);
      });

      it('should deny roles.manage access to other users', async () => {
        const user = createUser('user-123', 'USER');
        const result = await voter.vote(user, 'user.roles.manage', otherTarget);
        expect(result).toBe(VoteResult.DENIED);
      });
    });
  });
});
