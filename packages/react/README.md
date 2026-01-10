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

### Core Hooks

#### useAuth()

Main authentication hook with full state and actions.

```tsx
const {
  state,           // AuthState
  isLoading,       // boolean
  isAuthenticated, // boolean
  user,            // User | null
  login,           // (email, password) => Promise
  logout,          // () => Promise
  register,        // (data) => Promise
} = useAuth();
```

#### useUser()

```tsx
const user = useUser(); // User | null
```

#### useOrganization()

```tsx
const org = useOrganization(); // Organization | null
```

#### useIsAuthenticated()

```tsx
const isAuthenticated = useIsAuthenticated(); // boolean
```

### Recipe Hooks

#### usePermissions()

Check user roles and organization permissions.

```tsx
const { can, user, organization } = usePermissions();

// Check global roles
if (can({ roles: ['ROLE_ADMIN'] })) { /* ... */ }

// Check org roles
if (can({ orgRoles: ['ROLE_OWNER', 'ROLE_ADMIN'] })) { /* ... */ }
```

#### useAuthRedirect()

Handle redirects for unauthenticated users.

```tsx
useAuthRedirect({
  loginPath: '/login',
  onRedirect: (url) => router.push(url),
});
```

#### useOrganizations()

Manage organizations and switching.

```tsx
const {
  organizations,        // Organization[]
  currentOrganization,  // Organization | null
  switchOrganization,   // (orgId: string) => Promise
  isLoading,           // boolean
} = useOrganizations();
```

#### useInvite()

Handle invite token validation and acceptance.

```tsx
const {
  invite,         // Invite | null
  status,         // 'loading' | 'valid' | 'expired' | 'invalid'
  error,          // string | null
  isLoading,      // boolean
  isAccepting,    // boolean
  isAuthenticated,// boolean
  accept,         // () => Promise<Organization | null>
} = useInvite(token);
```

#### useSessionTimeout()

Track session expiry and extend sessions.

```tsx
const {
  timeRemaining,  // number | null (seconds)
  isWarning,      // boolean
  isExpired,      // boolean
  isExtending,    // boolean
  extend,         // () => Promise<boolean>
} = useSessionTimeout({
  warnBefore: 300,      // seconds before expiry to warn
  checkInterval: 30,    // check frequency in seconds
  onWarning: () => {},  // called when warning threshold reached
  onTimeout: () => {},  // called when session expires
});
```

## Components

### Core Components

#### LoginForm

```tsx
<LoginForm
  onSuccess={(user) => {}}
  onError={(error) => {}}
  onRequires2FA={(tempToken) => {}}
  className="my-form"
/>
```

#### AuthGuard

```tsx
<AuthGuard
  fallback={<LoginPage />}
  loadingFallback={<Spinner />}
  onUnauthenticated={() => router.push('/login')}
>
  <ProtectedContent />
</AuthGuard>
```

### Recipe Components

#### ProtectedRoute

Protect routes with authentication and role requirements.

```tsx
<ProtectedRoute roles={['ROLE_ADMIN']}>
  <AdminPanel />
</ProtectedRoute>
```

#### Can

Conditionally render based on roles/permissions.

```tsx
<Can roles={['ROLE_ADMIN']} fallback={<UpgradePrompt />}>
  <PremiumFeature />
</Can>

<Can orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']}>
  <TeamSettings />
</Can>
```

#### OrganizationSwitcher

Dropdown for switching organizations.

```tsx
<OrganizationSwitcher
  onSwitch={(org) => router.push(`/org/${org.slug}`)}
  showCreateLink
/>
```

#### InviteAccept

Handle organization invite acceptance.

```tsx
<InviteAccept
  token={params.token}
  onAccepted={(org) => router.push(`/org/${org.slug}`)}
  onError={(error) => toast.error(error.message)}
/>
```

#### SessionTimeoutWarning

Warn users before session expires.

```tsx
<SessionTimeoutWarning
  warnBefore={300}
  onTimeout={() => router.push('/login?expired=true')}
  onExtend={() => toast.success('Session extended')}
/>
```

#### LoadingSpinner

Default loading indicator.

```tsx
<LoadingSpinner size={24} className="my-spinner" />
```

#### AccessDenied

Default access denied page.

```tsx
<AccessDenied
  title="Access Denied"
  message="You don't have permission to view this page."
/>
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
[data-socle="org-switcher"] { /* org switcher */ }
[data-socle="session-warning"] { /* timeout modal */ }
```

## Recipes

For detailed usage patterns and examples, see the [SDK Recipes Guide](../../docs/SDK_RECIPES.md).

## TypeScript

All components and hooks are fully typed:

```tsx
import type {
  // Core
  User,
  Organization,
  AuthState,
  SocleProviderProps,

  // Components
  LoginFormProps,
  AuthGuardProps,
  ProtectedRouteProps,
  CanProps,
  OrganizationSwitcherProps,
  InviteAcceptProps,
  SessionTimeoutWarningProps,

  // Hooks
  CanOptions,
  UseAuthRedirectOptions,
  UseSessionTimeoutOptions,
} from '@soclestack/react';
```

## License

MIT
