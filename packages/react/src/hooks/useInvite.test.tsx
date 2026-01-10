import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SocleProvider } from '../provider';
import { useInvite } from './useInvite';
import type { SocleClient, AuthState, Invite, InviteResult } from '@soclestack/core';

const mockInvite: Invite = {
  id: 'inv-1',
  organizationId: 'org-1',
  organizationName: 'Test Organization',
  inviterName: 'John Doe',
  inviterEmail: 'john@example.com',
  role: 'ROLE_MEMBER',
  email: 'invitee@example.com',
  expiresAt: '2026-12-31T23:59:59Z',
};

function createMockClient(
  state: AuthState,
  getInviteResult?: InviteResult
): SocleClient {
  const mockRawApi = {
    getInvite: vi.fn().mockResolvedValue(
      getInviteResult ?? { success: true, invite: mockInvite, status: 'valid' }
    ),
    acceptInvite: vi.fn().mockResolvedValue({
      success: true,
      organization: { id: 'org-1', name: 'Test Organization', slug: 'test-org' },
    }),
  };

  return {
    getState: vi.fn().mockReturnValue(state),
    subscribe: vi.fn().mockReturnValue(() => {}),
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    verify2FA: vi.fn(),
    rawApi: mockRawApi,
  } as unknown as SocleClient;
}

function createWrapper(client: SocleClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(SocleProvider, { client }, children);
  };
}

describe('useInvite', () => {
  describe('initial state', () => {
    it('should start in loading state', () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useInvite('valid-token'), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBe('loading');
    });

    it('should set status to invalid when no token provided', async () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useInvite(''), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('invalid');
      });
      expect(result.current.error).toBe('No invite token provided');
    });
  });

  describe('fetching invite', () => {
    it('should fetch and return valid invite', async () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useInvite('valid-token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('valid');
      });

      expect(result.current.invite).toEqual(mockInvite);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle expired invite', async () => {
      const mockClient = createMockClient(
        { status: 'unauthenticated' },
        { success: false, error: 'Invite has expired', status: 'expired' }
      );
      const { result } = renderHook(() => useInvite('expired-token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('expired');
      });

      expect(result.current.invite).toBeNull();
      expect(result.current.error).toBe('Invite has expired');
    });

    it('should handle invalid invite', async () => {
      const mockClient = createMockClient(
        { status: 'unauthenticated' },
        { success: false, error: 'Invalid token', status: 'invalid' }
      );
      const { result } = renderHook(() => useInvite('bad-token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('invalid');
      });

      expect(result.current.error).toBe('Invalid token');
    });

    it('should handle network error', async () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      (mockClient.rawApi as { getInvite: ReturnType<typeof vi.fn> }).getInvite.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useInvite('token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('invalid');
      });

      expect(result.current.error).toBe('Network error');
    });
  });

  describe('authentication state', () => {
    it('should return isAuthenticated false when unauthenticated', async () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useInvite('token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('valid');
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should return isAuthenticated true when authenticated', async () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });
      const { result } = renderHook(() => useInvite('token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('valid');
      });

      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('accept()', () => {
    it('should return null when not authenticated', async () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useInvite('token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('valid');
      });

      const org = await result.current.accept();
      expect(org).toBeNull();
      await waitFor(() => {
        expect(result.current.error).toBe('You must be logged in to accept an invite');
      });
    });

    it('should accept invite when authenticated', async () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });
      const { result } = renderHook(() => useInvite('token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('valid');
      });

      const org = await result.current.accept();
      expect(org).toEqual({ id: 'org-1', name: 'Test Organization', slug: 'test-org' });
    });

    it('should set isAccepting during accept', async () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      // Make acceptInvite slow
      let resolveAccept: (value: unknown) => void;
      (mockClient.rawApi as { acceptInvite: ReturnType<typeof vi.fn> }).acceptInvite.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAccept = resolve;
          })
      );

      const { result } = renderHook(() => useInvite('token'), {
        wrapper: createWrapper(mockClient),
      });

      await waitFor(() => {
        expect(result.current.status).toBe('valid');
      });

      // Start accept
      const acceptPromise = result.current.accept();

      await waitFor(() => {
        expect(result.current.isAccepting).toBe(true);
      });

      // Resolve
      resolveAccept!({ success: true, organization: { id: 'org-1', name: 'Test', slug: 'test' } });
      await acceptPromise;

      await waitFor(() => {
        expect(result.current.isAccepting).toBe(false);
      });
    });
  });
});
