import { vi } from 'vitest';
import * as roleChecker from '@/lib/security/role-checker';
import { ROLE_NAMES as ROLES } from '@/lib/constants/roles';

/**
 * Shared mock helper for voter unit tests.
 * Creates a mock user and configures hasRole mock based on organization role.
 */
export function createMockUserWithRoles(
  id: string,
  orgId?: string | null,
  orgRole?: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' | null
) {
  const user = {
    id,
    organizationId: orgId ?? null,
    organizationRole: orgRole ?? null,
    userRoles: [],
  };

  // Set up hasRole mock based on organization role
  vi.mocked(roleChecker.hasRole).mockImplementation(
    async (_user, roleName, checkOrgId) => {
      // Platform admin check (null org context) - not in scope for these tests
      if (checkOrgId === null) {
        return false;
      }

      // Must be for the same org as the user belongs to
      if (checkOrgId !== orgId) {
        return false;
      }

      // Map organizationRole to required roles based on hierarchy
      if (orgRole === 'OWNER') {
        return (
          roleName === ROLES.OWNER ||
          roleName === ROLES.ADMIN ||
          roleName === ROLES.MODERATOR ||
          roleName === ROLES.USER
        );
      }
      if (orgRole === 'ADMIN') {
        return (
          roleName === ROLES.ADMIN ||
          roleName === ROLES.MODERATOR ||
          roleName === ROLES.USER
        );
      }
      if (orgRole === 'MODERATOR') {
        return roleName === ROLES.MODERATOR || roleName === ROLES.USER;
      }
      if (orgRole === 'MEMBER') {
        return roleName === ROLES.USER;
      }
      return false;
    }
  );

  return user;
}

/**
 * Setup for voter unit tests - call this in vi.mock() factory.
 * Returns a mock module that preserves actual exports but mocks hasRole.
 */
export function setupRoleCheckerMock() {
  return {
    hasRole: vi.fn(),
  };
}
