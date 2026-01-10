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
const unsubscribe = client.subscribe((state) => {
  if (state.status === 'authenticated') {
    console.log('Logged in as', state.user.email);
  }
});

// Login
const result = await client.login('user@example.com', 'password');
if (result.success) {
  console.log('Welcome!', result.user.email);
} else if (result.requires2FA) {
  // Handle 2FA flow
  const twoFAResult = await client.verify2FA(code, result.tempToken);
}

// Logout
await client.logout();

// Cleanup
unsubscribe();
```

## API Reference

### SocleClient

The main client class for interacting with SocleStack.

#### Constructor

```typescript
new SocleClient(options: SocleClientOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | required | URL of your SocleStack instance |
| `credentials` | `RequestCredentials` | `'include'` | Fetch credentials mode |
| `tokenStorage` | `TokenStorage` | `localStorage` | Custom token storage adapter |

#### Methods

##### initialize()

Check for existing session and restore auth state.

```typescript
await client.initialize(): Promise<void>
```

Call this on app startup to restore sessions.

##### login(email, password, options?)

Authenticate with email and password.

```typescript
await client.login(
  email: string,
  password: string,
  options?: { rememberMe?: boolean }
): Promise<LoginResult>
```

Returns:
```typescript
type LoginResult =
  | { success: true; user: User }
  | { success: false; error: string }
  | { success: false; requires2FA: true; tempToken: string };
```

##### register(data)

Register a new user account.

```typescript
await client.register(data: RegisterData): Promise<RegisterResult>
```

```typescript
interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

type RegisterResult =
  | { success: true; user: User }
  | { success: false; error: string };
```

##### logout()

End the current session.

```typescript
await client.logout(): Promise<void>
```

##### verify2FA(code, tempToken)

Complete two-factor authentication.

```typescript
await client.verify2FA(
  code: string,
  tempToken: string
): Promise<LoginResult>
```

##### refreshSession()

Refresh the current session token.

```typescript
await client.refreshSession(): Promise<void>
```

##### getState()

Get the current authentication state.

```typescript
client.getState(): AuthState
```

##### subscribe(listener)

Subscribe to auth state changes. Returns unsubscribe function.

```typescript
const unsubscribe = client.subscribe(
  (state: AuthState) => void
): () => void
```

##### switchOrganization(orgId)

Switch to a different organization.

```typescript
await client.switchOrganization(orgId: string): Promise<void>
```

#### Raw API Access

For advanced use cases, access the raw API client:

```typescript
// Get invite details
const result = await client.rawApi.getInvite(token);

// Accept invite
const acceptResult = await client.rawApi.acceptInvite(token);

// Get user's organizations
const orgs = await client.rawApi.getOrganizations();
```

### Types

#### AuthState

```typescript
type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: User; organization?: Organization }
  | { status: 'error'; error: Error };
```

#### User

```typescript
interface User {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  roles?: string[];
  createdAt: string;
}
```

#### Organization

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;  // User's role in this org
}
```

#### Invite

```typescript
interface Invite {
  id: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: 'ROLE_ADMIN' | 'ROLE_MEMBER';
  email: string;
  expiresAt: string;
}

type InviteStatus =
  | 'loading'
  | 'valid'
  | 'expired'
  | 'invalid'
  | 'already_used'
  | 'already_member';
```

### Custom Storage

Implement `TokenStorage` for custom token persistence:

```typescript
interface TokenStorage {
  getToken(): string | null;
  setToken(token: string): void;
  removeToken(): void;
}

// Example: sessionStorage adapter
const sessionStorageAdapter: TokenStorage = {
  getToken: () => sessionStorage.getItem('socle_token'),
  setToken: (token) => sessionStorage.setItem('socle_token', token),
  removeToken: () => sessionStorage.removeItem('socle_token'),
};

const client = new SocleClient({
  baseUrl: 'https://...',
  tokenStorage: sessionStorageAdapter,
});
```

## Error Handling

```typescript
try {
  const result = await client.login(email, password);
  if (result.success) {
    // Handle success
  } else if (result.requires2FA) {
    // Handle 2FA
  } else {
    // Handle error
    console.error(result.error);
  }
} catch (error) {
  // Network or unexpected errors
  console.error('Request failed:', error);
}
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  SocleClient,
  SocleClientOptions,
  AuthState,
  User,
  Organization,
  LoginResult,
  RegisterData,
  RegisterResult,
  TokenStorage,
  Invite,
  InviteStatus,
  InviteResult,
  AcceptInviteResult,
} from '@soclestack/core';
```

## Framework Integration

For React applications, use `@soclestack/react` which provides hooks and components built on top of this core SDK.

```bash
npm install @soclestack/react
```

See the [React SDK documentation](../react/README.md) for details.

## License

MIT
