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
