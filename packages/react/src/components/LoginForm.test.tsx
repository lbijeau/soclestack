import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LoginForm } from './LoginForm';
import { SocleProvider } from '../provider';
import type { SocleClient } from '@soclestack/core';

function createMockClient() {
  return {
    getState: vi.fn().mockReturnValue({ status: 'unauthenticated' }),
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

describe('LoginForm', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render email and password fields', () => {
    const mockClient = createMockClient();
    render(<LoginForm />, { wrapper: createWrapper(mockClient) });

    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDefined();
  });

  it('should call login on form submit', async () => {
    const mockClient = createMockClient();
    mockClient.login = vi.fn().mockResolvedValue({ success: true, user: {} });

    render(<LoginForm />, { wrapper: createWrapper(mockClient) });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockClient.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should call onSuccess callback on successful login', async () => {
    const mockClient = createMockClient();
    const onSuccess = vi.fn();
    mockClient.login = vi.fn().mockResolvedValue({
      success: true,
      user: { id: '1', email: 'test@example.com' },
    });

    render(<LoginForm onSuccess={onSuccess} />, { wrapper: createWrapper(mockClient) });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith({ id: '1', email: 'test@example.com' });
    });
  });

  it('should display error on failed login', async () => {
    const mockClient = createMockClient();
    mockClient.login = vi.fn().mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    render(<LoginForm />, { wrapper: createWrapper(mockClient) });

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeDefined();
    });
  });
});
