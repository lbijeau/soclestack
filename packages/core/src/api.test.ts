import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from './api';

describe('ApiClient', () => {
  let client: ApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    client = new ApiClient({
      baseUrl: 'https://api.example.com',
      credentials: 'include',
    });
  });

  describe('login', () => {
    it('should call login endpoint with credentials', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      const result = await client.login('test@example.com', 'password123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should handle login failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });

      const result = await client.login('test@example.com', 'wrong');

      expect(result.success).toBe(false);
      if (!result.success && !('requires2FA' in result)) {
        expect(result.error).toBe('Invalid credentials');
      }
    });

    it('should handle 2FA required response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({ requires2FA: true, tempToken: 'temp-123' }),
      });

      const result = await client.login('test@example.com', 'password123');

      expect(result.success).toBe(false);
      if (!result.success && 'requires2FA' in result) {
        expect(result.requires2FA).toBe(true);
        expect(result.tempToken).toBe('temp-123');
      }
    });
  });

  describe('logout', () => {
    it('should call logout endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await client.logout();

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/logout',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getMe', () => {
    it('should fetch current user', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      const user = await client.getMe();

      expect(user).toEqual({ id: '1', email: 'test@example.com' });
    });

    it('should return null when not authenticated', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) });

      const user = await client.getMe();

      expect(user).toBeNull();
    });
  });

  describe('register', () => {
    it('should call register endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'new@example.com' } }),
      });

      const result = await client.register({
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.email).toBe('new@example.com');
      }
    });
  });

  describe('verify2FA', () => {
    it('should call 2FA verify endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      const result = await client.verify2FA('123456', 'temp-token');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/2fa/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ code: '123456', tempToken: 'temp-token' }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('setAccessToken', () => {
    it('should include Authorization header when token is set', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: '1' } }),
      });

      client.setAccessToken('my-token');
      await client.getMe();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });
  });
});
