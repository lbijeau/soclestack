import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { AuthGuard } from './AuthGuard';
import { SocleProvider } from '../provider';
import type { SocleClient } from '@soclestack/core';

function createMockClient(status: string, user?: object) {
  return {
    getState: vi.fn().mockReturnValue({
      status,
      user,
    }),
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

describe('AuthGuard', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render children when authenticated', () => {
    const mockClient = createMockClient('authenticated', { id: '1' });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
      { wrapper: createWrapper(mockClient) }
    );

    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('should render fallback when unauthenticated', () => {
    const mockClient = createMockClient('unauthenticated');

    render(
      <AuthGuard fallback={<div>Please log in</div>}>
        <div>Protected Content</div>
      </AuthGuard>,
      { wrapper: createWrapper(mockClient) }
    );

    expect(screen.getByText('Please log in')).toBeDefined();
    expect(screen.queryByText('Protected Content')).toBeNull();
  });

  it('should render loading state while checking auth', () => {
    const mockClient = createMockClient('loading');

    render(
      <AuthGuard loadingFallback={<div>Loading...</div>}>
        <div>Protected Content</div>
      </AuthGuard>,
      { wrapper: createWrapper(mockClient) }
    );

    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('should call onUnauthenticated callback', () => {
    const mockClient = createMockClient('unauthenticated');
    const onUnauthenticated = vi.fn();

    render(
      <AuthGuard onUnauthenticated={onUnauthenticated}>
        <div>Protected Content</div>
      </AuthGuard>,
      { wrapper: createWrapper(mockClient) }
    );

    expect(onUnauthenticated).toHaveBeenCalled();
  });
});
