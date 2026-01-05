import { describe, it, expect } from 'vitest';
import type { SessionData } from '@/types/auth';

describe('iron-session SessionData', () => {
  it('session should include userRoles', () => {
    const mockSession: SessionData = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'ROLE_USER',
      isLoggedIn: true,
      userRoles: [
        {
          role: { id: 'role-1', name: 'ROLE_ADMIN', parentId: null },
          organizationId: null,
        },
      ],
    };

    expect(mockSession.userRoles).toBeDefined();
    expect(mockSession.userRoles).toHaveLength(1);
  });
});
