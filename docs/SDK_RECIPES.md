# SDK Recipes

Copy-paste ready patterns for common authentication scenarios using `@soclestack/react`.

## Overview

| Recipe | Use Case | Components/Hooks |
|--------|----------|-----------------|
| [Protected Routes](#recipe-1-protected-routes) | Require authentication for pages | `ProtectedRoute`, `useAuthRedirect` |
| [Role-Based UI](#recipe-2-role-based-ui) | Show/hide UI based on roles | `Can`, `usePermissions` |
| [Organization Switcher](#recipe-3-organization-switcher) | Multi-tenant org switching | `OrganizationSwitcher`, `useOrganizations` |
| [Invite Accept Flow](#recipe-4-invite-accept-flow) | Handle invite tokens | `InviteAccept`, `useInvite` |
| [Session Timeout Warning](#recipe-5-session-timeout-warning) | Warn before session expires | `SessionTimeoutWarning`, `useSessionTimeout` |

---

## Recipe 1: Protected Routes

Protect pages from unauthenticated users with automatic redirects.

### Basic Usage

```tsx
import { ProtectedRoute } from '@soclestack/react';

// Wrap any component to require authentication
function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

### With Role Requirements

```tsx
// Only allow admins
<ProtectedRoute roles={['ROLE_ADMIN']}>
  <AdminPanel />
</ProtectedRoute>

// Allow multiple roles
<ProtectedRoute roles={['ROLE_ADMIN', 'ROLE_MODERATOR']}>
  <ModerationTools />
</ProtectedRoute>
```

### Next.js App Router Integration

```tsx
// app/dashboard/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ProtectedRoute, useAuthRedirect } from '@soclestack/react';

export default function DashboardPage() {
  const router = useRouter();

  // Handle redirect for unauthenticated users
  useAuthRedirect({
    loginPath: '/login',
    onRedirect: (url) => router.push(url),
  });

  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

### Custom Loading & Access Denied

```tsx
<ProtectedRoute
  roles={['ROLE_ADMIN']}
  fallback={<CustomSpinner />}
  accessDeniedFallback={<Custom403Page />}
>
  <AdminPanel />
</ProtectedRoute>
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Content to protect |
| `roles` | `string[]` | - | Required roles (any match) |
| `fallback` | `ReactNode` | `<LoadingSpinner />` | Loading state |
| `accessDeniedFallback` | `ReactNode` | `<AccessDenied />` | Shown when role check fails |

---

## Recipe 2: Role-Based UI

Conditionally render UI elements based on user roles or organization permissions.

### Basic Usage

```tsx
import { Can } from '@soclestack/react';

// Show only to admins
<Can roles={['ROLE_ADMIN']}>
  <DeleteButton />
</Can>

// Show only to org owners or admins
<Can orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']}>
  <InviteMemberButton />
</Can>
```

### With Fallback

```tsx
// Show upgrade prompt to non-admins
<Can roles={['ROLE_ADMIN']} fallback={<UpgradePrompt />}>
  <PremiumFeature />
</Can>
```

### Hook for Programmatic Checks

```tsx
import { usePermissions } from '@soclestack/react';

function Dashboard() {
  const { can } = usePermissions();

  return (
    <div>
      {/* Conditional rendering */}
      {can({ roles: ['ROLE_ADMIN'] }) && (
        <DangerZoneButton />
      )}

      {/* Complex permission logic */}
      {can({ orgRoles: ['ROLE_OWNER'] }) && (
        <BillingSettings />
      )}
    </div>
  );
}
```

### Full Example

```tsx
import { Can, usePermissions } from '@soclestack/react';

function TeamPage() {
  const { can, user, organization } = usePermissions();

  return (
    <div>
      <h1>Team: {organization?.name}</h1>

      {/* Admin-only stats */}
      <Can roles={['ROLE_ADMIN']}>
        <AdminStatsPanel />
      </Can>

      {/* Org admins can manage members */}
      <Can
        orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']}
        fallback={<ViewOnlyBadge />}
      >
        <TeamManagement />
      </Can>

      {/* Programmatic check for buttons */}
      <button
        onClick={handleDelete}
        disabled={!can({ orgRoles: ['ROLE_OWNER'] })}
      >
        Delete Organization
      </button>
    </div>
  );
}
```

### Props Reference

**Can Component:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | required | Content to show if authorized |
| `roles` | `string[]` | - | Global user roles to check |
| `orgRoles` | `string[]` | - | Organization roles to check |
| `fallback` | `ReactNode` | `null` | Content if unauthorized |

**usePermissions Hook:**

```tsx
const {
  can,          // (options: CanOptions) => boolean
  user,         // User | null
  organization  // Organization | null
} = usePermissions();
```

---

## Recipe 3: Organization Switcher

Dropdown component for switching between organizations in multi-tenant apps.

### Basic Usage

```tsx
import { OrganizationSwitcher } from '@soclestack/react';

// In your navbar
<nav>
  <Logo />
  <OrganizationSwitcher />
  <UserMenu />
</nav>
```

### With Callbacks

```tsx
import { useRouter } from 'next/navigation';

function Navbar() {
  const router = useRouter();

  return (
    <OrganizationSwitcher
      onSwitch={(org) => {
        // Redirect to org-specific page
        router.push(`/org/${org.slug}/dashboard`);
      }}
    />
  );
}
```

### With Create Organization Link

```tsx
<OrganizationSwitcher
  showCreateLink
  createOrgUrl="/organizations/new"
/>
```

### Custom Trigger

```tsx
<OrganizationSwitcher
  trigger={
    <button className="custom-trigger">
      Switch Workspace
    </button>
  }
/>
```

### Hook for Custom UI

```tsx
import { useOrganizations } from '@soclestack/react';

function CustomOrgSwitcher() {
  const {
    organizations,
    currentOrganization,
    switchOrganization,
    isLoading
  } = useOrganizations();

  if (isLoading) return <Skeleton />;

  return (
    <select
      value={currentOrganization?.id}
      onChange={(e) => switchOrganization(e.target.value)}
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name} ({org.role})
        </option>
      ))}
    </select>
  );
}
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `trigger` | `ReactNode` | Default button | Custom trigger element |
| `onSwitch` | `(org: Organization) => void` | - | Called after switching |
| `showCreateLink` | `boolean` | `false` | Show "Create Organization" link |
| `createOrgUrl` | `string` | `/organizations/new` | URL for create link |
| `className` | `string` | - | Additional CSS class |

---

## Recipe 4: Invite Accept Flow

Handle organization invite tokens with validation and acceptance.

### Basic Usage

```tsx
// app/invite/[token]/page.tsx
import { InviteAccept } from '@soclestack/react';

export default function InvitePage({ params }: { params: { token: string } }) {
  return <InviteAccept token={params.token} />;
}
```

### With Callbacks

```tsx
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

function InvitePage({ token }: { token: string }) {
  const router = useRouter();

  return (
    <InviteAccept
      token={token}
      onAccepted={(org) => {
        toast.success(`Joined ${org.name}!`);
        router.push(`/org/${org.slug}`);
      }}
      onError={(error) => {
        toast.error(error.message);
      }}
    />
  );
}
```

### Custom Login URL

```tsx
<InviteAccept
  token={token}
  loginUrl={`/login?returnUrl=/invite/${token}`}
/>
```

### Hook for Custom UI

```tsx
import { useInvite } from '@soclestack/react';

function CustomInviteFlow({ token }: { token: string }) {
  const {
    invite,
    status,
    error,
    isLoading,
    isAccepting,
    isAuthenticated,
    accept
  } = useInvite(token);

  if (isLoading) return <Skeleton />;

  if (status === 'expired') {
    return <ExpiredInviteMessage />;
  }

  if (status === 'invalid') {
    return <InvalidInviteMessage error={error} />;
  }

  if (!invite) return null;

  return (
    <div>
      <h1>Join {invite.organizationName}</h1>
      <p>Invited by {invite.inviterName} as {invite.role}</p>

      {isAuthenticated ? (
        <button onClick={accept} disabled={isAccepting}>
          {isAccepting ? 'Joining...' : 'Accept Invite'}
        </button>
      ) : (
        <a href={`/login?returnUrl=/invite/${token}`}>
          Sign in to accept
        </a>
      )}
    </div>
  );
}
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `token` | `string` | required | Invite token from URL |
| `onAccepted` | `(org: Organization) => void` | - | Called after accepting |
| `onError` | `(error: Error) => void` | - | Called on error |
| `loginUrl` | `string` | `/login` | Login page URL |
| `returnUrl` | `string` | - | URL to redirect after login |
| `loadingFallback` | `ReactNode` | `<LoadingSpinner />` | Loading state |
| `className` | `string` | - | Additional CSS class |

### Invite Statuses

| Status | Description |
|--------|-------------|
| `loading` | Validating token |
| `valid` | Ready to accept |
| `expired` | Invite expired |
| `invalid` | Token not found |
| `already_used` | Already accepted |
| `already_member` | User already in org |

---

## Recipe 5: Session Timeout Warning

Alert users before their session expires with option to extend.

### Basic Usage

```tsx
import { SessionTimeoutWarning } from '@soclestack/react';

// Add to your root layout
function App() {
  return (
    <SocleProvider client={client}>
      <SessionTimeoutWarning />
      <Routes />
    </SocleProvider>
  );
}
```

### With Custom Timing

```tsx
<SessionTimeoutWarning
  warnBefore={300}      // Show warning 5 minutes before expiry
  checkInterval={30}    // Check every 30 seconds
/>
```

### With Callbacks

```tsx
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

function Layout({ children }) {
  const router = useRouter();

  return (
    <>
      <SessionTimeoutWarning
        onWarning={() => {
          // Analytics, logging, etc.
          console.log('Session expiring soon');
        }}
        onTimeout={() => {
          router.push('/login?expired=true');
        }}
        onExtend={() => {
          toast.success('Session extended');
        }}
        onLogout={() => {
          router.push('/login');
        }}
      />
      {children}
    </>
  );
}
```

### Custom Labels

```tsx
<SessionTimeoutWarning
  title="Your session is expiring"
  message="Click below to stay signed in."
  extendLabel="Keep me signed in"
  logoutLabel="Sign out now"
/>
```

### Hook for Custom UI

```tsx
import { useSessionTimeout } from '@soclestack/react';

function CustomTimeoutWarning() {
  const {
    timeRemaining,
    isWarning,
    isExpired,
    extend,
    isExtending
  } = useSessionTimeout({
    warnBefore: 300,
    onTimeout: () => window.location.href = '/login?expired=true',
  });

  if (!isWarning || timeRemaining === null) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <Modal open={isWarning}>
      <h2>Session Expiring</h2>
      <p>Time remaining: {minutes}:{seconds.toString().padStart(2, '0')}</p>
      <button onClick={extend} disabled={isExtending}>
        {isExtending ? 'Extending...' : 'Stay Signed In'}
      </button>
    </Modal>
  );
}
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `warnBefore` | `number` | `300` | Seconds before expiry to warn |
| `checkInterval` | `number` | `30` | Check interval in seconds |
| `sessionDuration` | `number` | `3600` | Session duration (fallback) |
| `onWarning` | `() => void` | - | Called when warning shown |
| `onTimeout` | `() => void` | - | Called when session expires |
| `onExtend` | `() => void` | - | Called after successful extend |
| `onLogout` | `() => void` | - | Called when logout clicked |
| `title` | `string` | `"Session Expiring"` | Modal title |
| `message` | `string` | (default) | Modal message |
| `extendLabel` | `string` | `"Stay Signed In"` | Extend button text |
| `logoutLabel` | `string` | `"Log Out"` | Logout button text |
| `className` | `string` | - | Additional CSS class |

---

## Styling

All recipe components support styling via:

1. **CSS Classes** - Pass `className` prop
2. **Data Attributes** - Use `[data-socle="component-name"]` selectors
3. **CSS Variables** - Override default colors and spacing

### Example: Custom Theme

```css
/* Global overrides */
[data-socle] {
  --socle-primary: #6366f1;
  --socle-danger: #ef4444;
  --socle-border-radius: 8px;
}

/* Component-specific */
[data-socle="org-switcher"] {
  font-family: inherit;
}

[data-socle="session-warning"] {
  backdrop-filter: blur(4px);
}
```

---

## TypeScript

All components and hooks are fully typed. Import types as needed:

```tsx
import type {
  ProtectedRouteProps,
  CanProps,
  CanOptions,
  OrganizationSwitcherProps,
  InviteAcceptProps,
  SessionTimeoutWarningProps,
  UseSessionTimeoutOptions,
  UseAuthRedirectOptions,
} from '@soclestack/react';
```
