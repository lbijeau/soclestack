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
