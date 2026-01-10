import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { SocleProvider } from '../provider';
import { usePermissions } from './usePermissions';
import type { SocleClient, AuthState } from '@soclestack/core';

function createMockClient(state: AuthState): SocleClient {
  return {
    getState: vi.fn().mockReturnValue(state),
    subscribe: vi.fn().mockReturnValue(() => {}),
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    verify2FA: vi.fn(),
  } as unknown as SocleClient;
}

function createWrapper(client: SocleClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(SocleProvider, { client }, children);
  };
}

describe('usePermissions', () => {
  describe('can()', () => {
    it('should return false when user is not authenticated', () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({ roles: ['ROLE_ADMIN'] })).toBe(false);
    });

    it('should return true when user has required global role', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'admin@example.com',
          emailVerified: true,
          createdAt: '',
          roles: ['ROLE_ADMIN', 'ROLE_USER'],
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({ roles: ['ROLE_ADMIN'] })).toBe(true);
    });

    it('should return false when user lacks required global role', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'user@example.com',
          emailVerified: true,
          createdAt: '',
          roles: ['ROLE_USER'],
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({ roles: ['ROLE_ADMIN'] })).toBe(false);
    });

    it('should return true when user has any of the required roles', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'user@example.com',
          emailVerified: true,
          createdAt: '',
          roles: ['ROLE_EDITOR'],
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({ roles: ['ROLE_ADMIN', 'ROLE_EDITOR'] })).toBe(true);
    });

    it('should return true when user has required org role', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'user@example.com',
          emailVerified: true,
          createdAt: '',
        },
        organization: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          role: 'ROLE_ADMIN',
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({ orgRoles: ['ROLE_ADMIN'] })).toBe(true);
    });

    it('should return false when user lacks required org role', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'user@example.com',
          emailVerified: true,
          createdAt: '',
        },
        organization: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          role: 'ROLE_MEMBER',
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({ orgRoles: ['ROLE_OWNER', 'ROLE_ADMIN'] })).toBe(false);
    });

    it('should return false when no organization is selected', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'user@example.com',
          emailVerified: true,
          createdAt: '',
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({ orgRoles: ['ROLE_ADMIN'] })).toBe(false);
    });

    it('should check both global and org roles when both specified', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'admin@example.com',
          emailVerified: true,
          createdAt: '',
          roles: ['ROLE_ADMIN'],
        },
        organization: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          role: 'ROLE_OWNER',
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      // Both requirements met
      expect(result.current.can({ roles: ['ROLE_ADMIN'], orgRoles: ['ROLE_OWNER'] })).toBe(true);
      // Global role met, org role not met
      expect(result.current.can({ roles: ['ROLE_ADMIN'], orgRoles: ['ROLE_MEMBER'] })).toBe(false);
    });

    it('should return true when no roles specified', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: {
          id: '1',
          email: 'user@example.com',
          emailVerified: true,
          createdAt: '',
        },
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.can({})).toBe(true);
    });
  });

  describe('returned values', () => {
    it('should return user and organization', () => {
      const user = {
        id: '1',
        email: 'user@example.com',
        emailVerified: true,
        createdAt: '',
        roles: ['ROLE_USER'],
      };
      const org = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        role: 'ROLE_ADMIN' as const,
      };
      const mockClient = createMockClient({
        status: 'authenticated',
        user,
        organization: org,
      });
      const { result } = renderHook(() => usePermissions(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.user).toEqual(user);
      expect(result.current.organization).toEqual(org);
    });
  });
});
