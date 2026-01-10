import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { SocleProvider } from './provider';
import { useAuth, useUser, useOrganization, useIsAuthenticated } from './hooks';
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

// Helper to create wrapper with proper types for renderHook
function createWrapper(client: SocleClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(SocleProvider, { client }, children);
  };
}

describe('React Hooks', () => {
  describe('useAuth', () => {
    it('should return auth state and methods', () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.state).toBeDefined();
      expect(result.current.login).toBeInstanceOf(Function);
      expect(result.current.logout).toBeInstanceOf(Function);
      expect(result.current.register).toBeInstanceOf(Function);
      expect(result.current.verify2FA).toBeInstanceOf(Function);
    });

    it('should return isLoading true when loading', () => {
      const mockClient = createMockClient({ status: 'loading' });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should return isAuthenticated true when authenticated', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'test@example.com', emailVerified: true, createdAt: '' },
      });
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('useUser', () => {
    it('should return null when unauthenticated', () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(mockClient),
      });
      expect(result.current).toBeNull();
    });

    it('should return user when authenticated', () => {
      const user = { id: '1', email: 'test@example.com', emailVerified: true, createdAt: '' };
      const mockClient = createMockClient({
        status: 'authenticated',
        user,
      });
      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(mockClient),
      });
      expect(result.current).toEqual(user);
    });
  });

  describe('useOrganization', () => {
    it('should return null when no org selected', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'test@example.com', emailVerified: true, createdAt: '' },
      });
      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(mockClient),
      });
      expect(result.current).toBeNull();
    });

    it('should return organization when selected', () => {
      const org = { id: 'org-1', name: 'Test Org', slug: 'test-org' };
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'test@example.com', emailVerified: true, createdAt: '' },
        organization: org,
      });
      const { result } = renderHook(() => useOrganization(), {
        wrapper: createWrapper(mockClient),
      });
      expect(result.current).toEqual(org);
    });
  });

  describe('useIsAuthenticated', () => {
    it('should return false when unauthenticated', () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useIsAuthenticated(), {
        wrapper: createWrapper(mockClient),
      });
      expect(result.current).toBe(false);
    });

    it('should return true when authenticated', () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'test@example.com', emailVerified: true, createdAt: '' },
      });
      const { result } = renderHook(() => useIsAuthenticated(), {
        wrapper: createWrapper(mockClient),
      });
      expect(result.current).toBe(true);
    });
  });
});
