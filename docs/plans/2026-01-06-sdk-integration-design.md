# SDK Integration Design - Embeddable Components

**Date:** 2026-01-06
**Status:** Draft
**Author:** Architecture Brainstorm

## Executive Summary

Design for SDKs that allow developers to embed SocleStack's auth/org UI into their own applications. A self-hosted SocleStack instance serves as the backend; the SDK provides both headless logic and pre-built React components.

**Core principle:** Separate auth logic from UI. The headless SDK handles all complexity; UI packages are thin wrappers.

## Problem Statement

Developers deploying SocleStack as their backend often have a separate frontend (React, Vue, legacy jQuery, mobile). They want to use SocleStack's auth and org management without:

- Rebuilding login/register/2FA flows
- Managing token refresh logic
- Handling auth state across their app

**Target users:**

1. **React apps** - Want native components with hooks
2. **Non-React apps** - Want headless SDK with vanilla JS examples
3. **Legacy apps** - Want minimal integration (redirect/popup flows)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Consumer Apps                         │
├─────────────┬─────────────────────┬─────────────────────┤
│  React SDK  │  Web Components SDK │   Headless SDK      │
│  (native)   │  (future)           │   (logic only)      │
├─────────────┴─────────────────────┴─────────────────────┤
│                   @soclestack/core                       │
│         (API client, auth state, token management)       │
├─────────────────────────────────────────────────────────┤
│                 SocleStack Backend                       │
│              (your deployed instance)                    │
└─────────────────────────────────────────────────────────┘
```

**Package structure:**

- `@soclestack/core` - Headless SDK. API client, auth state machine, token storage, event emitters. Zero UI dependencies.
- `@soclestack/react` - React components built on core. Unstyled by default with optional Tailwind preset.

## @soclestack/core - Headless SDK

### Responsibilities

1. **API Client** - Typed HTTP client for all SocleStack endpoints
2. **Auth State Machine** - Tracks authentication lifecycle
3. **Token Management** - Storage, refresh, expiry detection
4. **Event System** - Subscribe to auth changes

### Auth State Machine

```typescript
type AuthState =
  | { status: 'loading' }           // Checking stored tokens
  | { status: 'unauthenticated' }   // No valid session
  | { status: 'authenticated'; user: User; org?: Organization }
  | { status: 'error'; error: Error };
```

### Core API Surface

```typescript
class SocleClient {
  constructor(options: SocleClientOptions);

  // State
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): Unsubscribe;

  // Auth actions
  login(email: string, password: string): Promise<LoginResult>;
  register(data: RegisterData): Promise<RegisterResult>;
  logout(): Promise<void>;

  // 2FA
  verifyTwoFactor(code: string): Promise<void>;

  // Session
  refreshSession(): Promise<void>;

  // Organizations
  switchOrganization(orgId: string): Promise<void>;
  getCurrentOrg(): Organization | null;

  // Redirect flow (OAuth-style)
  loginWithRedirect(): void;
  handleCallback(): Promise<void>;

  // Events
  on(event: 'audit', handler: (event: AuditEvent) => void): void;
  on(event: 'rateLimited', handler: (retryAfter: number) => void): void;

  // Low-level
  api: TypedApiClient;  // For custom endpoints
}

interface SocleClientOptions {
  baseUrl: string;
  redirectUri?: string;
  tokenStorage?: TokenStorage;  // Custom adapter for RN, Electron
  credentials?: 'include' | 'same-origin';
}
```

### Configuration Example

```typescript
import { SocleClient } from '@soclestack/core';

const client = new SocleClient({
  baseUrl: 'https://my-soclestack.example.com',
});

// Subscribe to auth changes
client.subscribe((state) => {
  if (state.status === 'authenticated') {
    console.log('Logged in as', state.user.email);
  }
});
```

### Token Storage Strategy

| Environment | Access Token | Refresh Token |
|-------------|--------------|---------------|
| Browser (same-origin) | Memory + short-lived | `httpOnly` cookie |
| Browser (cross-origin) | Memory only | Proxy through backend |
| React Native | Secure storage adapter | Secure storage adapter |

### Bundle Target

- ESM + CJS + UMD builds
- Tree-shakeable
- <10KB gzipped

## @soclestack/react - React Components

### Design Philosophy

Unstyled by default. Components render semantic HTML with data attributes for styling. Ship optional Tailwind preset.

### Component Inventory (MVP)

```typescript
// Provider
<SocleProvider client={client}>
  <App />
</SocleProvider>

// Auth flows
<LoginForm onSuccess={} onError={} />
<RegisterForm onSuccess={} />
<ForgotPasswordForm />
<ResetPasswordForm token={} />
<TwoFactorForm />

// Session UI
<UserMenu />           // Avatar dropdown: profile, logout
<AuthGuard>            // Protect routes, redirect if unauthed
  <ProtectedContent />
</AuthGuard>

// Organization
<OrgSwitcher />        // Dropdown to switch orgs
<OrgInviteAccept token={} />

// Hooks (for custom UIs)
useAuth()              // { state, login, logout, ... }
useUser()              // Current user or null
useOrganization()      // Current org context
```

### Styling Approaches

```tsx
// Option 1: Unstyled (you provide CSS)
<LoginForm className="my-login" />

// Option 2: CSS variables theming
:root {
  --socle-primary: #3b82f6;
  --socle-radius: 8px;
  --socle-font-family: inherit;
}

// Option 3: Tailwind preset (import separately)
import '@soclestack/react/tailwind.css';
```

### Form Handling

Components manage their own state internally. Expose callbacks for integration:

```tsx
<LoginForm
  onSuccess={(user) => router.push('/dashboard')}
  onError={(error) => toast.error(error.message)}
  onRequires2FA={() => setShow2FAModal(true)}
  renderError={(error) => <CustomError error={error} />}
/>
```

## Legacy/Non-React Integration Patterns

### Pattern A: Headless SDK + Custom UI (Recommended)

For apps that want full control over their UI:

```html
<form id="login-form">
  <input name="email" type="email" />
  <input name="password" type="password" />
  <button type="submit">Login</button>
  <div id="error"></div>
</form>

<script type="module">
  import { SocleClient } from '@soclestack/core';

  const client = new SocleClient({
    baseUrl: 'https://auth.example.com'
  });

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    const result = await client.login(
      form.get('email'),
      form.get('password')
    );

    if (result.success) {
      window.location.href = '/dashboard';
    } else if (result.requires2FA) {
      showTwoFactorModal();
    } else {
      document.getElementById('error').textContent = result.error;
    }
  };
</script>
```

### Pattern B: Popup/Redirect Flow (OAuth-style)

For minimal integration - open SocleStack's hosted pages:

```javascript
import { SocleClient } from '@soclestack/core';

const client = new SocleClient({
  baseUrl: 'https://auth.example.com',
  redirectUri: 'https://myapp.com/callback'
});

// Opens login in popup or redirect
document.getElementById('login-btn').onclick = () => {
  client.loginWithRedirect();
};

// On callback page (myapp.com/callback):
await client.handleCallback(); // Exchanges code for tokens
window.location.href = '/dashboard';
```

### Pattern C: UMD Script Tag (Legacy)

For apps that can't use ES modules:

```html
<script src="https://unpkg.com/@soclestack/core/dist/socle.umd.js"></script>
<script>
  const client = new Socle.SocleClient({
    baseUrl: 'https://auth.example.com'
  });

  client.login(email, password).then(result => {
    // Handle result
  });
</script>
```

### Pattern D: Iframe Embed (Future)

For drop-in UI without any code:

```html
<iframe
  src="https://auth.example.com/embed/login?redirect=https://myapp.com/callback"
  style="border: none; width: 400px; height: 500px;"
></iframe>
```

**MVP scope:** Patterns A, B, and C. Iframe embed is future enhancement.

## Security Considerations

### Cross-Origin Deployment

When SDK runs on `app.com` but SocleStack is on `auth.example.com`:

```typescript
const client = new SocleClient({
  baseUrl: 'https://auth.example.com',
  credentials: 'include',  // Send cookies cross-origin
});
```

**Required backend changes:**

- CORS whitelist for allowed origins
- `SameSite=None; Secure` cookies for cross-origin
- CSRF protection via double-submit cookie pattern

### Token Refresh Strategy

1. Access tokens: 15 min expiry, stored in memory
2. Refresh tokens: 7 day expiry, `httpOnly` cookie
3. SDK auto-refreshes 1 min before expiry
4. On 401, attempt silent refresh before failing

### Security Headers

- SDK loads no external resources (CSP compliant)
- No `eval()` or dynamic code execution
- Subresource integrity hashes for CDN builds

### Rate Limiting

SDK implements client-side backoff on 429 responses:

```typescript
client.on('rateLimited', (retryAfter) => {
  showToast(`Too many attempts. Try again in ${retryAfter}s`);
});
```

### Audit Trail

All auth events emit for customer logging:

```typescript
client.on('audit', (event) => {
  // { type: 'login', userId: '...', timestamp: '...' }
  analytics.track(event);
});
```

## Build & Distribution

### Package Publishing

```
@soclestack/core    → npm
@soclestack/react   → npm
```

### Build Targets

| Package | ESM | CJS | UMD | Types |
|---------|-----|-----|-----|-------|
| core    | Yes | Yes | Yes | Yes   |
| react   | Yes | Yes | No  | Yes   |

### Bundle Sizes (Target)

- `@soclestack/core`: <10KB gzipped
- `@soclestack/react`: <15KB gzipped (excluding React peer dep)

### Monorepo Structure

```
packages/
├── core/
│   ├── src/
│   │   ├── client.ts
│   │   ├── auth-state.ts
│   │   ├── api/
│   │   └── storage/
│   ├── package.json
│   └── tsconfig.json
├── react/
│   ├── src/
│   │   ├── provider.tsx
│   │   ├── hooks/
│   │   └── components/
│   └── package.json
└── docs/              # SDK documentation site
```

### Tooling

- **Build:** Turborepo for monorepo orchestration
- **Bundling:** tsup or Rollup
- **Versioning:** Changesets for coordinated releases
- **Testing:** Vitest for unit tests
- **Docs:** Typedoc for API reference

### Versioning Strategy

All packages share version number. Breaking changes bump major across all packages simultaneously (like React ecosystem).

## Implementation Roadmap

### Phase 1: Core SDK (Week 1-2)

- [ ] Set up monorepo (Turborepo + pnpm workspaces)
- [ ] Implement `SocleClient` with auth state machine
- [ ] API client with typed endpoints (login, register, logout, refresh)
- [ ] Token storage adapters (memory, localStorage, cookie)
- [ ] Event system (subscribe to auth changes)
- [ ] Unit tests for all auth flows
- [ ] UMD build for CDN usage

### Phase 2: React SDK (Week 2-3)

- [ ] `<SocleProvider>` context setup
- [ ] Hooks: `useAuth`, `useUser`, `useOrganization`
- [ ] `<LoginForm>`, `<RegisterForm>` components
- [ ] `<AuthGuard>` route protection
- [ ] `<UserMenu>`, `<OrgSwitcher>` components
- [ ] CSS variables theming system
- [ ] Optional Tailwind preset

### Phase 3: Backend Changes (Week 2)

- [ ] CORS configuration for SDK origins
- [ ] Cross-origin cookie settings (`SameSite=None`)
- [ ] Token endpoint for refresh flow
- [ ] Rate limiting headers SDK can parse
- [ ] Embed pages for redirect flow (`/embed/login`, `/embed/callback`)

### Phase 4: Documentation & Examples (Week 3-4)

- [ ] SDK documentation site
- [ ] Example: React app integration
- [ ] Example: Vanilla JS integration
- [ ] Example: Vue app with headless SDK
- [ ] Migration guide from direct API usage

### Future Enhancements (Not MVP)

- Web Components package (`@soclestack/elements`)
- Iframe embed mode with postMessage API
- React Native adapter
- SSR support for Next.js consumer apps
- Pre-built themes (light/dark/custom)

## Success Criteria

- [ ] React app can integrate auth in <30 minutes
- [ ] Vanilla JS app can integrate in <1 hour
- [ ] Bundle size targets met (<10KB core, <15KB react)
- [ ] All auth flows work cross-origin
- [ ] Token refresh is transparent to consumers
- [ ] TypeScript types are comprehensive

## Related

- Unified Role Architecture: `docs/plans/2026-01-04-unified-role-architecture-design.md`
- RBAC Gap Analysis: `docs/reviews/2026-01-06-rbac-gap-analysis.md`

---

Generated with [Claude Code](https://claude.ai/code)
