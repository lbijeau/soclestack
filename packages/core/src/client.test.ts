import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SocleClient } from './client';

describe('SocleClient', () => {
  let client: SocleClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', undefined); // Use memory storage

    client = new SocleClient({
      baseUrl: 'https://api.example.com',
    });
  });

  describe('initial state', () => {
    it('should start in loading state', () => {
      const state = client.getState();
      expect(state.status).toBe('loading');
    });
  });

  describe('subscribe', () => {
    it('should notify subscribers on state change', async () => {
      const listener = vi.fn();
      client.subscribe(listener);

      // Simulate state change by calling login
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      await client.login('test@example.com', 'password');

      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = client.subscribe(listener);

      unsubscribe();

      // Manually trigger state change
      client['setState']({ status: 'unauthenticated' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should update state to authenticated on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      const result = await client.login('test@example.com', 'password');

      expect(result.success).toBe(true);
      const state = client.getState();
      expect(state.status).toBe('authenticated');
      if (state.status === 'authenticated') {
        expect(state.user.email).toBe('test@example.com');
      }
    });

    it('should remain unauthenticated on failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid credentials' }),
      });

      const result = await client.login('test@example.com', 'wrong');

      expect(result.success).toBe(false);
      const state = client.getState();
      expect(state.status).toBe('unauthenticated');
    });
  });

  describe('logout', () => {
    it('should update state to unauthenticated', async () => {
      // First login
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });
      await client.login('test@example.com', 'password');

      // Then logout
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await client.logout();

      const state = client.getState();
      expect(state.status).toBe('unauthenticated');
    });
  });

  describe('initialize', () => {
    it('should check for existing session on init', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ organization: null }),
        });

      await client.initialize();

      const state = client.getState();
      expect(state.status).toBe('authenticated');
    });

    it('should set unauthenticated if no session', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

      await client.initialize();

      const state = client.getState();
      expect(state.status).toBe('unauthenticated');
    });
  });

  describe('register', () => {
    it('should update state to authenticated on success', async () => {
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
      const state = client.getState();
      expect(state.status).toBe('authenticated');
    });
  });

  describe('verify2FA', () => {
    it('should update state to authenticated on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      const result = await client.verify2FA('123456', 'temp-token');

      expect(result.success).toBe(true);
      const state = client.getState();
      expect(state.status).toBe('authenticated');
    });
  });

  describe('rawApi', () => {
    it('should expose the API client', () => {
      expect(client.rawApi).toBeDefined();
    });
  });
});
