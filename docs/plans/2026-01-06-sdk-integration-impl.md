# SDK Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create embeddable SDK packages (`@soclestack/core` and `@soclestack/react`) that allow developers to integrate SocleStack auth into their own applications.

**Architecture:** Monorepo with two packages - a headless core SDK handling auth state/tokens/API, and a React SDK with pre-built components. Core is framework-agnostic; React SDK is a thin wrapper.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, tsup (bundling), Vitest, React 18+

**Design Document:** `docs/plans/2026-01-06-sdk-integration-design.md`

---

## Phase 1: Monorepo Setup

### Task 1.1: Initialize pnpm Workspace

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/react/package.json`
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root)

**Step 1: Create workspace configuration**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

**Step 2: Create core package scaffold**

Create `packages/core/package.json`:

```json
{
  "name": "@soclestack/core",
  "version": "0.1.0",
  "description": "Headless SDK for SocleStack authentication",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  },
  "peerDependencies": {},
  "keywords": ["auth", "sdk", "soclestack"],
  "license": "MIT"
}
```

**Step 3: Create react package scaffold**

Create `packages/react/package.json`:

```json
{
  "name": "@soclestack/react",
  "version": "0.1.0",
  "description": "React components for SocleStack authentication",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@soclestack/core": "workspace:*"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@types/react": "^18.0.0",
    "react": "^18.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "keywords": ["auth", "sdk", "soclestack", "react"],
  "license": "MIT"
}
```

**Step 4: Update root package.json**

Add to root `package.json` scripts:

```json
{
  "scripts": {
    "sdk:build": "pnpm --filter '@soclestack/*' build",
    "sdk:test": "pnpm --filter '@soclestack/*' test",
    "sdk:dev": "pnpm --filter '@soclestack/*' dev"
  }
}
```

**Step 5: Install dependencies**

Run: `pnpm install`

**Step 6: Commit**

```bash
git add pnpm-workspace.yaml packages/ package.json
git commit -m "feat(sdk): initialize monorepo with core and react packages"
```

---

### Task 1.2: Configure TypeScript for Packages

**Files:**
- Create: `packages/core/tsconfig.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/react/tsup.config.ts`

**Step 1: Create core tsconfig**

Create `packages/core/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 2: Create react tsconfig**

Create `packages/react/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

**Step 3: Create core tsup config**

Create `packages/core/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  external: [],
});
```

**Step 4: Create react tsup config**

Create `packages/react/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  external: ['react', 'react-dom', '@soclestack/core'],
});
```

**Step 5: Create placeholder source files**

Create `packages/core/src/index.ts`:

```typescript
export const VERSION = '0.1.0';
```

Create `packages/react/src/index.ts`:

```typescript
export { VERSION } from '@soclestack/core';
```

**Step 6: Test build**

Run: `pnpm sdk:build`
Expected: Both packages build successfully

**Step 7: Commit**

```bash
git add packages/
git commit -m "feat(sdk): add TypeScript and tsup configuration"
```

---

## Phase 2: Core SDK - Auth State Machine

### Task 2.1: Define Types and Interfaces

**Files:**
- Create: `packages/core/src/types.ts`
- Test: `packages/core/src/types.test.ts`

**Step 1: Write type definitions**

Create `packages/core/src/types.ts`:

```typescript
/**
 * User object returned from SocleStack API
 */
export interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  createdAt: string;
}

/**
 * Organization object
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
}

/**
 * Authentication state machine states
 */
export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; organization?: Organization }
  | { status: 'error'; error: Error };

/**
 * Login result from API
 */
export type LoginResult =
  | { success: true; user: User }
  | { success: false; error: string }
  | { success: false; requires2FA: true; tempToken: string };

/**
 * Register data for new user
 */
export interface RegisterData {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Register result from API
 */
export type RegisterResult =
  | { success: true; user: User }
  | { success: false; error: string };

/**
 * Token storage interface for custom implementations
 */
export interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string | null): void;
  clear(): void;
}

/**
 * Client configuration options
 */
export interface SocleClientOptions {
  /** Base URL of your SocleStack instance */
  baseUrl: string;
  /** Redirect URI for OAuth-style flows */
  redirectUri?: string;
  /** Custom token storage implementation */
  tokenStorage?: TokenStorage;
  /** Include credentials for cross-origin requests */
  credentials?: 'include' | 'same-origin' | 'omit';
}

/**
 * Event types emitted by the client
 */
export type SocleEvent =
  | { type: 'stateChange'; state: AuthState }
  | { type: 'tokenRefresh' }
  | { type: 'logout' }
  | { type: 'error'; error: Error };

/**
 * Unsubscribe function returned by subscribe
 */
export type Unsubscribe = () => void;
```

**Step 2: Export from index**

Update `packages/core/src/index.ts`:

```typescript
export * from './types';
```

**Step 3: Verify types compile**

Run: `cd packages/core && pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/core/src/
git commit -m "feat(sdk): add core type definitions"
```

---

### Task 2.2: Implement Token Storage

**Files:**
- Create: `packages/core/src/storage.ts`
- Create: `packages/core/src/storage.test.ts`

**Step 1: Write failing tests**

Create `packages/core/src/storage.test.ts`:

```typescript
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
      setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
      removeItem: (key: string) => { delete mockLocalStorage[key]; },
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
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test`
Expected: FAIL - modules not found

**Step 3: Implement storage**

Create `packages/core/src/storage.ts`:

```typescript
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
```

**Step 4: Run tests**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

**Step 5: Export from index**

Update `packages/core/src/index.ts`:

```typescript
export * from './types';
export * from './storage';
```

**Step 6: Commit**

```bash
git add packages/core/src/
git commit -m "feat(sdk): implement token storage adapters"
```

---

### Task 2.3: Implement API Client

**Files:**
- Create: `packages/core/src/api.ts`
- Create: `packages/core/src/api.test.ts`

**Step 1: Write failing tests**

Create `packages/core/src/api.test.ts`:

```typescript
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
        json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      const result = await client.login('test@example.com', 'password123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
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
        json: () => Promise.resolve({ requires2FA: true, tempToken: 'temp-123' }),
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
      fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

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
        json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      const user = await client.getMe();

      expect(user).toEqual({ id: '1', email: 'test@example.com' });
    });

    it('should return null when not authenticated', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

      const user = await client.getMe();

      expect(user).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test`
Expected: FAIL - ApiClient not found

**Step 3: Implement API client**

Create `packages/core/src/api.ts`:

```typescript
import type {
  User,
  Organization,
  LoginResult,
  RegisterData,
  RegisterResult,
  SocleClientOptions,
} from './types';

export class ApiClient {
  private baseUrl: string;
  private credentials: RequestCredentials;
  private accessToken: string | null = null;

  constructor(options: SocleClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.credentials = options.credentials ?? 'same-origin';
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: this.credentials,
    });

    let data: T;
    try {
      data = await response.json();
    } catch {
      data = {} as T;
    }

    return { ok: response.ok, status: response.status, data };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const { ok, status, data } = await this.request<{
      user?: User;
      error?: string;
      requires2FA?: boolean;
      tempToken?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (ok && data.user) {
      return { success: true, user: data.user };
    }

    if (status === 403 && data.requires2FA && data.tempToken) {
      return { success: false, requires2FA: true, tempToken: data.tempToken };
    }

    return { success: false, error: data.error ?? 'Login failed' };
  }

  async register(registerData: RegisterData): Promise<RegisterResult> {
    const { ok, data } = await this.request<{ user?: User; error?: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(registerData),
      }
    );

    if (ok && data.user) {
      return { success: true, user: data.user };
    }

    return { success: false, error: data.error ?? 'Registration failed' };
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
  }

  async getMe(): Promise<User | null> {
    const { ok, data } = await this.request<{ user?: User }>('/api/auth/me');

    if (ok && data.user) {
      return data.user;
    }

    return null;
  }

  async verify2FA(code: string, tempToken: string): Promise<LoginResult> {
    const { ok, data } = await this.request<{ user?: User; error?: string }>(
      '/api/auth/2fa/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code, tempToken }),
      }
    );

    if (ok && data.user) {
      return { success: true, user: data.user };
    }

    return { success: false, error: data.error ?? '2FA verification failed' };
  }

  async refreshSession(): Promise<User | null> {
    const { ok, data } = await this.request<{ user?: User }>('/api/auth/refresh', {
      method: 'POST',
    });

    if (ok && data.user) {
      return data.user;
    }

    return null;
  }

  async getOrganizations(): Promise<Organization[]> {
    const { ok, data } = await this.request<{ organizations?: Organization[] }>(
      '/api/organizations'
    );

    return ok && data.organizations ? data.organizations : [];
  }

  async getCurrentOrganization(): Promise<Organization | null> {
    const { ok, data } = await this.request<{ organization?: Organization }>(
      '/api/organizations/current'
    );

    return ok && data.organization ? data.organization : null;
  }
}
```

**Step 4: Run tests**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

**Step 5: Export from index**

Update `packages/core/src/index.ts`:

```typescript
export * from './types';
export * from './storage';
export * from './api';
```

**Step 6: Commit**

```bash
git add packages/core/src/
git commit -m "feat(sdk): implement API client"
```

---

### Task 2.4: Implement SocleClient Main Class

**Files:**
- Create: `packages/core/src/client.ts`
- Create: `packages/core/src/client.test.ts`

**Step 1: Write failing tests**

Create `packages/core/src/client.test.ts`:

```typescript
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
        json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
      });

      await client.login('test@example.com', 'password');

      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = client.subscribe(listener);

      unsubscribe();

      // Listener should not be called after unsubscribe
      client['setState']({ status: 'unauthenticated' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should update state to authenticated on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
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
        json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
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
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
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
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/core && pnpm test`
Expected: FAIL - SocleClient not found

**Step 3: Implement SocleClient**

Create `packages/core/src/client.ts`:

```typescript
import type {
  AuthState,
  User,
  Organization,
  LoginResult,
  RegisterData,
  RegisterResult,
  SocleClientOptions,
  TokenStorage,
  Unsubscribe,
} from './types';
import { ApiClient } from './api';
import { createStorage } from './storage';

export class SocleClient {
  private api: ApiClient;
  private storage: TokenStorage;
  private state: AuthState = { status: 'loading' };
  private listeners: Set<(state: AuthState) => void> = new Set();
  private currentOrganization: Organization | null = null;

  constructor(options: SocleClientOptions) {
    this.api = new ApiClient(options);
    this.storage = options.tokenStorage ?? createStorage();

    // Restore token from storage
    const storedToken = this.storage.getAccessToken();
    if (storedToken) {
      this.api.setAccessToken(storedToken);
    }
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AuthState) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: AuthState): void {
    this.state = newState;
    this.listeners.forEach((listener) => listener(newState));
  }

  /**
   * Initialize client - check for existing session
   */
  async initialize(): Promise<void> {
    try {
      const user = await this.api.getMe();
      if (user) {
        const org = await this.api.getCurrentOrganization();
        this.currentOrganization = org;
        this.setState({
          status: 'authenticated',
          user,
          organization: org ?? undefined,
        });
      } else {
        this.storage.clear();
        this.setState({ status: 'unauthenticated' });
      }
    } catch (error) {
      this.storage.clear();
      this.setState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Initialization failed'),
      });
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const result = await this.api.login(email, password);

    if (result.success) {
      this.setState({
        status: 'authenticated',
        user: result.user,
        organization: this.currentOrganization ?? undefined,
      });
    } else {
      this.setState({ status: 'unauthenticated' });
    }

    return result;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<RegisterResult> {
    const result = await this.api.register(data);

    if (result.success) {
      this.setState({
        status: 'authenticated',
        user: result.user,
      });
    }

    return result;
  }

  /**
   * Verify 2FA code
   */
  async verify2FA(code: string, tempToken: string): Promise<LoginResult> {
    const result = await this.api.verify2FA(code, tempToken);

    if (result.success) {
      this.setState({
        status: 'authenticated',
        user: result.user,
        organization: this.currentOrganization ?? undefined,
      });
    }

    return result;
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.api.logout();
    this.storage.clear();
    this.api.setAccessToken(null);
    this.currentOrganization = null;
    this.setState({ status: 'unauthenticated' });
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<void> {
    const user = await this.api.refreshSession();
    if (user) {
      this.setState({
        status: 'authenticated',
        user,
        organization: this.currentOrganization ?? undefined,
      });
    } else {
      this.storage.clear();
      this.setState({ status: 'unauthenticated' });
    }
  }

  /**
   * Get current organization
   */
  getCurrentOrganization(): Organization | null {
    return this.currentOrganization;
  }

  /**
   * Switch to different organization
   */
  async switchOrganization(orgId: string): Promise<void> {
    // Implementation depends on backend API
    const orgs = await this.api.getOrganizations();
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      this.currentOrganization = org;
      if (this.state.status === 'authenticated') {
        this.setState({
          ...this.state,
          organization: org,
        });
      }
    }
  }

  /**
   * Access to raw API client for custom calls
   */
  get rawApi(): ApiClient {
    return this.api;
  }
}
```

**Step 4: Run tests**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

**Step 5: Update index exports**

Update `packages/core/src/index.ts`:

```typescript
export * from './types';
export * from './storage';
export * from './api';
export * from './client';
```

**Step 6: Build and verify**

Run: `cd packages/core && pnpm build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add packages/core/src/
git commit -m "feat(sdk): implement SocleClient main class"
```

---

## Phase 3: React SDK

### Task 3.1: Implement React Provider and Hooks

**Files:**
- Create: `packages/react/src/provider.tsx`
- Create: `packages/react/src/hooks.ts`
- Create: `packages/react/src/hooks.test.tsx`

**Step 1: Write failing tests**

Create `packages/react/src/hooks.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SocleProvider, useAuth, useUser, useOrganization } from './index';
import { SocleClient } from '@soclestack/core';
import type { ReactNode } from 'react';

// Mock the core client
vi.mock('@soclestack/core', () => ({
  SocleClient: vi.fn().mockImplementation(() => ({
    getState: vi.fn().mockReturnValue({ status: 'unauthenticated' }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  })),
}));

describe('React Hooks', () => {
  let mockClient: SocleClient;

  beforeEach(() => {
    mockClient = new SocleClient({ baseUrl: 'https://api.example.com' });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SocleProvider client={mockClient}>{children}</SocleProvider>
  );

  describe('useAuth', () => {
    it('should return auth state and methods', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.state).toBeDefined();
      expect(result.current.login).toBeInstanceOf(Function);
      expect(result.current.logout).toBeInstanceOf(Function);
      expect(result.current.register).toBeInstanceOf(Function);
    });
  });

  describe('useUser', () => {
    it('should return null when unauthenticated', () => {
      const { result } = renderHook(() => useUser(), { wrapper });
      expect(result.current).toBeNull();
    });
  });

  describe('useOrganization', () => {
    it('should return null when no org selected', () => {
      const { result } = renderHook(() => useOrganization(), { wrapper });
      expect(result.current).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/react && pnpm test`
Expected: FAIL - modules not found

**Step 3: Implement provider**

Create `packages/react/src/provider.tsx`:

```typescript
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  SocleClient,
  AuthState,
  User,
  Organization,
  LoginResult,
  RegisterData,
  RegisterResult,
} from '@soclestack/core';

interface SocleContextValue {
  client: SocleClient;
  state: AuthState;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<RegisterResult>;
  verify2FA: (code: string, tempToken: string) => Promise<LoginResult>;
}

const SocleContext = createContext<SocleContextValue | null>(null);

export interface SocleProviderProps {
  client: SocleClient;
  children: ReactNode;
}

export function SocleProvider({ client, children }: SocleProviderProps) {
  const [state, setState] = useState<AuthState>(client.getState());

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = client.subscribe(setState);

    // Initialize client (check existing session)
    client.initialize();

    return unsubscribe;
  }, [client]);

  const login = useCallback(
    (email: string, password: string) => client.login(email, password),
    [client]
  );

  const logout = useCallback(() => client.logout(), [client]);

  const register = useCallback(
    (data: RegisterData) => client.register(data),
    [client]
  );

  const verify2FA = useCallback(
    (code: string, tempToken: string) => client.verify2FA(code, tempToken),
    [client]
  );

  const value: SocleContextValue = {
    client,
    state,
    login,
    logout,
    register,
    verify2FA,
  };

  return (
    <SocleContext.Provider value={value}>{children}</SocleContext.Provider>
  );
}

export function useSocleContext(): SocleContextValue {
  const context = useContext(SocleContext);
  if (!context) {
    throw new Error('useSocleContext must be used within a SocleProvider');
  }
  return context;
}
```

**Step 4: Implement hooks**

Create `packages/react/src/hooks.ts`:

```typescript
import { useSocleContext } from './provider';
import type { AuthState, User, Organization } from '@soclestack/core';

/**
 * Main auth hook - provides state and auth methods
 */
export function useAuth() {
  const { state, login, logout, register, verify2FA } = useSocleContext();

  return {
    state,
    isLoading: state.status === 'loading',
    isAuthenticated: state.status === 'authenticated',
    login,
    logout,
    register,
    verify2FA,
  };
}

/**
 * Get current user (null if not authenticated)
 */
export function useUser(): User | null {
  const { state } = useSocleContext();
  return state.status === 'authenticated' ? state.user : null;
}

/**
 * Get current organization (null if none selected)
 */
export function useOrganization(): Organization | null {
  const { state } = useSocleContext();
  return state.status === 'authenticated' ? state.organization ?? null : null;
}

/**
 * Check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { state } = useSocleContext();
  return state.status === 'authenticated';
}
```

**Step 5: Update index exports**

Update `packages/react/src/index.ts`:

```typescript
// Re-export core types
export type {
  User,
  Organization,
  AuthState,
  LoginResult,
  RegisterData,
  RegisterResult,
} from '@soclestack/core';

// Provider
export { SocleProvider, useSocleContext } from './provider';
export type { SocleProviderProps } from './provider';

// Hooks
export { useAuth, useUser, useOrganization, useIsAuthenticated } from './hooks';
```

**Step 6: Run tests**

Run: `cd packages/react && pnpm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/react/src/
git commit -m "feat(sdk): implement React provider and hooks"
```

---

### Task 3.2: Implement LoginForm Component

**Files:**
- Create: `packages/react/src/components/LoginForm.tsx`
- Create: `packages/react/src/components/LoginForm.test.tsx`

**Step 1: Write failing tests**

Create `packages/react/src/components/LoginForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from './LoginForm';
import { SocleProvider } from '../provider';
import { SocleClient } from '@soclestack/core';

describe('LoginForm', () => {
  const mockClient = {
    getState: vi.fn().mockReturnValue({ status: 'unauthenticated' }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
  } as unknown as SocleClient;

  const renderForm = (props = {}) => {
    return render(
      <SocleProvider client={mockClient}>
        <LoginForm {...props} />
      </SocleProvider>
    );
  };

  it('should render email and password fields', () => {
    renderForm();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should call login on form submit', async () => {
    mockClient.login = vi.fn().mockResolvedValue({ success: true, user: {} });

    renderForm();

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
    const onSuccess = vi.fn();
    mockClient.login = vi.fn().mockResolvedValue({
      success: true,
      user: { id: '1', email: 'test@example.com' },
    });

    renderForm({ onSuccess });

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
    mockClient.login = vi.fn().mockResolvedValue({
      success: false,
      error: 'Invalid credentials',
    });

    renderForm();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/react && pnpm test`
Expected: FAIL - LoginForm not found

**Step 3: Implement LoginForm**

Create `packages/react/src/components/LoginForm.tsx`:

```typescript
import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks';
import type { User, LoginResult } from '@soclestack/core';

export interface LoginFormProps {
  /** Called on successful login */
  onSuccess?: (user: User) => void;
  /** Called on login error */
  onError?: (error: string) => void;
  /** Called when 2FA is required */
  onRequires2FA?: (tempToken: string) => void;
  /** Custom class name */
  className?: string;
  /** Labels customization */
  labels?: {
    email?: string;
    password?: string;
    submit?: string;
  };
}

export function LoginForm({
  onSuccess,
  onError,
  onRequires2FA,
  className,
  labels,
}: LoginFormProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result: LoginResult = await login(email, password);

      if (result.success) {
        onSuccess?.(result.user);
      } else if ('requires2FA' in result && result.requires2FA) {
        onRequires2FA?.(result.tempToken);
      } else {
        const errorMessage = result.error;
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      data-socle="login-form"
    >
      <div data-socle="field">
        <label htmlFor="socle-email" data-socle="label">
          {labels?.email ?? 'Email'}
        </label>
        <input
          id="socle-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          data-socle="input"
        />
      </div>

      <div data-socle="field">
        <label htmlFor="socle-password" data-socle="label">
          {labels?.password ?? 'Password'}
        </label>
        <input
          id="socle-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          data-socle="input"
        />
      </div>

      {error && (
        <div data-socle="error" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        data-socle="submit"
      >
        {isLoading ? 'Signing in...' : labels?.submit ?? 'Sign in'}
      </button>
    </form>
  );
}
```

**Step 4: Add to exports**

Create `packages/react/src/components/index.ts`:

```typescript
export { LoginForm } from './LoginForm';
export type { LoginFormProps } from './LoginForm';
```

Update `packages/react/src/index.ts`:

```typescript
// Re-export core types
export type {
  User,
  Organization,
  AuthState,
  LoginResult,
  RegisterData,
  RegisterResult,
} from '@soclestack/core';

// Provider
export { SocleProvider, useSocleContext } from './provider';
export type { SocleProviderProps } from './provider';

// Hooks
export { useAuth, useUser, useOrganization, useIsAuthenticated } from './hooks';

// Components
export * from './components';
```

**Step 5: Add test setup**

Create `packages/react/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

Create `packages/react/src/test-setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

Update `packages/react/package.json` devDependencies:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^14.0.0",
    "@types/react": "^18.0.0",
    "jsdom": "^24.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 6: Run tests**

Run: `cd packages/react && pnpm install && pnpm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add packages/react/
git commit -m "feat(sdk): implement LoginForm component"
```

---

### Task 3.3: Implement AuthGuard Component

**Files:**
- Create: `packages/react/src/components/AuthGuard.tsx`
- Create: `packages/react/src/components/AuthGuard.test.tsx`

**Step 1: Write failing tests**

Create `packages/react/src/components/AuthGuard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from './AuthGuard';
import { SocleProvider } from '../provider';
import { SocleClient } from '@soclestack/core';

describe('AuthGuard', () => {
  const createMockClient = (status: string, user?: object) => ({
    getState: vi.fn().mockReturnValue({
      status,
      user,
    }),
    subscribe: vi.fn().mockReturnValue(() => {}),
    initialize: vi.fn().mockResolvedValue(undefined),
  } as unknown as SocleClient);

  it('should render children when authenticated', () => {
    const mockClient = createMockClient('authenticated', { id: '1' });

    render(
      <SocleProvider client={mockClient}>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </SocleProvider>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render fallback when unauthenticated', () => {
    const mockClient = createMockClient('unauthenticated');

    render(
      <SocleProvider client={mockClient}>
        <AuthGuard fallback={<div>Please log in</div>}>
          <div>Protected Content</div>
        </AuthGuard>
      </SocleProvider>
    );

    expect(screen.getByText('Please log in')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render loading state while checking auth', () => {
    const mockClient = createMockClient('loading');

    render(
      <SocleProvider client={mockClient}>
        <AuthGuard loadingFallback={<div>Loading...</div>}>
          <div>Protected Content</div>
        </AuthGuard>
      </SocleProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should call onUnauthenticated callback', () => {
    const mockClient = createMockClient('unauthenticated');
    const onUnauthenticated = vi.fn();

    render(
      <SocleProvider client={mockClient}>
        <AuthGuard onUnauthenticated={onUnauthenticated}>
          <div>Protected Content</div>
        </AuthGuard>
      </SocleProvider>
    );

    expect(onUnauthenticated).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/react && pnpm test`
Expected: FAIL - AuthGuard not found

**Step 3: Implement AuthGuard**

Create `packages/react/src/components/AuthGuard.tsx`:

```typescript
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../hooks';

export interface AuthGuardProps {
  /** Content to show when authenticated */
  children: ReactNode;
  /** Content to show when not authenticated */
  fallback?: ReactNode;
  /** Content to show while checking auth status */
  loadingFallback?: ReactNode;
  /** Called when user is not authenticated (for redirects) */
  onUnauthenticated?: () => void;
}

export function AuthGuard({
  children,
  fallback = null,
  loadingFallback = null,
  onUnauthenticated,
}: AuthGuardProps) {
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'unauthenticated' && onUnauthenticated) {
      onUnauthenticated();
    }
  }, [state.status, onUnauthenticated]);

  if (state.status === 'loading') {
    return <>{loadingFallback}</>;
  }

  if (state.status !== 'authenticated') {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

**Step 4: Add to exports**

Update `packages/react/src/components/index.ts`:

```typescript
export { LoginForm } from './LoginForm';
export type { LoginFormProps } from './LoginForm';

export { AuthGuard } from './AuthGuard';
export type { AuthGuardProps } from './AuthGuard';
```

**Step 5: Run tests**

Run: `cd packages/react && pnpm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/react/src/
git commit -m "feat(sdk): implement AuthGuard component"
```

---

## Phase 4: Backend Changes

### Task 4.1: Add CORS Configuration for SDK

**Files:**
- Modify: `src/middleware.ts`
- Create: `src/lib/cors.ts`

**Step 1: Create CORS utility**

Create `src/lib/cors.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

/**
 * Allowed origins for SDK cross-origin requests.
 * Configure via CORS_ORIGINS environment variable (comma-separated).
 */
export function getAllowedOrigins(): string[] {
  const origins = process.env.CORS_ORIGINS;
  if (!origins) {
    return [];
  }
  return origins.split(',').map((o) => o.trim());
}

/**
 * Check if origin is allowed for CORS
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.length === 0) return false;

  // Check for wildcard
  if (allowedOrigins.includes('*')) return true;

  return allowedOrigins.includes(origin);
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(
  response: NextResponse,
  origin: string
): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-CSRF-Token'
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(origin: string): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response, origin);
}
```

**Step 2: Update middleware to handle CORS**

Add to `src/middleware.ts` (at the start of the middleware function):

```typescript
import { isOriginAllowed, addCorsHeaders, handleCorsPreflightRequest } from '@/lib/cors';

// Inside middleware function, before other checks:
const origin = request.headers.get('origin');

// Handle CORS preflight
if (request.method === 'OPTIONS' && origin && isOriginAllowed(origin)) {
  return handleCorsPreflightRequest(origin);
}

// For actual requests, we'll add CORS headers at the end
// (store origin for later use in response)
```

**Step 3: Add environment variable documentation**

Update `.env.example`:

```bash
# SDK CORS Configuration
# Comma-separated list of allowed origins for SDK cross-origin requests
# Use '*' to allow all origins (not recommended for production)
# Example: CORS_ORIGINS=https://myapp.com,https://staging.myapp.com
CORS_ORIGINS=
```

**Step 4: Commit**

```bash
git add src/lib/cors.ts src/middleware.ts .env.example
git commit -m "feat(sdk): add CORS configuration for SDK cross-origin requests"
```

---

## Phase 5: Documentation

### Task 5.1: Create SDK Documentation

**Files:**
- Create: `packages/core/README.md`
- Create: `packages/react/README.md`

**Step 1: Create core README**

Create `packages/core/README.md`:

```markdown
# @soclestack/core

Headless SDK for SocleStack authentication. Framework-agnostic, works in any JavaScript environment.

## Installation

```bash
npm install @soclestack/core
```

## Quick Start

```typescript
import { SocleClient } from '@soclestack/core';

const client = new SocleClient({
  baseUrl: 'https://your-soclestack-instance.com',
});

// Initialize (checks for existing session)
await client.initialize();

// Subscribe to auth state changes
client.subscribe((state) => {
  console.log('Auth state:', state.status);
});

// Login
const result = await client.login('user@example.com', 'password');
if (result.success) {
  console.log('Logged in as', result.user.email);
}

// Logout
await client.logout();
```

## API Reference

### SocleClient

#### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `baseUrl` | `string` | URL of your SocleStack instance |
| `credentials` | `'include' \| 'same-origin' \| 'omit'` | Fetch credentials mode |
| `tokenStorage` | `TokenStorage` | Custom token storage adapter |

#### Methods

- `initialize()` - Check for existing session
- `login(email, password)` - Login with credentials
- `register(data)` - Register new user
- `logout()` - End current session
- `verify2FA(code, tempToken)` - Complete 2FA verification
- `getState()` - Get current auth state
- `subscribe(listener)` - Subscribe to state changes

### Auth State

```typescript
type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; organization?: Organization }
  | { status: 'error'; error: Error };
```

## License

MIT
```

**Step 2: Create react README**

Create `packages/react/README.md`:

```markdown
# @soclestack/react

React components and hooks for SocleStack authentication.

## Installation

```bash
npm install @soclestack/react @soclestack/core
```

## Quick Start

```tsx
import { SocleClient } from '@soclestack/core';
import { SocleProvider, useAuth, LoginForm, AuthGuard } from '@soclestack/react';

const client = new SocleClient({
  baseUrl: 'https://your-soclestack-instance.com',
});

function App() {
  return (
    <SocleProvider client={client}>
      <AuthGuard fallback={<LoginPage />}>
        <Dashboard />
      </AuthGuard>
    </SocleProvider>
  );
}

function LoginPage() {
  return (
    <LoginForm
      onSuccess={(user) => console.log('Welcome', user.email)}
      onError={(error) => console.error(error)}
    />
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Hooks

### useAuth()

```tsx
const { state, isLoading, isAuthenticated, login, logout, register } = useAuth();
```

### useUser()

```tsx
const user = useUser(); // User | null
```

### useOrganization()

```tsx
const org = useOrganization(); // Organization | null
```

## Components

### LoginForm

```tsx
<LoginForm
  onSuccess={(user) => {}}
  onError={(error) => {}}
  onRequires2FA={(tempToken) => {}}
  className="my-form"
/>
```

### AuthGuard

```tsx
<AuthGuard
  fallback={<LoginPage />}
  loadingFallback={<Spinner />}
  onUnauthenticated={() => router.push('/login')}
>
  <ProtectedContent />
</AuthGuard>
```

## Styling

Components use `data-socle` attributes for styling:

```css
[data-socle="login-form"] { /* form styles */ }
[data-socle="field"] { /* field wrapper */ }
[data-socle="label"] { /* labels */ }
[data-socle="input"] { /* inputs */ }
[data-socle="error"] { /* error messages */ }
[data-socle="submit"] { /* submit button */ }
```

## License

MIT
```

**Step 3: Commit**

```bash
git add packages/core/README.md packages/react/README.md
git commit -m "docs(sdk): add README documentation for SDK packages"
```

---

## Summary

This plan creates:

1. **Monorepo structure** with pnpm workspaces
2. **@soclestack/core** - Headless SDK (~10KB)
   - Auth state machine
   - Token storage adapters
   - API client
3. **@soclestack/react** - React SDK (~15KB)
   - Provider + Context
   - Hooks (useAuth, useUser, useOrganization)
   - Components (LoginForm, AuthGuard)
4. **Backend CORS support** for cross-origin SDK usage
5. **Documentation** for both packages

Total estimated time: 2-3 weeks for MVP.
