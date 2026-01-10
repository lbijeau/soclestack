# SDK Recipes Design

## Overview

Two SDK recipes for common authentication patterns: Protected Routes and Role-Based UI.

## Recipe 1: Protected Routes

Protect routes from unauthenticated users with automatic redirects to login. Supports Next.js App Router, Pages Router, and React Router.

### Usage

```typescript
// Wrap any component to require auth
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>

// With role requirements
<ProtectedRoute roles={['ROLE_ADMIN']}>
  <AdminPanel />
</ProtectedRoute>
```

### Behaviors

- Shows loading spinner while checking auth
- Redirects to `/login?returnUrl=...` if unauthenticated
- Optionally checks for specific roles
- Preserves the original URL for post-login redirect

### Core Implementation

```typescript
// packages/react/src/components/ProtectedRoute.tsx
import { useAuth } from '../hooks';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  fallback?: React.ReactNode;
  loginPath?: string;
}

export function ProtectedRoute({
  children,
  roles,
  fallback = <LoadingSpinner />,
  loginPath = '/login',
}: ProtectedRouteProps) {
  const { status, user } = useAuth();

  // Loading state
  if (status === 'loading') {
    return <>{fallback}</>;
  }

  // Not authenticated - redirect handled by hook or parent
  if (status !== 'authenticated' || !user) {
    return null;
  }

  // Role check (if specified)
  if (roles && roles.length > 0) {
    const userRoles = user.roles || [];
    const hasRole = roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
}
```

### Redirect Hook

```typescript
// packages/react/src/hooks/useAuthRedirect.ts
import { useEffect } from 'react';
import { useAuth } from './useAuth';

interface UseAuthRedirectOptions {
  loginPath?: string;
  onRedirect?: (url: string) => void; // Framework-agnostic redirect
}

export function useAuthRedirect({
  loginPath = '/login',
  onRedirect,
}: UseAuthRedirectOptions = {}) {
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated' && onRedirect) {
      const currentPath = typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/';
      const returnUrl = encodeURIComponent(currentPath);
      onRedirect(`${loginPath}?returnUrl=${returnUrl}`);
    }
  }, [status, loginPath, onRedirect]);

  return { status };
}
```

### Next.js App Router Integration

```typescript
// recipes/nextjs-app-router/ProtectedRoute.tsx
'use client';

import { useRouter } from 'next/navigation';
import { ProtectedRoute as BaseProtectedRoute } from '@soclestack/react';
import { useAuthRedirect } from '@soclestack/react';

export function ProtectedRoute({
  children,
  roles,
  loginPath = '/login',
}: {
  children: React.ReactNode;
  roles?: string[];
  loginPath?: string;
}) {
  const router = useRouter();

  useAuthRedirect({
    loginPath,
    onRedirect: (url) => router.push(url),
  });

  return (
    <BaseProtectedRoute roles={roles}>
      {children}
    </BaseProtectedRoute>
  );
}

// Usage in app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
```

---

## Recipe 2: Role-Based UI

Conditionally render UI elements based on user roles or permissions.

### Usage

```typescript
// Show only to admins
<Can roles={['ROLE_ADMIN']}>
  <DeleteButton />
</Can>

// Show only to org owners/admins
<Can orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']}>
  <InviteMemberButton />
</Can>

// Fallback for unauthorized
<Can roles={['ROLE_ADMIN']} fallback={<UpgradePrompt />}>
  <PremiumFeature />
</Can>

// Hook for programmatic checks
const { can } = usePermissions();
if (can({ roles: ['ROLE_ADMIN'] })) {
  // ...
}
```

### Behaviors

- Check global user roles (system-wide)
- Check organization roles (within current org)
- Optional fallback content
- Hook for logic outside JSX

### Permissions Hook

```typescript
// packages/react/src/hooks/usePermissions.ts
import { useAuth, useOrganization } from './hooks';

interface CanOptions {
  roles?: string[];      // Global user roles
  orgRoles?: string[];   // Organization-specific roles
}

export function usePermissions() {
  const { user } = useAuth();
  const { organization } = useOrganization();

  const can = ({ roles, orgRoles }: CanOptions): boolean => {
    if (!user) return false;

    // Check global roles
    if (roles && roles.length > 0) {
      const userRoles = user.roles || [];
      if (!roles.some((r) => userRoles.includes(r))) {
        return false;
      }
    }

    // Check org roles
    if (orgRoles && orgRoles.length > 0) {
      const userOrgRole = organization?.role;
      if (!userOrgRole || !orgRoles.includes(userOrgRole)) {
        return false;
      }
    }

    return true;
  };

  return { can, user, organization };
}
```

### Can Component

```typescript
// packages/react/src/components/Can.tsx
import { usePermissions } from '../hooks/usePermissions';

interface CanProps {
  children: React.ReactNode;
  roles?: string[];
  orgRoles?: string[];
  fallback?: React.ReactNode;
}

export function Can({
  children,
  roles,
  orgRoles,
  fallback = null
}: CanProps) {
  const { can } = usePermissions();

  if (can({ roles, orgRoles })) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
```

### Usage Examples

```typescript
// Dashboard with role-based sections
function Dashboard() {
  const { can } = usePermissions();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Admin-only stats */}
      <Can roles={['ROLE_ADMIN']}>
        <AdminStatsPanel />
      </Can>

      {/* Org owner/admin can manage team */}
      <Can orgRoles={['ROLE_OWNER', 'ROLE_ADMIN']} fallback={<ViewOnlyBadge />}>
        <TeamManagement />
      </Can>

      {/* Programmatic check for complex logic */}
      {can({ roles: ['ROLE_ADMIN'] }) && (
        <Button onClick={handleDangerousAction}>
          Danger Zone
        </Button>
      )}
    </div>
  );
}
```

---

## Files to Create

| File | Description |
|------|-------------|
| `packages/react/src/components/ProtectedRoute.tsx` | Base protected route component |
| `packages/react/src/components/Can.tsx` | Role-based UI component |
| `packages/react/src/hooks/useAuthRedirect.ts` | Redirect hook for unauthenticated users |
| `packages/react/src/hooks/usePermissions.ts` | Permissions checking hook |
| `packages/react/src/components/AccessDenied.tsx` | Default access denied component |
| `packages/react/src/components/LoadingSpinner.tsx` | Default loading component |

## Exports to Add

```typescript
// packages/react/src/index.ts
export { ProtectedRoute } from './components/ProtectedRoute';
export { Can } from './components/Can';
export { useAuthRedirect } from './hooks/useAuthRedirect';
export { usePermissions } from './hooks/usePermissions';
```
