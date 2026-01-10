import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage, LocalStorage, createStorage } from './storage';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('should store and retrieve access token', () => {
    storage.setAccessToken('test-token');
    expect(storage.getAccessToken()).toBe('test-token');
  });

  it('should store and retrieve refresh token', () => {
    storage.setRefreshToken('refresh-token');
    expect(storage.getRefreshToken()).toBe('refresh-token');
  });

  it('should return null for unset tokens', () => {
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('should clear all tokens', () => {
    storage.setAccessToken('access');
    storage.setRefreshToken('refresh');
    storage.clear();
    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
  });
});

describe('LocalStorage', () => {
  let storage: LocalStorage;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockLocalStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value;
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key];
      },
    });
    storage = new LocalStorage('socle');
  });

  it('should store access token in localStorage', () => {
    storage.setAccessToken('test-token');
    expect(mockLocalStorage['socle:accessToken']).toBe('test-token');
  });

  it('should retrieve access token from localStorage', () => {
    mockLocalStorage['socle:accessToken'] = 'stored-token';
    expect(storage.getAccessToken()).toBe('stored-token');
  });

  it('should clear tokens with prefix', () => {
    storage.setAccessToken('access');
    storage.setRefreshToken('refresh');
    storage.clear();
    expect(mockLocalStorage['socle:accessToken']).toBeUndefined();
    expect(mockLocalStorage['socle:refreshToken']).toBeUndefined();
  });
});

describe('createStorage', () => {
  it('should return MemoryStorage when localStorage unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    const storage = createStorage();
    expect(storage).toBeInstanceOf(MemoryStorage);
  });
});
