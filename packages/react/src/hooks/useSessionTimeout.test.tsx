import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SocleProvider } from '../provider';
import { useSessionTimeout } from './useSessionTimeout';
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
    refreshSession: vi.fn().mockResolvedValue(undefined),
  } as unknown as SocleClient;
}

function createWrapper(client: SocleClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(SocleProvider, { client }, children);
  };
}

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('when unauthenticated', () => {
    it('should return null timeRemaining', () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });
      const { result } = renderHook(() => useSessionTimeout(), {
        wrapper: createWrapper(mockClient),
      });

      expect(result.current.timeRemaining).toBeNull();
      expect(result.current.isWarning).toBe(false);
      expect(result.current.isExpired).toBe(false);
    });
  });

  describe('when authenticated', () => {
    it('should track time remaining', async () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      const { result } = renderHook(
        () => useSessionTimeout({ sessionDuration: 3600, checkInterval: 1 }),
        { wrapper: createWrapper(mockClient) }
      );

      // Initial time remaining should be around sessionDuration
      expect(result.current.timeRemaining).toBeGreaterThan(3590);
      expect(result.current.timeRemaining).toBeLessThanOrEqual(3600);
    });

    it('should trigger warning when threshold reached', async () => {
      const onWarning = vi.fn();
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      const { result } = renderHook(
        () =>
          useSessionTimeout({
            sessionDuration: 100, // 100 seconds
            warnBefore: 50, // warn at 50 seconds
            checkInterval: 1,
            onWarning,
          }),
        { wrapper: createWrapper(mockClient) }
      );

      // Initially not warning
      expect(result.current.isWarning).toBe(false);

      // Fast forward past warning threshold (50+ seconds)
      await act(async () => {
        vi.advanceTimersByTime(51 * 1000);
      });

      expect(result.current.isWarning).toBe(true);
      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('should trigger timeout when session expires', async () => {
      const onTimeout = vi.fn();
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      const { result } = renderHook(
        () =>
          useSessionTimeout({
            sessionDuration: 10, // 10 seconds
            warnBefore: 5,
            checkInterval: 1,
            onTimeout,
          }),
        { wrapper: createWrapper(mockClient) }
      );

      expect(result.current.isExpired).toBe(false);

      // Fast forward past expiry
      await act(async () => {
        vi.advanceTimersByTime(11 * 1000);
      });

      expect(result.current.isExpired).toBe(true);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('should only fire warning callback once', async () => {
      const onWarning = vi.fn();
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      renderHook(
        () =>
          useSessionTimeout({
            sessionDuration: 100,
            warnBefore: 50,
            checkInterval: 1,
            onWarning,
          }),
        { wrapper: createWrapper(mockClient) }
      );

      // Fast forward through multiple check intervals
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000);
      });

      // Should only be called once despite multiple checks
      expect(onWarning).toHaveBeenCalledTimes(1);
    });
  });

  describe('extend()', () => {
    it('should reset warning state after extending', async () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      const { result } = renderHook(
        () =>
          useSessionTimeout({
            sessionDuration: 100,
            warnBefore: 50,
            checkInterval: 1,
          }),
        { wrapper: createWrapper(mockClient) }
      );

      // Trigger warning
      await act(async () => {
        vi.advanceTimersByTime(51 * 1000);
      });

      expect(result.current.isWarning).toBe(true);

      // Extend session
      await act(async () => {
        await result.current.extend();
      });

      expect(result.current.isWarning).toBe(false);
      expect(result.current.isExpired).toBe(false);
    });

    it('should call refreshSession on extend', async () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      const { result } = renderHook(
        () => useSessionTimeout({ sessionDuration: 100, checkInterval: 1 }),
        { wrapper: createWrapper(mockClient) }
      );

      await act(async () => {
        await result.current.extend();
      });

      expect(mockClient.refreshSession).toHaveBeenCalled();
    });

    it('should return false when not authenticated', async () => {
      const mockClient = createMockClient({ status: 'unauthenticated' });

      const { result } = renderHook(() => useSessionTimeout(), {
        wrapper: createWrapper(mockClient),
      });

      let extendResult: boolean;
      await act(async () => {
        extendResult = await result.current.extend();
      });

      expect(extendResult!).toBe(false);
    });

    it('should set isExtending during extend', async () => {
      // Use real timers for this test since it's testing async state, not timer behavior
      vi.useRealTimers();

      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      // Make refreshSession slow
      let resolveRefresh: () => void;
      (mockClient.refreshSession as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveRefresh = resolve;
          })
      );

      const { result } = renderHook(
        () => useSessionTimeout({ sessionDuration: 100, checkInterval: 60 }),
        { wrapper: createWrapper(mockClient) }
      );

      // Start extend
      let extendPromise: Promise<boolean>;
      act(() => {
        extendPromise = result.current.extend();
      });

      await waitFor(() => {
        expect(result.current.isExtending).toBe(true);
      });

      // Resolve
      await act(async () => {
        resolveRefresh!();
        await extendPromise;
      });

      expect(result.current.isExtending).toBe(false);

      // Restore fake timers for other tests
      vi.useFakeTimers();
    });

    it('should return false if refreshSession throws', async () => {
      const mockClient = createMockClient({
        status: 'authenticated',
        user: { id: '1', email: 'user@example.com', emailVerified: true, createdAt: '' },
      });

      (mockClient.refreshSession as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Refresh failed')
      );

      const { result } = renderHook(
        () => useSessionTimeout({ sessionDuration: 100, checkInterval: 1 }),
        { wrapper: createWrapper(mockClient) }
      );

      let extendResult: boolean;
      await act(async () => {
        extendResult = await result.current.extend();
      });

      expect(extendResult!).toBe(false);
    });
  });
});
