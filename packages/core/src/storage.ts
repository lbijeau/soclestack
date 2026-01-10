import type { TokenStorage } from './types';

/**
 * In-memory token storage (for SSR or when localStorage unavailable)
 */
export class MemoryStorage implements TokenStorage {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken = token;
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

/**
 * localStorage-based token storage
 */
export class LocalStorage implements TokenStorage {
  private prefix: string;

  constructor(prefix: string = 'socle') {
    this.prefix = prefix;
  }

  private key(name: string): string {
    return `${this.prefix}:${name}`;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.key('accessToken'));
  }

  setAccessToken(token: string | null): void {
    if (token === null) {
      localStorage.removeItem(this.key('accessToken'));
    } else {
      localStorage.setItem(this.key('accessToken'), token);
    }
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.key('refreshToken'));
  }

  setRefreshToken(token: string | null): void {
    if (token === null) {
      localStorage.removeItem(this.key('refreshToken'));
    } else {
      localStorage.setItem(this.key('refreshToken'), token);
    }
  }

  clear(): void {
    localStorage.removeItem(this.key('accessToken'));
    localStorage.removeItem(this.key('refreshToken'));
  }
}

/**
 * Create appropriate storage based on environment
 */
export function createStorage(prefix?: string): TokenStorage {
  if (typeof localStorage !== 'undefined') {
    return new LocalStorage(prefix);
  }
  return new MemoryStorage();
}
